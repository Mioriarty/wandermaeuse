import Caption from '@/Components/Caption';
import Frame from '@/Components/Frame';
import { useLightbox } from '@/Components/Lightbox';
import type { BlockProps } from '@/types';

export default function ImagePair({ block }: { block: BlockProps }) {
    const [left, right] = block.images;
    const caption = (block.data.caption as string) ?? '';
    const { open, lightbox } = useLightbox(block.images, caption);
    if (!left && !right) return null;

    return (
        <figure className="m-0 px-5 sm:px-8">
            {/* Cropped to a shared 4:5 so the two sit as an even pair. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                {left && (
                    <Frame
                        image={left}
                        ratio={4 / 5}
                        sizes="(min-width: 640px) 50vw, 100vw"
                        onOpen={() => open(0)}
                    />
                )}
                {right && (
                    <Frame
                        image={right}
                        ratio={4 / 5}
                        sizes="(min-width: 640px) 50vw, 100vw"
                        onOpen={() => open(block.images.indexOf(right))}
                    />
                )}
            </div>
            <Caption>{caption}</Caption>
            {lightbox}
        </figure>
    );
}
