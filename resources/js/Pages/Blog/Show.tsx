import { Head, Link } from '@inertiajs/react';
import BlockRenderer from '@/Components/Blocks';
import CommentSection from '@/Components/CommentSection';
import CompositionPlayer from '@/Components/CompositionPlayer';
import NewsletterForm from '@/Components/NewsletterForm';
import RouteMap from '@/Components/RouteMap';
import PublicLayout from '@/Layouts/PublicLayout';
import { formatPostDate } from '@/lib/format';
import type { BlockProps, CommentProps, CompositionProps, PostCard, PostPeriod, StopProps } from '@/types';

type Props = {
    post: {
        id: number;
        title: string;
        slug: string;
        excerpt: string | null;
        publishedAt: string | null;
        readingMinutes: number;
        period: PostPeriod | null;
        stop: StopProps | null;
        status: string;
    };
    /** Angemeldet und noch nicht veroeffentlicht: nur du siehst das hier. */
    isPreview: boolean;
    blocks: BlockProps[];
    composition: CompositionProps | null;
    comments: CommentProps[];
    stops: StopProps[];
    neighbours: { previous: PostCard | null; next: PostCard | null };
};

const PREVIEW_LABEL: Record<string, string> = {
    draft: 'Entwurf',
    scheduled: 'Geplant',
};

export default function BlogShow({
    post,
    isPreview,
    blocks,
    composition,
    comments,
    stops,
    neighbours,
}: Props) {
    return (
        <PublicLayout>
            <Head title={post.title} />

            {isPreview && (
                /*
                  Die Seite sieht sonst genauso aus wie eine veroeffentlichte -
                  ohne diesen Streifen haelt man einen Entwurf leicht fuer live.
                */
                <p
                    role="status"
                    className="label-xs flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-5 py-3 text-center text-paper"
                >
                    <span>Vorschau · {PREVIEW_LABEL[post.status] ?? post.status}</span>
                    <span className="font-sans normal-case tracking-normal opacity-90">
                        Nur für dich sichtbar, solange du angemeldet bist.
                    </span>
                </p>
            )}

            <article>
                <header className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
                    <div className="label-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-graphite">
                        {post.stop && (
                            <span>
                                {post.stop.name}, {post.stop.country}
                            </span>
                        )}
                        <span>{formatPostDate(post)}</span>
                        <span>{post.readingMinutes} Min. Lesezeit</span>
                    </div>
                    <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.5rem,8vw,5.5rem)] leading-[1] text-balance">
                        {post.title}
                    </h1>
                    {post.excerpt && (
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-graphite">{post.excerpt}</p>
                    )}
                </header>

                {/* 1. Where this entry sits on the whole journey. */}
                {stops.length > 0 && (
                    <section className="mx-auto mt-10 max-w-6xl px-5 sm:px-8" aria-label="Ort dieses Eintrags">
                        <h2 className="label-xs hairline-t py-3 text-graphite">
                            {post.stop ? `Station: ${post.stop.name}` : 'Unsere Route'}
                        </h2>
                        <RouteMap stops={stops} focusStopId={post.stop?.id ?? null} variant="compact" />
                    </section>
                )}

                {/* 2. The piece that belongs to it. */}
                {composition && (
                    <div className="mt-12">
                        <CompositionPlayer composition={composition} />
                    </div>
                )}

                {/* 3. The entry itself. */}
                <div className="mt-16 sm:mt-20">
                    <BlockRenderer blocks={blocks} />
                </div>
            </article>

            <nav className="mx-auto mt-20 max-w-6xl px-5 sm:px-8" aria-label="Weitere Einträge">
                <div className="grid gap-px bg-hairline sm:grid-cols-2">
                    <NeighbourLink post={neighbours.previous} direction="previous" />
                    <NeighbourLink post={neighbours.next} direction="next" />
                </div>
            </nav>

            <div className="mt-20">
                <CommentSection postSlug={post.slug} comments={comments} />
            </div>

            <section className="mx-auto mt-20 max-w-2xl px-5 sm:px-8">
                <NewsletterForm />
            </section>
        </PublicLayout>
    );
}

function NeighbourLink({ post, direction }: { post: PostCard | null; direction: 'previous' | 'next' }) {
    const label = direction === 'previous' ? '← Vorheriger Eintrag' : 'Nächster Eintrag →';

    if (!post) {
        return <div className="bg-paper px-5 py-8 sm:px-6" aria-hidden />;
    }

    return (
        <Link
            href={`/blog/${post.slug}`}
            className={`group bg-paper px-5 py-8 transition-colors hover:bg-paper-dim sm:px-6 ${
                direction === 'next' ? 'sm:text-right' : ''
            }`}
        >
            <span className="label-xs text-graphite">{label}</span>
            <span className="mt-2 block font-display text-2xl font-medium leading-[1.15] text-balance group-hover:text-accent">
                {post.title}
            </span>
        </Link>
    );
}
