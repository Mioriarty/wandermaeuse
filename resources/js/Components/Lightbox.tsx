import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import type { ImageProps } from '@/types';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Space between two photos while one is swiped in. */
const GAP = 24;
const SETTLE_MS = 250;

type Point = { x: number; y: number };
/** Zoom of the current photo; x and y are its shift from the centre of the stage. */
type View = { scale: number; x: number; y: number };
const REST: View = { scale: 1, x: 0, y: 0 };

/**
 * What a finger (or the mouse) is doing right now. Each kind keeps where it
 * started, so every move is computed from the start rather than added up.
 */
type Gesture =
    | { kind: 'undecided'; start: Point; time: number }
    | { kind: 'pan'; start: Point; time: number; from: View }
    | { kind: 'swipe'; start: Point; time: number }
    | { kind: 'dismiss'; start: Point; time: number }
    | { kind: 'pinch'; distance: number; mid: Point; from: View };

/**
 * Opens the photos of one block in a lightbox. The block passes `open` to its
 * frames and renders `lightbox` anywhere.
 */
export function useLightbox(images: ImageProps[], caption?: string | null) {
    const [start, setStart] = useState<number | null>(null);

    return {
        open: (index: number) => setStart(index),
        lightbox:
            start === null ? null : (
                <Lightbox images={images} start={start} caption={caption} onClose={() => setStart(null)} />
            ),
    };
}

/**
 * A photo at full size, built for the phone first: pinch or double-tap to
 * zoom, drag to pan, swipe sideways to the neighbouring photo and swipe down
 * to close. On a computer the wheel zooms, the arrow keys page and a click
 * beside the photo closes. Native <dialog>, so Escape closes and focus
 * returns to the photo that was tapped.
 */
