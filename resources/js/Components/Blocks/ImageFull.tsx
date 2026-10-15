import Caption from '@/Components/Caption';
import Frame from '@/Components/Frame';
import { useLightbox } from '@/Components/Lightbox';
import type { BlockProps } from '@/types';

export default function ImageFull({ block }: { block: BlockProps }) {
    const image = block.images[0];
    const caption = (block.data.caption as string) ?? image?.caption;
    const { open, lightbox } = useLightbox(block.images, caption);
    if (!image) return null;

    const bleed = block.data.bleed !== false;

    // Full bleed on a phone means edge to edge: the photograph is the page.
    return (
        <figure className={bleed ? 'm-0' : 'mx-auto m-0 max-w-5xl px-5 sm:px-8'}>
            <Frame image={image} sizes="100vw" onOpen={() => open(0)} />
            <div className={bleed ? 'px-5 sm:px-8' : ''}>
                <Caption>{caption}</Caption>
            </div>
            {lightbox}
        </figure>
    );
}
