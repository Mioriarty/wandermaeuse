import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import RouteMap from '@/Components/RouteMap';
import { formatStay } from '@/lib/format';
import { useState } from 'react';
import type { StopProps } from '@/types';

type StopWithPosts = StopProps & {
    note: string | null;
    posts: { title: string; slug: string }[];
};

export default function Reise({ stops }: { stops: StopWithPosts[] }) {
    const [focus, setFocus] = useState<number | null>(null);

    return (
        <PublicLayout>
            <Head title="Die Route" />

            <div className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-20">
                <p className="label-xs text-graphite">{stops.length} Stationen</p>
                <h1 className="mt-4 font-display text-[clamp(2.5rem,8vw,5.5rem)] leading-[1]">
                    Die Route
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-graphite">
                    Tippe eine Station an – die Liste springt zur passenden Stelle.
                </p>
            </div>

            <div className="mx-auto mt-10 max-w-6xl px-5 sm:px-8">
                <RouteMap
                    stops={stops}
                    focusStopId={focus}
                    onSelect={(stop) => {
                        setFocus(stop.id);
                        document.getElementById(stop.slug)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                />
            </div>

            <ol className="mx-auto mt-16 max-w-6xl px-5 sm:px-8">
                {stops.map((stop, i) => (
                    <li
                        key={stop.id}
                        id={stop.slug}
                        onMouseEnter={() => setFocus(stop.id)}
                        onMouseLeave={() => setFocus(null)}
                        className="hairline-t grid gap-3 py-7 sm:grid-cols-12 sm:gap-8"
                    >
                        <div className="label-xs flex gap-4 text-graphite sm:col-span-3 sm:block">
                            <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                            <span className="sm:mt-1 sm:block">{formatStay(stop)}</span>
                        </div>
                        <div className="sm:col-span-9">
                            <h2 className="font-display text-2xl font-medium leading-tight sm:text-3xl">
                                {stop.name}
                                <span className="ml-3 font-sans text-sm font-medium text-graphite">{stop.country}</span>
                            </h2>
                            {stop.note && (
                                <p className="mt-2 max-w-prose leading-relaxed text-graphite">{stop.note}</p>
                            )}
                            {stop.posts.length > 0 && (
                                <ul className="mt-4 flex flex-col gap-2">
                                    {stop.posts.map((post) => (
                                        <li key={post.slug}>
                                            <Link
                                                href={`/blog/${post.slug}`}
                                                className="label-xs inline-flex min-h-11 items-center hover:text-accent"
                                            >
                                                {post.title} ↗
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </PublicLayout>
    );
}
