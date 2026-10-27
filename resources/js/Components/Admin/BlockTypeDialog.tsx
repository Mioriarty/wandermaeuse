import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/Components/Admin/Ui';
import type { BlockTypeOption } from '@/Components/Admin/BlockEditor';
import type { BlockType } from '@/types';

type Props = {
    title: string;
    options: BlockTypeOption[];
    onPick: (type: BlockType) => void;
    onClose: () => void;
    /** The type being converted from; offered, but not pickable. */
    current?: BlockType;
    /** What a conversion into each type would drop; a lossy pick asks first. */
    lossesFor?: (type: BlockType) => string[];
};

/**
 * Picks a section pattern, for adding a section or converting one. Native
 * <dialog>: Escape closes it, focus stays inside and returns to the button
 * that opened it.
 */
export default function BlockTypeDialog({ title, options, onPick, onClose, current, lossesFor }: Props) {
    const ref = useRef<HTMLDialogElement | null>(null);
    const [pending, setPending] = useState<BlockTypeOption | null>(null);

    useEffect(() => {
        if (ref.current && !ref.current.open) ref.current.showModal();
    }, []);

    // Closing goes through the dialog, so its close event is the one place
    // that tells the editor - whether by button, Escape or a click outside.
    const close = () => ref.current?.close();

    const pick = (option: BlockTypeOption) => {
        onPick(option.value);
        close();
    };

    const pendingLosses = pending ? (lossesFor?.(pending.value) ?? []) : [];

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            onClick={(e) => e.target === ref.current && close()}
            aria-label={title}
            className="m-auto w-full max-w-2xl border border-ink bg-paper p-0 text-ink backdrop:bg-ink/60"
        >
            <div className="hairline-b flex items-center justify-between px-5 py-3">
                <h2 className="label-xs text-graphite">{title}</h2>
                <button
                    type="button"
                    onClick={close}
                    aria-label="Schließen"
                    className="-mr-2 flex h-8 w-8 items-center justify-center text-graphite hover:text-ink"
                >
                    ✕
                </button>
            </div>

            <div className="grid grid-cols-4 gap-3 p-5">
                {options.map((option) => {
                    const isCurrent = option.value === current;
                    const lossy = !isCurrent && (lossesFor?.(option.value).length ?? 0) > 0;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            disabled={isCurrent}
                            onClick={() => (lossy ? setPending(option) : pick(option))}
                            className={`flex flex-col items-center gap-2 border px-2 pt-4 pb-3 text-center transition-colors disabled:cursor-default disabled:opacity-40 ${
                                pending?.value === option.value
                                    ? 'border-accent'
                                    : 'border-hairline hover:border-ink disabled:hover:border-hairline'
                            }`}
                        >
                            <Sketch type={option.value} />
                            <span className="text-sm">{option.label}</span>
                            <span className={`label-xs min-h-4 ${lossy ? 'text-accent' : 'text-graphite'}`}>
                                {isCurrent ? 'aktuell' : lossy ? 'Inhalt fällt weg' : ''}
                            </span>
                        </button>
                    );
                })}
            </div>

            {pending && (
                <div className="hairline-t px-5 py-4">
                    <p className="text-sm">Beim Umwandeln in „{pending.label}“ fällt weg:</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-graphite">
                        {pendingLosses.map((loss) => (
                            <li key={loss}>{loss}</li>
                        ))}
                    </ul>
                    <div className="mt-4 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setPending(null)}>
                            Zurück
                        </Button>
                        <Button variant="danger" onClick={() => pick(pending)}>
                            Trotzdem umwandeln
                        </Button>
                    </div>
                </div>
            )}
        </dialog>
    );
}

/** A small drawing of how the pattern lays out its content. */
function Sketch({ type }: { type: BlockType }) {
    const image = (x: number, y: number, w: number, h: number) => (
        <rect x={x} y={y} width={w} height={h} fill="currentColor" fillOpacity={0.12} />
    );
    const line = (x: number, y: number, w: number) => <line x1={x} y1={y} x2={x + w} y2={y} />;

    const shapes: Record<BlockType, ReactNode> = {
        text: (
            <>
                {line(6, 8, 36)}
                {line(6, 14, 36)}
                {line(6, 20, 36)}
                {line(6, 26, 22)}
            </>
        ),
        heading: (
            <>
                {line(14, 9, 20)}
                <rect x={6} y={15} width={36} height={6} fill="currentColor" stroke="none" />
            </>
        ),
        image_full: image(2, 4, 44, 24),
        image_text: (
            <>
                {image(2, 4, 20, 11)}
                {image(2, 17, 20, 11)}
                {line(26, 9, 20)}
                {line(26, 15, 20)}
                {line(26, 21, 14)}
            </>
        ),
        image_pair: (
            <>
                {image(2, 6, 21, 20)}
                {image(25, 6, 21, 20)}
            </>
        ),
        gallery: (
            <>
                {image(2, 4, 13, 11)}
                {image(17.5, 4, 13, 11)}
                {image(33, 4, 13, 11)}
                {image(2, 17, 13, 11)}
                {image(17.5, 17, 13, 11)}
                {image(33, 17, 13, 11)}
            </>
        ),
        quote: (
            <>
                {line(2, 4, 44)}
                {line(10, 13, 28)}
                {line(14, 19, 20)}
                {line(2, 28, 44)}
            </>
        ),
        divider: (
            <>
                {line(2, 16, 18)}
                <circle cx={24} cy={16} r={1.5} fill="currentColor" stroke="none" />
                {line(28, 16, 18)}
            </>
        ),
    };

    return (
        <svg width="48" height="32" viewBox="0 0 48 32" aria-hidden fill="none" stroke="currentColor" strokeWidth={1}>
            {shapes[type]}
        </svg>
    );
}
