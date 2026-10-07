import type { BlockProps } from '@/types';

export default function Divider({ block }: { block: BlockProps }) {
    const glyph = (block.data.glyph as string) ?? '';

    // Darker than bg-hairline: that tone is meant for borders next to other
    // content and all but vanishes as a lone line on the paper background.
    const line = <span aria-hidden className="h-px flex-1 bg-graphite/40" />;

    // w-full matters: the blocks sit in a flex column, where mx-auto shrinks an
    // item to its content - and the lines have none, so the divider was 0px wide.
    return (
        <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
            <div role="separator" className="flex items-center gap-4">
                {line}
                {glyph && (
                    <>
                        <span className="font-display text-xl leading-none text-graphite">{glyph}</span>
                        {line}
                    </>
                )}
            </div>
        </div>
    );
}