function Lightbox({
    images,
    start,
    caption,
    onClose,
}: {
    images: ImageProps[];
    start: number;
    caption?: string | null;
    onClose: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [stage, setStage] = useState({ width: 0, height: 0 });
    const [index, setIndex] = useState(start);
    const [view, setView] = useState<View>(REST);
    // The whole current slide follows the finger: x while swiping to a
    // neighbour, y while dragging down to close.
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
    const [settling, setSettling] = useState(false);

    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<Gesture | null>(null);
    const lastTap = useRef<{ time: number; at: Point } | null>(null);
    const settleTimer = useRef<number | undefined>(undefined);

    const image = images[index];
    const fitted = fit(image, stage);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal();

        // The page behind must not scroll while a finger pans the photo.
        const root = document.documentElement;
        const overflow = root.style.overflow;
        root.style.overflow = 'hidden';

        return () => {
            root.style.overflow = overflow;
            window.clearTimeout(settleTimer.current);
        };
    }, []);

    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const measure = () => setStage({ width: el.clientWidth, height: el.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // React registers wheel listeners as passive, which cannot stop the page
    // from zooming on a trackpad pinch (that arrives as ctrl + wheel).
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
            const at = toStage(el, e.clientX, e.clientY);
            setView((v) => clamp(zoomAround(v, v.scale * factor, at), fitted, stage));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [fitted.width, fitted.height, stage]);

    const close = () => dialogRef.current?.close();

    /** Runs a change with transitions on, so it glides instead of jumping. */
    const settle = (change: () => void, then?: () => void) => {
        window.clearTimeout(settleTimer.current);
        setSettling(true);
        change();
        settleTimer.current = window.setTimeout(() => {
            setSettling(false);
            then?.();
        }, SETTLE_MS);
    };

    const go = (delta: number) => {
        const target = index + delta;
        if (settling || target < 0 || target >= images.length) {
            settle(() => setOffset({ x: 0, y: 0 }));
            return;
        }
        // Slide the neighbour into place, then swap it in with transitions
        // off: it already sits where the new current photo belongs.
        settle(
            () => setOffset({ x: -delta * (stage.width + GAP), y: 0 }),
            () => {
                setIndex(target);
                setView(REST);
                setOffset({ x: 0, y: 0 });
            },
        );
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (settling) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        begin(e.currentTarget);
    };

    /** (Re)starts a gesture from the fingers that are down right now. */
    const begin = (el: HTMLElement) => {
        const points = [...pointers.current.values()];
        if (points.length >= 2) {
            const [a, b] = points;
            gesture.current = {
                kind: 'pinch',
                distance: Math.hypot(a.x - b.x, a.y - b.y),
                mid: toStage(el, (a.x + b.x) / 2, (a.y + b.y) / 2),
                from: view,
            };
            setOffset({ x: 0, y: 0 });
        } else if (points.length === 1) {
            const start = points[0];
            gesture.current =
                view.scale > 1
                    ? { kind: 'pan', start, time: Date.now(), from: view }
                    : { kind: 'undecided', start, time: Date.now() };
        }
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        if (!g) return;

        if (g.kind === 'pinch') {
            const [a, b] = [...pointers.current.values()];
            if (!b) return;
            const scale = Math.min(MAX_SCALE, Math.max(1, (g.from.scale * Math.hypot(a.x - b.x, a.y - b.y)) / g.distance));
            const mid = toStage(e.currentTarget, (a.x + b.x) / 2, (a.y + b.y) / 2);
            // Keep the spot that was between the fingers between them.
            const anchor = { x: (g.mid.x - g.from.x) / g.from.scale, y: (g.mid.y - g.from.y) / g.from.scale };
            setView(clamp({ scale, x: mid.x - anchor.x * scale, y: mid.y - anchor.y * scale }, fitted, stage));
            return;
        }

        const dx = e.clientX - g.start.x;
        const dy = e.clientY - g.start.y;

        if (g.kind === 'pan') {
            setView(clamp({ ...g.from, x: g.from.x + dx, y: g.from.y + dy }, fitted, stage));
        } else if (g.kind === 'undecided') {
            if (Math.hypot(dx, dy) < 8) return;
            gesture.current = {
                ...g,
                kind: Math.abs(dx) > Math.abs(dy) && images.length > 1 ? 'swipe' : 'dismiss',
            };
        } else if (g.kind === 'swipe') {
            // Resistance past the first and the last photo.
            const edge = (dx > 0 && index === 0) || (dx < 0 && index === images.length - 1);
            setOffset({ x: edge ? dx / 3 : dx, y: 0 });
        } else if (g.kind === 'dismiss') {
            setOffset({ x: 0, y: dy });
        }
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        const up = pointers.current.get(e.pointerId);
        if (!up) return;
        pointers.current.delete(e.pointerId);
        const g = gesture.current;
        gesture.current = null;

        // One finger of a pinch lifted: carry on panning with the other.
        if (g?.kind === 'pinch') {
            if (pointers.current.size > 0) begin(e.currentTarget);
            return;
        }
        if (!g || e.type === 'pointercancel') {
            settle(() => setOffset({ x: 0, y: 0 }));
            return;
        }

        const dx = e.clientX - g.start.x;
        const dy = e.clientY - g.start.y;
        const elapsed = Math.max(1, Date.now() - g.time);

        if (g.kind === 'swipe') {
            const fling = Math.abs(dx) / elapsed > 0.5;
            if (Math.abs(dx) > stage.width * 0.2 || fling) go(dx < 0 ? 1 : -1);
            else settle(() => setOffset({ x: 0, y: 0 }));
        } else if (g.kind === 'dismiss') {
            if (Math.abs(dy) > 120 || Math.abs(dy) / elapsed > 0.6) close();
            else settle(() => setOffset({ x: 0, y: 0 }));
        } else if (Math.hypot(dx, dy) < 10 && elapsed < 300) {
            tap(toStage(e.currentTarget, e.clientX, e.clientY), e.pointerType);
        }
    };

    const tap = (at: Point, pointerType: string) => {
        const previous = lastTap.current;
        const double =
            previous && Date.now() - previous.time < 300 && Math.hypot(at.x - previous.at.x, at.y - previous.at.y) < 40;

        if (double) {
            lastTap.current = null;
            settle(() =>
                setView((v) => (v.scale > 1 ? REST : clamp(zoomAround(v, DOUBLE_TAP_SCALE, at), fitted, stage))),
            );
            return;
        }
        lastTap.current = { time: Date.now(), at };

        // A click beside the photo closes, as on any lightbox. On a phone the
        // photo fills the width, and a stray tap should not throw you out.
        const beside = Math.abs(at.x) > fitted.width / 2 || Math.abs(at.y) > fitted.height / 2;
        if (pointerType === 'mouse' && view.scale === 1 && beside) close();
    };

    const transition = settling ? `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out` : 'none';
    const text = caption || image.caption;

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') go(-1);
                if (e.key === 'ArrowRight') go(1);
            }}
            aria-label="Bild"
            // Focus the dialog, not the close button: keys work at once and no
            // focus ring sits on the photo after a tap.
            autoFocus
            className="fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none flex-col overflow-hidden bg-transparent p-0 text-paper open:flex backdrop:bg-transparent"
        >
            <div
                aria-hidden
                className="absolute inset-0 bg-ink transition-opacity duration-200 starting:opacity-0"
                style={{ opacity: 1 - Math.min(0.8, Math.abs(offset.y) / 400) }}
            />

            <div className="relative z-10 flex h-14 shrink-0 justify-end">
                <button
                    type="button"
                    onClick={close}
                    aria-label="Schließen"
                    className="flex h-14 w-14 items-center justify-center bg-ink/60 hover:bg-ink focus-visible:outline-paper"
                >
                    <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.25">
                        <path d="M1 1l12 12M13 1L1 13" />
                    </svg>
                </button>
            </div>

            <div
                ref={stageRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="relative min-h-0 flex-1 touch-none select-none"
            >
                {stage.width > 0 &&
                    [index - 1, index, index + 1]
                        .filter((k) => k >= 0 && k < images.length)
                        .map((k) => {
                            const slide = images[k];
                            const size = fit(slide, stage);
                            const current = k === index;
                            // Ask for a sharper file once zoomed in.
                            const sizes = `${Math.round(size.width * (current ? Math.ceil(view.scale) : 1))}px`;

                            return (
                                <div
                                    key={slide.id}
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                        transform: `translate3d(${(k - index) * (stage.width + GAP) + offset.x}px, ${current ? offset.y : 0}px, 0)`,
                                        transition,
                                    }}
                                >
                                    <div
                                        className="shrink-0"
                                        style={{
                                            width: size.width,
                                            height: size.height,
                                            backgroundColor: slide.dominantColor,
                                            transform: current
                                                ? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
                                                : undefined,
                                            transition,
                                        }}
                                    >
                                        <picture>
                                            <source type="image/webp" srcSet={slide.srcset} sizes={sizes} />
                                            <img
                                                src={slide.src}
                                                srcSet={slide.jpegSrcset}
                                                sizes={sizes}
                                                alt={slide.alt}
                                                width={slide.width}
                                                height={slide.height}
                                                draggable={false}
                                                className="h-full w-full"
                                            />
                                        </picture>
                                    </div>
                                </div>
                            );
                        })}
            </div>

            {/* Dark under the controls, so they stay legible over a zoomed photo. */}
            <div className="relative z-10 shrink-0 bg-ink/60 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {text && (
                    <p className="mx-auto line-clamp-3 max-w-2xl text-center text-sm leading-snug text-paper/80">{text}</p>
                )}
                {images.length > 1 && (
                    <div className="mt-1 flex items-center justify-center">
                        <NavButton label="Vorheriges Bild" disabled={index === 0} onClick={() => go(-1)}>
                            ←
                        </NavButton>
                        <span className="label-xs w-16 text-center tabular-nums text-paper/80">
                            {index + 1} / {images.length}
                        </span>
                        <NavButton label="Nächstes Bild" disabled={index === images.length - 1} onClick={() => go(1)}>
                            →
                        </NavButton>
                    </div>
                )}
            </div>
        </dialog>
    );
}

