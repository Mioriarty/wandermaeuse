import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Panel } from '@/Components/Admin/Ui';
import { formatDay, formatNights, formatShortDate } from '@/lib/format';
import type { NightsAhead } from '@/types';

type Props = {
    stats: Record<string, number>;
    nightsAhead: NightsAhead;
    recentPosts: { id: number; title: string; status: string; updatedAt: string | null }[];
    recentComments: {
        id: number;
        authorName: string;
        body: string;
        postTitle: string | null;
        createdAt: string | null;
    }[];
};

const STAT_LABELS: [key: string, label: string][] = [
    ['published', 'Veröffentlicht'],
    ['drafts', 'Entwürfe'],
    ['stops', 'Stationen'],
    ['media', 'Bilder'],
    ['comments', 'Kommentare'],
    ['subscribers', 'Newsletter'],
];

export default function Dashboard({ stats, nightsAhead, recentPosts, recentComments }: Props) {
    return (
        <AdminLayout title="Übersicht">
            <Head title="Übersicht" />

            <dl className="mb-8 grid grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-6">
                {STAT_LABELS.map(([key, label]) => (
                    <div key={key} className="bg-paper px-4 py-5">
                        <dt className="label-xs text-graphite">{label}</dt>
                        <dd className="mt-2 font-ui text-3xl font-bold tabular-nums">{stats[key] ?? 0}</dd>
                    </div>
                ))}
            </dl>

            <NightsNotice ahead={nightsAhead} />

            {stats.pendingSubscribers > 0 && (
                <p className="mb-8 border border-hairline bg-paper px-5 py-3 text-sm text-graphite">
                    {stats.pendingSubscribers} Anmeldung(en) warten noch auf die Bestätigung per E-Mail.
                </p>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Zuletzt bearbeitet">
                    {recentPosts.length === 0 ? (
                        <p className="text-sm text-graphite">Noch keine Einträge.</p>
                    ) : (
                        <ul className="flex flex-col">
                            {recentPosts.map((post) => (
                                <li key={post.id} className="hairline-b py-2 last:border-b-0">
                                    <Link
                                        href={`/admin/eintraege/${post.id}`}
                                        className="flex items-center justify-between gap-4 hover:text-accent"
                                    >
                                        <span className="truncate text-sm">{post.title}</span>
                                        <span className="label-xs shrink-0 text-graphite">
                                            {post.status === 'published' ? 'live' : post.status} ·{' '}
                                            {formatShortDate(post.updatedAt)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="Neueste Kommentare">
                    {recentComments.length === 0 ? (
                        <p className="text-sm text-graphite">Noch keine Kommentare.</p>
                    ) : (
                        <ul className="flex flex-col">
                            {recentComments.map((comment) => (
                                <li key={comment.id} className="hairline-b py-3 last:border-b-0">
                                    <p className="label-xs text-graphite">
                                        {comment.authorName} · {comment.postTitle} ·{' '}
                                        {formatShortDate(comment.createdAt)}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{comment.body}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </AdminLayout>
    );
}

/** Ob die naechsten Naechte versorgt sind - der Grund, die Verwaltung ueberhaupt zu oeffnen. */
function NightsNotice({ ahead }: { ahead: NightsAhead }) {
    const firstGap = ahead.gaps.find((gap) => gap.state === 'missing');
    const open = ahead.missing > 0;

    return (
        <Link
            href="/admin/unterkuenfte"
            className={`mb-8 flex flex-wrap items-center justify-between gap-4 border px-5 py-3 text-sm hover:bg-ink hover:text-paper ${
                open ? 'border-error bg-paper text-error' : 'border-hairline bg-paper text-graphite'
            }`}
        >
            <span>
                {open
                    ? `${formatNights(ahead.missing)} in den nächsten 30 Tagen ohne Unterkunft – die erste am ${formatDay(firstGap?.from ?? ahead.from)}.`
                    : 'Für die nächsten 30 Nächte ist ein Schlafplatz eingetragen.'}
                {ahead.planned > 0 && ` ${formatNights(ahead.planned)} nur geplant.`}
                {ahead.doubleBooked > 0 && ` ${formatNights(ahead.doubleBooked)} doppelt gebucht.`}
            </span>
            <span className="label-xs">Unterkünfte →</span>
        </Link>
    );
}
