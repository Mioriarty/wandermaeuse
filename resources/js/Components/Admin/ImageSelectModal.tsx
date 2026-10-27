import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbox, type LightboxSelection } from '@/Components/Lightbox';
import { uploadImage, useMediaLibrary } from '@/Components/Admin/MediaLibrary';
import { Button } from '@/Components/Admin/Ui';
import type { LibraryImage } from '@/types';

type Orientation = 'landscape' | 'portrait' | 'square';
type Filter = 'all' | Orientation;
type TileSize = 's' | 'm' | 'l';

/** Row height of the grid per tile size; the width follows each photo. */
const ROW_HEIGHT: Record<TileSize, number> = { s: 110, m: 170, l: 250 };
const SIZE_KEY = 'wandermaeuse.picker.size';
/** The editor hands over the newest pictures only; see formOptions(). */
const LIBRARY_LIMIT = 300;

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Alle' },
    { value: 'landscape', label: 'Querformat' },
    { value: 'portrait', label: 'Hochformat' },
    { value: 'square', label: 'Quadratisch' },
];

type Upload = {
    key: number;
    file: File;
    /** A local preview while the file travels; browsers cannot show HEIC. */
    preview: string | null;
    ratio: number;
    progress: number;
    error: string | null;
};

type Props = {
    title: string;
    /** 1 for a single picture, 2 for a pair, Infinity for a gallery. */
    max: number;
    initial: number[];
    /** Names each place in the selection, e.g. links and rechts for a pair. */
    slotLabels?: string[];
    onApply: (ids: number[]) => void;
    /** Called once the modal is gone, applied or not. */
    onClose: () => void;
};

/**
 * Chooses pictures out of the library, in a modal over the editor.
 *
 * The grid shows every photo whole, in its own proportions, so portrait and
 * landscape are told apart at a glance. A tap on a photo opens it large in the
 * lightbox, where it can be selected too; the corner box selects right in the
 * grid. Nothing reaches the editor until "Übernehmen".
 *
 * Rendered into <body>: the post editor is one big <form>, and Enter in the
 * search field would otherwise submit the whole entry.
 */
