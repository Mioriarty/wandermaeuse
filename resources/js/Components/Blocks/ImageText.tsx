import Caption from '@/Components/Caption';
import Frame from '@/Components/Frame';
import type { BlockProps } from '@/types';

/**
 * How much of the twelve-column row the picture takes at desktop width. The
 * class strings are spelled out so Tailwind finds them. Blocks stored before
 * the option existed fall back to medium.
 */
const SIZES = {
    small: { image: 'md:col-span-4', text: 'md:col-span-8', sizes: '(min-width: 768px) 32vw, 100vw' },
    medium: { image: 'md:col-span-5', text: 'md:col-span-7', sizes: '(min-width: 768px) 40vw, 100vw' },
    large: { image: 'md:col-span-7', text: 'md:col-span-5', sizes: '(min-width: 768px) 55vw, 100vw' },
} as const;

export default function ImageText({ block }: { block: BlockProps }) {
    const image = block.images[0];
    const html = (block.data.html as string) ?? '';
    const caption = (block.data.caption as string) ?? image?.caption;
    const imageRight = block.data.variant === 'right';
    const size = SIZES[block.data.size as keyof typeof SIZES] ?? SIZES.medium;

    return (
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            {/* Stacks on mobile with the picture first, whichever side it sits
                on at desktop width. */}
            <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:items-start md:gap-10">
                {image && (
                    <figure className={`m-0 ${size.image} ${imageRight ? 'md:order-2' : 'md:order-1'}`}>
                        <Frame image={image} sizes={size.sizes} />
                        <Caption>{caption}</Caption>
                    </figure>
                )}
                {/* Same type as a plain text block, so the running text does
                    not change size when it passes a picture. */}
                <div
                    className={`prose-column text-[1.0625rem] text-ink-soft md:text-lg ${size.text} ${
                        imageRight ? 'md:order-1' : 'md:order-2'
                    }`}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );
}
