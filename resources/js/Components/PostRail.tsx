import { Link } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Frame from '@/Components/Frame';
import { formatDate } from '@/lib/format';
import type { PostCard as PostCardType } from '@/types';

/**
 * Die neuesten Eintraege als waagerechte Schiene.
 *
 * Auf dem Handy wird gewischt, auf dem Rechner zeigen zwei Pfeile, dass es
 * rechts weitergeht - ohne sie sieht eine Schiene auf einem grossen Bildschirm
 * aus wie eine Reihe, die zufaellig am Rand endet.
 */
export default function PostRail({ posts }: { posts: PostCardType[] }) {
    const railRef = useRef<HTMLUListElement | null>(null);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    const sync = useCallback(() => {
        const rail = railRef.current;
        if (!rail) return;
        const max = rail.scrollWidth - rail.clientWidth;
        setAtStart(rail.scrollLeft <= 1);
        // 1px Toleranz: gebrochene Geraetepixel erreichen das Maximum nie exakt.
        setAtEnd(max <= 1 || rail.scrollLeft >= max - 1);
    }, []);

    useEffect(() => {
        sync();
        window.addEventListener('resize', sync);
        return () => window.removeEventListener('resize', sync);
    }, [sync, posts]);

    const nudge = (direction: -1 | 1) => {
        const rail = railRef.current;
        if (!rail) return;
        const card = rail.querySelector('li');
        const step = card ? card.getBoundingClientRect().width + 20 : rail.clientWidth * 0.8;
        rail.scrollBy({ left: step * direction, behavior: 'smooth' });
    };

    return (
        <section id="eintraege" className="scroll-mt-14 sm:scroll-mt-18" aria-label="Neueste Einträge">
            <div className="mx-auto flex max-w-[100rem] flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 sm:px-8">
                <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-none">
                    Neueste Einträge
                </h2>

                <div className="flex items-center gap-6">
                    <div className="hidden gap-2 sm:flex" aria-hidden>
                        <Arrow direction="left" disabled={atStart} onClick={() => nudge(-1)} />
                        <Arrow direction="right" disabled={atEnd} onClick={() => nudge(1)} />
                    </div>
                    <Link href="/blog" className="label-xs link-underline flex min-h-11 items-center">
                        Alle Einträge
                    </Link>
                </div>
            </div>

            <ul
                ref={railRef}
                onScroll={sync}
                className="rail mx-auto mt-8 max-w-[100rem] gap-5 scroll-px-5 px-5 pb-2 sm:mt-10 sm:scroll-px-8 sm:px-8"
            >
                {posts.map((post) => (
                    <li
                        key={post.id}
                        className="w-[78vw] max-w-[26rem] shrink-0 snap-start sm:w-[46vw] lg:w-[30vw]"
                    >
                        <Link href={`/blog/${post.slug}`} className="group block">
                            {post.cover ? (
                                <Frame
                                    image={post.cover}
                                    ratio={4 / 5}
                                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 78vw"
                                    className="transition-opacity duration-300 group-hover:opacity-85"
                                />
                            ) : (
                                <div className="w-full bg-paper-deep" style={{ aspectRatio: '4 / 5' }} />
                            )}

                            <h3 className="mt-5 font-display text-2xl font-medium leading-[1.15] text-balance transition-colors group-hover:text-accent sm:text-[1.75rem]">
                                {post.title}
                            </h3>

                            <p className="label-xs mt-2 flex flex-wrap gap-x-3 gap-y-1 text-graphite">
                                <span>{formatDate(post.publishedAt)}</span>
                                {post.stop && <span>{post.stop.name}</span>}
                            </p>

                            {post.excerpt && (
                                <p className="mt-3 text-sm leading-relaxed text-graphite">{post.excerpt}</p>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function Arrow({
    direction,
    disabled,
    onClick,
}: {
    direction: 'left' | 'right';
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            tabIndex={-1}
            aria-label={direction === 'left' ? 'Zurück' : 'Weiter'}
            className="flex h-11 w-11 items-center justify-center border border-hairline text-base transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-hairline"
        >
            {direction === 'left' ? '←' : '→'}
        </button>
    );
}