export default function ImageSelectModal({ title, max, initial, slotLabels, onApply, onClose }: Props) {
    const { images: library, add } = useMediaLibrary();
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const tiles = useRef(new Map<number, HTMLButtonElement>());

    const [selection, setSelection] = useState<number[]>(initial);
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [onlySelected, setOnlySelected] = useState(false);
    const [size, setSize] = useState<TileSize>(readSize);
    const [uploads, setUploads] = useState<Upload[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{ images: LibraryImage[]; start: number } | null>(null);
    const [dragging, setDragging] = useState(false);
    const dragDepth = useRef(0);
    const uploadKey = useRef(0);
    const queue = useRef<Promise<void>>(Promise.resolve());

    const byId = useMemo(() => new Map(library.map((image) => [image.id, image])), [library]);
    const counts = useMemo(() => {
        const c: Record<Filter, number> = { all: library.length, landscape: 0, portrait: 0, square: 0 };
        for (const image of library) c[orientation(image)]++;
        return c;
    }, [library]);

    const visible = useMemo(() => {
        const pool = onlySelected
            ? selection.map((id) => byId.get(id)).filter((image): image is LibraryImage => !!image)
            : library;
        const needle = fold(query.trim());
        return pool.filter(
            (image) =>
                (filter === 'all' || orientation(image) === filter) &&
                (needle === '' || fold(`${image.originalName ?? ''} ${image.alt} ${image.caption ?? ''}`).includes(needle)),
        );
    }, [library, byId, selection, onlySelected, filter, query]);

    const pending = uploads.filter((upload) => upload.error === null).length;
    const dirty = selection.length !== initial.length || selection.some((id, i) => id !== initial[i]);
    const numbered = max > 1;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal();

        const root = document.documentElement;
        const overflow = root.style.overflow;
        root.style.overflow = 'hidden';

        // Start where the current choice is, rather than at the top of a long
        // library.
        const first = tiles.current.get(initial[0]) ?? tiles.current.values().next().value;
        first?.focus({ preventScroll: true });
        first?.scrollIntoView({ block: 'center' });

        return () => {
            root.style.overflow = overflow;
        };
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 4000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    /** Selects or deselects one picture; returns why not, when full. */
    const toggle = (id: number): string | null => {
        if (selection.includes(id)) {
            setSelection(selection.filter((x) => x !== id));
            return null;
        }
        if (max === 1) {
            setSelection([id]);
            return null;
        }
        if (selection.length >= max) {
            return max === 2
                ? 'Ein Bildpaar hat zwei Bilder – wähle zuerst eines ab.'
                : `Höchstens ${max} Bilder – wähle zuerst eines ab.`;
        }
        setSelection([...selection, id]);
        return null;
    };

    const toggleHere = (id: number) => setNotice(toggle(id));

    const lightboxSelection: LightboxSelection = {
        position: (id) => {
            const at = selection.indexOf(id);
            return at === -1 ? null : at;
        },
        toggle,
        numbered,
    };

    const close = () => dialogRef.current?.close();

    const cancel = () => {
        if (dirty && !window.confirm('Die geänderte Auswahl verwerfen?')) return;
        close();
    };

    const apply = () => {
        if (pending > 0) return;
        onApply(selection);
        close();
    };

    const upload = async (files: File[]) => {
        const pictures = files.filter((file) => file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name));
        if (pictures.length === 0) {
            setNotice('Das sind keine Bilder. Erlaubt sind JPEG, PNG, WebP und HEIC.');
            return;
        }

        // New pictures land at the front; make sure no filter hides them.
        setFilter('all');
        setQuery('');
        setOnlySelected(false);

        const entries = await Promise.all(
            pictures.map(async (file) => ({ key: ++uploadKey.current, file, progress: 0, error: null, ...(await measure(file)) })),
        );
        setUploads((current) => [...entries, ...current]);
        entries.forEach((entry) => enqueue(entry));
    };

    /** One at a time: the server makes every variant while the request waits. */
    const enqueue = (entry: Upload) => {
        const patch = (change: Partial<Upload>) =>
            setUploads((current) => current.map((u) => (u.key === entry.key ? { ...u, ...change } : u)));

        queue.current = queue.current.then(async () => {
            try {
                const image = await uploadImage(entry.file, (progress) => patch({ progress }));
                add([image]);
                setSelection((current) => {
                    if (current.includes(image.id)) return current;
                    if (max === 1) return [image.id];
                    return current.length < max ? [...current, image.id] : current;
                });
                setUploads((current) => current.filter((u) => u.key !== entry.key));
                if (entry.preview) URL.revokeObjectURL(entry.preview);
            } catch (error) {
                patch({ error: error instanceof Error ? error.message : 'Hochladen fehlgeschlagen.' });
            }
        });
    };

    const retry = (entry: Upload) => {
        const again = { ...entry, error: null, progress: 0 };
        setUploads((current) => current.map((u) => (u.key === entry.key ? again : u)));
        enqueue(again);
    };

    const dismiss = (entry: Upload) => {
        setUploads((current) => current.filter((u) => u.key !== entry.key));
        if (entry.preview) URL.revokeObjectURL(entry.preview);
    };

    const chooseSize = (next: TileSize) => {
        setSize(next);
        try {
            localStorage.setItem(SIZE_KEY, next);
        } catch {
            // Private window or blocked storage: the size just is not remembered.
        }
    };

    const openLightbox = (images: LibraryImage[], start: number) => {
        // A copy: deselecting under "Nur Auswahl" must not pull the photo
        // out from under the lightbox.
        setLightbox({ images: [...images], start });
    };

    const afterLightbox = (shown: LibraryImage | undefined) => {
        setLightbox(null);
        // Back in the grid at the photo looked at last, not the one tapped.
        requestAnimationFrame(() => {
            const tile = shown && tiles.current.get(shown.id);
            if (!tile) return;
            tile.focus({ preventScroll: true });
            tile.scrollIntoView({ block: 'nearest' });
        });
    };

    /** Arrow keys walk the grid: sideways by order, up and down by what sits there. */
    const moveFocus = (id: number, key: string) => {
        const order = visible.map((image) => image.id);
        const at = order.indexOf(id);
        let target: number | undefined;

        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            target = order[at + (key === 'ArrowRight' ? 1 : -1)];
        } else {
            const from = tiles.current.get(id)?.getBoundingClientRect();
            if (!from) return;
            const down = key === 'ArrowDown';
            const centre = from.left + from.width / 2;
            let best: { id: number; gap: number; drift: number } | null = null;

            for (const other of order) {
                const rect = tiles.current.get(other)?.getBoundingClientRect();
                if (!rect || other === id) continue;
                const gap = down ? rect.top - from.bottom : from.top - rect.bottom;
                if (gap < -2) continue;
                const drift = Math.abs(rect.left + rect.width / 2 - centre);
                // The nearest row first (tiles in one row share their top),
                // then the photo straight above or below.
                if (!best || gap < best.gap - 4 || (Math.abs(gap - best.gap) <= 4 && drift < best.drift)) {
                    best = { id: other, gap, drift };
                }
            }
            target = best?.id;
        }

        const tile = target === undefined ? undefined : tiles.current.get(target);
        tile?.focus({ preventScroll: true });
        tile?.scrollIntoView({ block: 'nearest' });
    };

    const onTileKey = (e: ReactKeyboardEvent<HTMLButtonElement>, image: LibraryImage) => {
        if (e.key === ' ') {
            // Space selects; Enter, the button's own key, opens the photo.
            e.preventDefault();
            if (!e.repeat) toggleHere(image.id);
        } else if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            moveFocus(image.id, e.key);
        }
    };

    const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

    const applyLabel =
        pending > 0
            ? 'Lädt hoch …'
            : max === 1
              ? selection.length === 0 && initial.length > 0
                  ? 'Ohne Bild übernehmen'
                  : 'Übernehmen'
              : `Übernehmen (${selection.length})`;

    const rowHeight = ROW_HEIGHT[size];

    return createPortal(
        <dialog
            ref={dialogRef}
            aria-label={title}
            // React hands a dialog the close and cancel events of dialogs inside
            // it too - the lightbox closing must not close the picker.
            onClose={(e) => e.target === dialogRef.current && onClose()}
            onCancel={(e) => {
                if (e.target !== dialogRef.current) return;
                // Escape: same as "Abbrechen", which asks before losing a choice.
                e.preventDefault();
                cancel();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    apply();
                }
            }}
            onDragEnter={(e) => {
                if (!hasFiles(e)) return;
                dragDepth.current++;
                setDragging(true);
            }}
            onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setDragging(false);
            }}
            onDragOver={(e) => hasFiles(e) && e.preventDefault()}
            onDrop={(e) => {
                if (!hasFiles(e)) return;
                e.preventDefault();
                dragDepth.current = 0;
                setDragging(false);
                upload(Array.from(e.dataTransfer.files));
            }}
            className="m-auto hidden h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-[1400px] flex-col border border-ink bg-paper p-0 text-ink open:flex backdrop:bg-ink/60"
        >
            <header className="hairline-b px-5 pt-4 pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="font-ui text-lg font-bold tracking-tight">{title}</h2>
                        <p className="mt-0.5 text-xs text-graphite">{hint(max, slotLabels)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={cancel}
                        aria-label="Schließen"
                        className="-mt-1 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center text-graphite hover:text-ink"
                    >
                        ✕
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex" role="group" aria-label="Format">
                        {FILTERS.filter((f) => f.value !== 'square' || counts.square > 0).map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFilter(f.value)}
                                aria-pressed={filter === f.value}
                                className={`label-xs -ml-px flex min-h-9 items-center gap-1.5 border px-3 first:ml-0 ${
                                    filter === f.value
                                        ? 'relative z-10 border-ink bg-ink text-paper'
                                        : 'border-hairline text-graphite hover:text-ink'
                                }`}
                            >
                                {f.value !== 'all' && <OrientationIcon orientation={f.value} />}
                                {f.label}
                                <span className="tabular-nums opacity-60">{counts[f.value]}</span>
                            </button>
                        ))}
                    </div>

                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            // Escape empties the field first, and only then closes.
                            if (e.key === 'Escape' && query) {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuery('');
                            }
                        }}
                        placeholder="Suchen: Dateiname, Bildtext …"
                        aria-label="Bilder durchsuchen"
                        className="min-h-9 w-64 border border-hairline bg-paper px-3 text-sm focus:border-ink focus:outline-none"
                    />

                    <button
                        type="button"
                        onClick={() => setOnlySelected((o) => !o)}
                        aria-pressed={onlySelected}
                        disabled={selection.length === 0 && !onlySelected}
                        className={`label-xs min-h-9 border px-3 disabled:opacity-40 ${
                            onlySelected ? 'border-accent bg-accent text-paper' : 'border-hairline text-graphite hover:text-ink'
                        }`}
                    >
                        Nur Auswahl <span className="tabular-nums">({selection.length})</span>
                    </button>

                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex" role="group" aria-label="Vorschaugröße">
                            {(['s', 'm', 'l'] as const).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => chooseSize(s)}
                                    aria-pressed={size === s}
                                    aria-label={{ s: 'Kleine Vorschau', m: 'Mittlere Vorschau', l: 'Große Vorschau' }[s]}
                                    className={`-ml-px flex h-9 w-9 items-center justify-center border first:ml-0 ${
                                        size === s
                                            ? 'relative z-10 border-ink bg-ink text-paper'
                                            : 'border-hairline text-graphite hover:text-ink'
                                    }`}
                                >
                                    <span
                                        aria-hidden
                                        className="block border border-current"
                                        style={{ width: { s: 8, m: 12, l: 16 }[s], height: { s: 6, m: 9, l: 12 }[s] }}
                                    />
                                </button>
                            ))}
                        </div>

                        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                            Hochladen …
                        </Button>
                        <input
                            ref={fileRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/heic,.heic"
                            className="hidden"
                            onChange={(e) => {
                                upload(Array.from(e.target.files ?? []));
                                e.target.value = '';
                            }}
                        />
                    </div>
                </div>
            </header>

            <div className="relative min-h-0 flex-1">
                <div className="absolute inset-0 overflow-y-auto px-5 py-4">
                    {library.length === 0 && uploads.length === 0 ? (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex h-full w-full flex-col items-center justify-center border border-dashed border-hairline text-center hover:border-ink"
                        >
                            <span className="label-xs text-graphite">Noch keine Bilder</span>
                            <span className="mt-2 text-sm text-graphite">Zieh welche hierher oder klicke zum Hochladen.</span>
                        </button>
                    ) : (
                        <>
                            <ul
                                className="m-0 flex list-none flex-wrap gap-2 p-0 after:block after:grow-[999] after:content-['']"
                                aria-label="Bilder"
                            >
                                {uploads.map((entry) => (
                                    <UploadTile
                                        key={entry.key}
                                        entry={entry}
                                        rowHeight={rowHeight}
                                        onRetry={() => retry(entry)}
                                        onDismiss={() => dismiss(entry)}
                                    />
                                ))}
                                {visible.map((image, index) => {
                                    const at = selection.indexOf(image.id);
                                    return (
                                        <Tile
                                            key={image.id}
                                            image={image}
                                            rowHeight={rowHeight}
                                            position={at === -1 ? null : at}
                                            numbered={numbered}
                                            slotLabel={at === -1 ? undefined : slotLabels?.[at]}
                                            tileRef={(el) => {
                                                if (el) tiles.current.set(image.id, el);
                                                else tiles.current.delete(image.id);
                                            }}
                                            onOpen={() => openLightbox(visible, index)}
                                            onToggle={() => toggleHere(image.id)}
                                            onKeyDown={(e) => onTileKey(e, image)}
                                        />
                                    );
                                })}
                            </ul>

                            {visible.length === 0 && uploads.length === 0 && (
                                <div className="flex flex-col items-center py-16 text-center">
                                    <p className="text-sm text-graphite">
                                        {onlySelected ? 'Nichts ausgewählt, das zum Filter passt.' : 'Keine Bilder für diesen Filter.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilter('all');
                                            setQuery('');
                                            setOnlySelected(false);
                                        }}
                                        className="label-xs link-underline mt-3 min-h-9"
                                    >
                                        Filter zurücksetzen
                                    </button>
                                </div>
                            )}

                            {library.length >= LIBRARY_LIMIT && !onlySelected && (
                                <p className="mt-6 text-center text-xs text-graphite">
                                    Zu sehen sind die neuesten {LIBRARY_LIMIT} Bilder.
                                </p>
                            )}
                        </>
                    )}
                </div>

                {dragging && (
                    <div className="pointer-events-none absolute inset-3 flex items-center justify-center border-2 border-dashed border-ink bg-paper/90">
                        <span className="label-xs">Loslassen zum Hochladen</span>
                    </div>
                )}
            </div>

            <footer className="hairline-t flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                    {selection.length === 0 ? (
                        <p className="text-sm text-graphite">
                            {max === 1 ? 'Noch kein Bild gewählt.' : 'Noch keine Bilder gewählt.'}
                        </p>
                    ) : (
                        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0" aria-label="Auswahl">
                            {selection.map((id, index) => {
                                const image = byId.get(id);
                                const label = slotLabels?.[index];
                                return (
                                    <li
                                        key={id}
                                        className="relative h-14 shrink-0 bg-paper-deep"
                                        style={{ aspectRatio: image ? ratioOf(image) : 1 }}
                                    >
                                        {image ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openLightbox(
                                                        selection
                                                            .map((x) => byId.get(x))
                                                            .filter((x): x is LibraryImage => !!x),
                                                        index,
                                                    )
                                                }
                                                aria-label={`${nameOf(image)} groß ansehen`}
                                                className="block h-full w-full"
                                            >
                                                <Thumb image={image} height={56} />
                                            </button>
                                        ) : (
                                            <span className="flex h-full items-center justify-center text-xs text-graphite">
                                                #{id}
                                            </span>
                                        )}
                                        {(numbered || label) && (
                                            <span className="label-xs pointer-events-none absolute bottom-0 left-0 bg-accent px-1 py-0.5 text-paper">
                                                {label ?? index + 1}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => toggleHere(id)}
                                            aria-label="Abwählen"
                                            className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center bg-ink/70 text-[10px] text-paper hover:bg-accent"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {notice && (
                        <p role="status" className="mt-1 text-xs text-accent">
                            {notice}
                        </p>
                    )}
                </div>

                <p className="hidden text-right text-xs leading-relaxed text-graphite xl:block">
                    Klick vergrößert · Kästchen, Leertaste oder ⇧-Klick wählt
                    <br />
                    Pfeiltasten bewegen · ⌘↵ übernimmt
                </p>
                <Button variant="ghost" onClick={cancel}>
                    Abbrechen
                </Button>
                <Button onClick={apply} disabled={pending > 0}>
                    {applyLabel}
                </Button>
            </footer>

            {lightbox && (
                <Lightbox
                    images={lightbox.images}
                    start={lightbox.start}
                    describe={(image) => describe(image as LibraryImage)}
                    selection={lightboxSelection}
                    onClose={(index) => afterLightbox(lightbox.images[index])}
                />
            )}
        </dialog>,
        document.body,
    );
}

