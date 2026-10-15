import type { ImageProps } from '@/types';

type Props = {
    image: ImageProps;
    sizes?: string;
    className?: string;
    priority?: boolean;
    /** Crop to a fixed ratio instead of honouring the photo's own. */
    ratio?: number;
    /**
     * Fill the nearest positioned ancestor instead of bringing an own box.
     * This is how the title photograph covers the whole opening screen, whose
     * height comes from the viewport rather than from the photo.
     */
    fill?: boolean;
    /** Makes the photo a button that opens it large, in the lightbox. */
    onOpen?: () => void;
};

/**
 * A photograph in a hard-edged frame.
 *
 * The box is sized from the stored aspect ratio and painted in the image's
 * dominant colour before the file arrives, so nothing on the page jumps while
 * a long entry loads over a slow connection.
 */
export default function Frame({
    image,
    sizes = '100vw',
    className = '',
    priority = false,
    ratio,
    fill = false,
    onOpen,
}: Props) {
    const aspect = ratio ?? image.aspectRatio ?? 1;
    const box = {
        className: fill
            ? `absolute inset-0 overflow-hidden ${className}`
            : `relative w-full overflow-hidden ${className}`,
        style: fill
            ? { backgroundColor: image.dominantColor }
            : { aspectRatio: String(aspect), backgroundColor: image.dominantColor },
    };

    const picture = (
        <picture>
            <source type="image/webp" srcSet={image.srcset} sizes={sizes} />
            <img
                src={image.src}
                srcSet={image.jpegSrcset}
                sizes={sizes}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading={priority ? 'eager' : 'lazy'}
                decoding={priority ? 'sync' : 'async'}
                fetchPriority={priority ? 'high' : 'auto'}
                className="absolute inset-0 h-full w-full object-cover"
            />
        </picture>
    );

    if (onOpen) {
        return (
            <button
                type="button"
                onClick={onOpen}
                aria-label={image.alt ? `Bild vergrößern: ${image.alt}` : 'Bild vergrößern'}
                {...box}
                className={`block cursor-zoom-in ${box.className}`}
            >
                {picture}
            </button>
        );
    }

    return <div {...box}>{picture}</div>;
}
