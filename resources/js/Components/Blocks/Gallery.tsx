import { useCallback, useEffect, useRef, useState } from 'react';
import Caption from '@/Components/Caption';
import Frame from '@/Components/Frame';
import type { BlockProps } from '@/types';

/**
 * Eine Bildstrecke in einer Reihe: zwei Bilder nebeneinander auf dem Handy,
 * drei auf dem Rechner. Passen nicht alle hinein, wird nicht umgebrochen,
 * sondern gewischt - Punkte darunter zeigen, wo man steht, auf dem Rechner
 * kommen Pfeile an den Seiten dazu. Passt alles, bleiben beide weg.
 */
export default function Gallery({ block }: { block: BlockProps }) {
    const railRef = useRef<HTMLUListElement | null>(null);
    const [positions, setPositions] = useState(1);
    const [active, setActive] = useState(0);

    // Abstand von einem Bild zum naechsten, Luecke eingerechnet.
    const step = useCallback(() => {
        const slides = railRef.current?.children;
        if (!slides || slides.length < 2) return 0;
        return (slides[1] as HTMLElement).offsetLeft - (slides[0] as HTMLElement).offsetLeft;
    }, []);

    const sync = useCallback(() => {
        const rail = railRef.current;
        const width = step();
        if (!rail || width === 0) return;
        const max = rail.scrollWidth - rail.clientWidth;
        // 1px Toleranz: gebrochene Geraetepixel erreichen das Maximum nie exakt.
        const count = max <= 1 ? 1 : Math.round(max / width) + 1;
        setPositions(count);
        setActive(Math.min(count - 1, Math.round(rail.scrollLeft / width)));
    }, [step]);

    useEffect(() => {
        const rail = railRef.current;
        if (!rail) return;
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(rail);
        return () => observer.disconnect();
    }, [sync, block.images.length]);

    const goTo = (index: number) => {
        railRef.current?.scrollTo({ left: index * step(), behavior: 'smooth' });
    };

    if (block.images.length === 0) return null;

    const caption = (block.data.caption as string) ?? '';
    const scrollable = positions > 1;

    return (
        <figure className="m-0 px-5 sm:px-8" aria-roledescription="Bildergalerie">
            <div className="relative">
                <ul
                    ref={railRef}
                    onScroll={sync}
                    className="rail m-0 list-none gap-3 p-0 sm:gap-4"
                >
                    {block.images.map((image) => (
                        <li
                            key={image.id}
                            className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)]"
                        >
                            <Frame
                                image={image}
                                ratio={4 / 5}
                                sizes="(min-width: 768px) 33vw, 50vw"
                            />
                        </li>
                    ))}
                </ul>

                {scrollable && (
                    <>
                        <Arrow
                            direction="left"
                            hidden={active === 0}
                            onClick={() => goTo(active - 1)}
                        />
                        <Arrow
                            direction="right"
                            hidden={active === positions - 1}
                            onClick={() => goTo(active + 1)}
                        />
                    </>
                )}
            </div>

            {scrollable && (
                <div className="mt-2 flex justify-center">
                    {Array.from({ length: positions }, (_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goTo(i)}
                            aria-label={`Zu Bild ${i + 1}`}
                            aria-current={i === active}
                            className="group flex h-11 w-6 items-center justify-center"
                        >
                            <span
                                className={`block h-1.5 w-1.5 transition-colors ${
                                    i === active ? 'bg-ink' : 'bg-hairline group-hover:bg-graphite'
                                }`}
                            />
                        </button>
                    ))}
                </div>
            )}

            <Caption>{caption}</Caption>
        </figure>
    );
}

function Arrow({
    direction,
    hidden,
    onClick,
}: {
    direction: 'left' | 'right';
    hidden: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            tabIndex={hidden ? -1 : 0}
            aria-hidden={hidden}
            aria-label={direction === 'left' ? 'Vorheriges Bild' : 'Nächstes Bild'}
            className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-hairline bg-paper/90 text-base transition-opacity hover:border-ink sm:flex ${
                direction === 'left' ? 'left-3' : 'right-3'
            } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
            {direction === 'left' ? '←' : '→'}
        </button>
    );
}