function Tile({
    image,
    rowHeight,
    position,
    numbered,
    slotLabel,
    tileRef,
    onOpen,
    onToggle,
    onKeyDown,
}: {
    image: LibraryImage;
    rowHeight: number;
    position: number | null;
    numbered: boolean;
    slotLabel?: string;
    tileRef: (el: HTMLButtonElement | null) => void;
    onOpen: () => void;
    onToggle: () => void;
    onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
    const ratio = ratioOf(image);
    const selected = position !== null;

    return (
        // Grow in proportion to the photo's width: every tile in a row ends
        // up the same height, and each photo is shown whole.
        <li className="group relative" style={{ flexGrow: ratio, flexBasis: ratio * rowHeight }}>
            <button
                ref={tileRef}
                type="button"
                onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? onToggle() : onOpen())}
                onKeyDown={onKeyDown}
                onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
                aria-label={`${nameOf(image)} groß ansehen`}
                title={describe(image)}
                className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                style={{ aspectRatio: ratio }}
            >
                <Thumb image={image} height={rowHeight} />
            </button>

            {selected && <span aria-hidden className="pointer-events-none absolute inset-0 border-[3px] border-accent" />}
            {slotLabel && (
                <span className="label-xs pointer-events-none absolute bottom-0 left-0 bg-accent px-2 py-1 text-paper">
                    {slotLabel}
                </span>
            )}

            <button
                type="button"
                onClick={onToggle}
                aria-pressed={selected}
                aria-label={selected ? `${nameOf(image)} abwählen` : `${nameOf(image)} auswählen`}
                tabIndex={-1}
                className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center"
            >
                <span
                    aria-hidden
                    className={`flex h-7 min-w-7 items-center justify-center border px-1 text-xs font-bold tabular-nums transition-colors ${
                        selected
                            ? 'border-accent bg-accent text-paper'
                            : 'border-paper bg-ink/20 text-transparent group-hover:bg-ink/40 hover:text-paper'
                    }`}
                >
                    {selected && numbered ? position + 1 : '✓'}
                </span>
            </button>
        </li>
    );
}