function NavButton({
    children,
    label,
    disabled,
    onClick,
}: {
    children: string;
    label: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="flex h-11 w-11 items-center justify-center text-base hover:bg-paper/10 focus-visible:outline-paper disabled:opacity-25 disabled:hover:bg-transparent"
        >
            {children}
        </button>
    );
}

/**
 * The photo's size when it fits the stage whole. On a phone it takes the full
 * width; on a computer it keeps clear of the edges.
 */
function fit(image: ImageProps, stage: { width: number; height: number }) {
    const ratio = image.width / image.height || image.aspectRatio || 1;
    const room = stage.width >= 640 ? stage.width - 128 : stage.width;
    const width = Math.max(0, Math.min(room, stage.height * ratio));
    return { width, height: width / ratio };
}

/** Zooms to `scale` while the photo stays put under `at`. */
function zoomAround(v: View, scale: number, at: Point): View {
    const s = Math.min(MAX_SCALE, Math.max(1, scale));
    return { scale: s, x: at.x - ((at.x - v.x) / v.scale) * s, y: at.y - ((at.y - v.y) / v.scale) * s };
}

/** Keeps the zoomed photo from being dragged off the stage. */
function clamp(v: View, size: { width: number; height: number }, stage: { width: number; height: number }): View {
    if (v.scale <= 1) return REST;
    const maxX = Math.max(0, (size.width * v.scale - stage.width) / 2);
    const maxY = Math.max(0, (size.height * v.scale - stage.height) / 2);
    return {
        scale: v.scale,
        x: Math.min(maxX, Math.max(-maxX, v.x)),
        y: Math.min(maxY, Math.max(-maxY, v.y)),
    };
}

/** A screen position relative to the centre of the stage. */
function toStage(el: HTMLElement, clientX: number, clientY: number): Point {
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}
