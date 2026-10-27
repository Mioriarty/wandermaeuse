import { useState } from 'react';
import ImageSelectModal, { ratioOf } from '@/Components/Admin/ImageSelectModal';
import { useMediaLibrary } from '@/Components/Admin/MediaLibrary';
import { Button } from '@/Components/Admin/Ui';
import type { LibraryImage } from '@/types';

type Props = {
    selected: number | null;
    onSelect: (id: number | null) => void;
    label?: string;
    /** Heading of the modal; "<label> wählen" unless given. */
    title?: string;
};

/** One picture, chosen in the picker modal. */
export default function MediaPicker({ selected, onSelect, label = 'Bild', title }: Props) {
    const { images } = useMediaLibrary();
    const [open, setOpen] = useState(false);
    const current = images.find((m) => m.id === selected) ?? null;

    return (
        <div>
            <span className="label-xs block text-graphite">{label}</span>

            <div className="mt-2 flex items-start gap-3">
                {/* The whole photo, letterboxed: its proportions are part of the choice. */}
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={current ? `${label} ändern` : `${label} wählen`}
                    className="flex h-28 w-40 shrink-0 items-center justify-center border border-hairline bg-paper-deep hover:border-ink"
                >
                    {current ? (
                        <img src={current.src} alt="" className="max-h-full max-w-full" style={{ aspectRatio: ratioOf(current) }} />
                    ) : (
                        <span className="label-xs text-graphite">+ Bild</span>
                    )}
                </button>
                <div className="flex min-w-0 flex-col gap-2">
                    <Button variant="ghost" onClick={() => setOpen(true)}>
                        {current ? 'Ändern …' : 'Bild wählen …'}
                    </Button>
                    {selected !== null && (
                        <Button variant="ghost" onClick={() => onSelect(null)}>
                            Entfernen
                        </Button>
                    )}
                    {current && <p className="truncate text-xs text-graphite">{describeShort(current)}</p>}
                </div>
            </div>

            {open && (
                <ImageSelectModal
                    title={title ?? `${label} wählen`}
                    max={1}
                    initial={selected === null ? [] : [selected]}
                    onApply={(ids) => onSelect(ids[0] ?? null)}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}

/**
 * An ordered set of pictures: a gallery, the pictures beside a text, or, with
 * max 2 and two slot labels, the two halves of a pair.
 */
export function MultiMediaPicker({
    selected,
    onChange,
    title = 'Bilder wählen',
    max = Infinity,
    slotLabels,
}: {
    selected: number[];
    onChange: (ids: number[]) => void;
    title?: string;
    max?: number;
    slotLabels?: string[];
}) {
    const { images } = useMediaLibrary();
    const [open, setOpen] = useState(false);

    const move = (index: number, delta: number) => {
        const next = [...selected];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const count = Number.isFinite(max) ? `${selected.length} von ${max}` : String(selected.length);

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <span className="label-xs text-graphite">Bilder ({count})</span>
                <Button variant="ghost" onClick={() => setOpen(true)}>
                    {selected.length === 0 ? 'Bilder wählen …' : 'Auswahl ändern …'}
                </Button>
            </div>

            {selected.length === 0 ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-3 flex h-24 w-full items-center justify-center border border-dashed border-hairline hover:border-ink"
                >
                    <span className="label-xs text-graphite">+ Bilder</span>
                </button>
            ) : (
                <ul className="mt-3 flex flex-wrap items-end gap-2">
                    {selected.map((id, index) => {
                        const image = images.find((m) => m.id === id);
                        return (
                            <li key={id} className="border border-hairline">
                                <button
                                    type="button"
                                    onClick={() => setOpen(true)}
                                    aria-label="Auswahl ändern"
                                    className="relative block h-24 bg-paper-deep"
                                    style={{ aspectRatio: image ? ratioOf(image) : 1 }}
                                >
                                    {image ? (
                                        <img src={image.src} alt="" className="h-full w-full" />
                                    ) : (
                                        <span className="flex h-full items-center justify-center text-xs text-graphite">#{id}</span>
                                    )}
                                    <span className="label-xs absolute bottom-0 left-0 bg-ink/70 px-1 py-0.5 text-paper">
                                        {slotLabels?.[index] ?? index + 1}
                                    </span>
                                </button>
                                <div className="hairline-t flex">
                                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Nach vorn" className="flex-1 py-1 text-xs hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink">
                                        ←
                                    </button>
                                    <button type="button" onClick={() => onChange(selected.filter((x) => x !== id))} aria-label="Entfernen" className="flex-1 py-1 text-xs hover:bg-accent hover:text-paper">
                                        ✕
                                    </button>
                                    <button type="button" onClick={() => move(index, 1)} disabled={index === selected.length - 1} aria-label="Nach hinten" className="flex-1 py-1 text-xs hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink">
                                        →
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {open && (
                <ImageSelectModal
                    title={title}
                    max={max}
                    initial={selected}
                    slotLabels={slotLabels}
                    onApply={onChange}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}

function describeShort(image: LibraryImage): string {
    const ratio = ratioOf(image);
    const shape = ratio > 1.05 ? 'Querformat' : ratio < 0.95 ? 'Hochformat' : 'Quadratisch';
    return [image.originalName, shape].filter(Boolean).join(' · ');
}