function UploadTile({
    entry,
    rowHeight,
    onRetry,
    onDismiss,
}: {
    entry: Upload;
    rowHeight: number;
    onRetry: () => void;
    onDismiss: () => void;
}) {
    return (
        <li
            className="relative overflow-hidden bg-paper-deep"
            style={{ flexGrow: entry.ratio, flexBasis: entry.ratio * rowHeight, aspectRatio: entry.ratio }}
        >
            {entry.preview && <img src={entry.preview} alt="" className="h-full w-full object-cover opacity-50" />}
            {entry.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/85 p-2 text-center">
                    <p className="text-xs text-accent">{entry.error}</p>
                    <p className="max-w-full truncate text-xs text-graphite">{entry.file.name}</p>
                    <div className="flex gap-1">
                        <button type="button" onClick={onRetry} className="label-xs border border-hairline px-2 py-1 hover:bg-ink hover:text-paper">
                            Nochmal
                        </button>
                        <button type="button" onClick={onDismiss} className="label-xs border border-hairline px-2 py-1 hover:bg-ink hover:text-paper">
                            Weg
                        </button>
                    </div>
                </div>
            ) : (
                <div className="absolute inset-x-0 bottom-0 p-2">
                    <p className="label-xs mb-1 text-ink">
                        {entry.progress < 1 ? `Lädt hoch … ${Math.round(entry.progress * 100)} %` : 'Wird verarbeitet …'}
                    </p>
                    <div className="h-1 w-full bg-paper/70">
                        <div className="h-full bg-ink transition-[width]" style={{ width: `${entry.progress * 100}%` }} />
                    </div>
                </div>
            )}
        </li>
    );
}

