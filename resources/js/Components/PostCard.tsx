import { Link } from '@inertiajs/react';
import Frame from '@/Components/Frame';
import { formatDate } from '@/lib/format';
import type { PostCard as PostCardType } from '@/types';

export default function PostCard({ post, index }: { post: PostCardType; index: number }) {
    return (
        <article className="hairline-t group">
            <Link href={`/blog/${post.slug}`} className="grid gap-5 py-8 sm:grid-cols-12 sm:gap-8 sm:py-10">
                <div className="sm:col-span-5 lg:col-span-4">
                    {post.cover ? (
                        <Frame
                            image={post.cover}
                            ratio={4 / 3}
                            sizes="(min-width: 640px) 40vw, 100vw"
                            className="transition-opacity group-hover:opacity-90"
                        />
                    ) : (
                        <div className="w-full bg-paper-deep" style={{ aspectRatio: '4 / 3' }} />
                    )}
                </div>

                <div className="sm:col-span-7 lg:col-span-8">
                    <div className="label-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-graphite">
                        <span aria-hidden className="tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        {post.stop && (
                            <span>
                                {post.stop.name}, {post.stop.country}
                            </span>
                        )}
                        <span>{formatDate(post.publishedAt)}</span>
                    </div>

                    <h2 className="mt-3 font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium leading-[1.1] text-balance transition-colors group-hover:text-accent">
                        {post.title}
                    </h2>

                    {post.excerpt && (
                        <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-graphite">
                            {post.excerpt}
                        </p>
                    )}

                    <p className="label-xs mt-4 text-graphite">{post.readingMinutes} Min. Lesezeit</p>
                </div>
            </Link>
        </article>
    );
}
