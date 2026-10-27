import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Button } from '@/Components/Admin/Ui';
import { formatPeriod, formatShortDate } from '@/lib/format';
import type { PostPeriod } from '@/types';

type Row = {
    id: number;
    title: string;
    slug: string;
    status: string;
    publishedAt: string | null;
    period: PostPeriod | null;
    /** Set while readers cannot see the entry yet - also when "published" with a date still ahead. */
    previewLabel: string | null;
    stopName: string | null;
};

const STATUS: Record<string, string> = {
    draft: 'Entwurf',
    scheduled: 'Geplant',
    published: 'Veröffentlicht',
};

export default function PostsIndex({ posts }: { posts: Row[] }) {
    return (
        <AdminLayout
            title="Einträge"
            actions={
                <Link href="/admin/eintraege/neu" className="label-xs min-h-10 bg-ink px-4 py-3 text-paper hover:bg-accent">
                    Neuer Eintrag
                </Link>
            }
        >
            <Head title="Einträge" />

            <div className="border border-hairline bg-paper">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="hairline-b">
                            <th className="label-xs px-4 py-3 text-left text-graphite">Titel</th>
                            <th className="label-xs px-4 py-3 text-left text-graphite">Station</th>
                            <th className="label-xs px-4 py-3 text-left text-graphite">Status</th>
                            <th className="label-xs px-4 py-3 text-left text-graphite">Zeitraum</th>
                            <th className="label-xs px-4 py-3 text-right text-graphite">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-graphite">
                                    Noch keine Einträge angelegt.
                                </td>
                            </tr>
                        )}
                        {posts.map((post) => (
                            <tr key={post.id} className="hairline-b last:border-b-0">
                                <td className="px-4 py-3">
                                    <Link href={`/admin/eintraege/${post.id}`} className="font-medium hover:text-accent">
                                        {post.title}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-graphite">{post.stopName ?? '–'}</td>
                                <td className="px-4 py-3">
                                    <span className={post.status === 'published' ? 'text-ink' : 'text-graphite'}>
                                        {STATUS[post.status] ?? post.status}
                                    </span>
                                    {/* A draft's date is only a plan nobody has committed to yet. */}
                                    {post.status !== 'draft' && post.publishedAt && (
                                        <span className="block text-xs text-graphite tabular-nums">
                                            {formatShortDate(post.publishedAt)}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-graphite tabular-nums">
                                    {post.period ? formatPeriod(post.period.from, post.period.until) : '–'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <a
                                            href={`/blog/${post.slug}`}
                                            target="_blank"
                                            rel="noopener"
                                            className="label-xs inline-flex min-h-10 items-center border border-hairline px-4 hover:bg-ink hover:text-paper"
                                        >
                                            {post.previewLabel ? 'Vorschau' : 'Ansehen'}
                                        </a>
                                        <Button
                                            variant="danger"
                                            onClick={() => {
                                                if (window.confirm(`„${post.title}“ wirklich löschen?`)) {
                                                    router.delete(`/admin/eintraege/${post.id}`);
                                                }
                                            }}
                                        >
                                            Löschen
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