/** A small file from the srcset, painted in the photo's colour until it arrives. */
function Thumb({ image, height }: { image: LibraryImage; height: number }) {
    // Room for a sharp picture on a 2x screen without fetching the original.
    const sizes = `${Math.round(ratioOf(image) * height * 1.5)}px`;

    return (
        <picture className="block h-full w-full" style={{ backgroundColor: image.dominantColor }}>
            <source type="image/webp" srcSet={image.srcset} sizes={sizes} />
            <img
                src={image.src}
                srcSet={image.jpegSrcset}
                sizes={sizes}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="h-full w-full object-cover"
            />
        </picture>
    );
}

function OrientationIcon({ orientation }: { orientation: Orientation }) {
    const [w, h] = { landscape: [12, 8], portrait: [8, 12], square: [10, 10] }[orientation];
    return <span aria-hidden className="block border border-current" style={{ width: w, height: h }} />;
}

export function ratioOf(image: { width: number; height: number; aspectRatio: number }): number {
    return image.width > 0 && image.height > 0 ? image.width / image.height : image.aspectRatio || 1;
}

function orientation(image: LibraryImage): Orientation {
    const ratio = ratioOf(image);
    // A few percent either way still reads as square.
    if (ratio > 1.05) return 'landscape';
    if (ratio < 0.95) return 'portrait';
    return 'square';
}

const ORIENTATION_LABEL: Record<Orientation, string> = {
    landscape: 'Querformat',
    portrait: 'Hochformat',
    square: 'Quadratisch',
};

function nameOf(image: LibraryImage): string {
    return image.originalName || image.alt || `Bild ${image.id}`;
}

function describe(image: LibraryImage): string {
    return [nameOf(image), `${image.width} × ${image.height}`, ORIENTATION_LABEL[orientation(image)]].join(' · ');
}

function hint(max: number, slotLabels?: string[]): string {
    if (max === 1) return 'Ein Bild. Ein Klick vergrößert, das Kästchen oben rechts wählt.';
    if (slotLabels && max === slotLabels.length) {
        return `${slotLabels.length} Bilder, in dieser Reihenfolge: ${slotLabels.join(', dann ')}.`;
    }
    return 'Beliebig viele, in der Reihenfolge, in der du sie wählst.';
}

/** Case and accents aside, so "Tikal" finds "tikal" and "Cusco" finds "Cuscó". */
function fold(text: string): string {
    return text.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '');
}

function readSize(): TileSize {
    try {
        const stored = localStorage.getItem(SIZE_KEY);
        return stored === 's' || stored === 'l' ? stored : 'm';
    } catch {
        return 'm';
    }
}

/** Size and a preview of a file before it is uploaded. */
function measure(file: File): Promise<{ preview: string | null; ratio: number }> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ preview: url, ratio: img.naturalWidth / img.naturalHeight || 4 / 3 });
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ preview: null, ratio: 4 / 3 });
        };
        img.src = url;
    });
}
