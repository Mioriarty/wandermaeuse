import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Button } from '@/Components/Admin/Ui';
import { formatShortDate } from '@/lib/format';
import type { CommentImageProps } from '@/types';

type Row = {
    id: number;
    authorName: string;
    authorEmail: string | null;
    body: string;
    replyToName: string | null;
    replyCount: number;
    images: CommentImageProps[];
    createdAt: string | null;
    post: { title: string; slug: string } | null;
};

type Paginated = { data: Row[]; links: { url: string | null; label: string; active: boolean }[] };

export default function Comments({ comments }: { comments: Paginated }) {
    const [selected, setSelected] = useState<number[]>([]);

    const toggle = (id: number) =>
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const deleteSelected = () => {
        if (!window.confirm(`${selected.length} Kommentar(e) samt Antworten wirklich löschen?`)) return;
        router.delete('/admin/kommentare', {
            data: { ids: selected },
            preserveScroll: true,
            onSuccess: () => setSelected([]),
        });
    };

    return (
        <AdminLayout
            title="Kommentare"
            actions={
                selected.length > 0 ? (
                    <Button variant="danger" onClick={deleteSelected}>
                        {selected.length} löschen
                    </Button>
                ) : undefined
            }
        >
            <Head title="Kommentare" />

            <p className="mb-6 text-sm text-graphite">
                Kommentare erscheinen sofort auf der Website. Was hier gelöscht wird, ist dort sofort weg.
            </p>

            <div className="border border-hairline bg-paper">
                {comments.data.length === 0 && (
                    <p className="px-5 py-8 text-center text-graphite">Noch keine Kommentare.</p>
                )}

                {comments.data.map((comment) => (
                    <article key={comment.id} className="hairline-b flex gap-4 px-5 py-4 last:border-b-0">
                        <input
                            type="checkbox"
                            checked={selected.includes(comment.id)}
                            onChange={() => toggle(comment.id)}
                            aria-label={`Kommentar von ${comment.authorName} auswählen`}
                            className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="label-xs text-graphite">
                                <span className="text-ink">{comment.authorName}</span>
                                {comment.authorEmail && <> · {comment.authorEmail}</>}
                                {comment.replyToName && <> · Antwort an {comment.replyToName}</>}
                                {comment.post && <> · zu „{comment.post.title}“</>} ·{' '}
                                {formatShortDate(comment.createdAt)}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                                {comment.body}
                            </p>
                            {comment.images.length > 0 && (
                                <div className="mt-3 flex gap-2">
                                    {comment.images.map((image) => (
                                        <a key={image.id} href={image.src} target="_blank" rel="noopener">
                                            <img src={image.thumb} alt="" className="h-20 w-20 object-cover" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                            {comment.post && (
                                <a
                                    href={`/blog/${comment.post.slug}`}
                                    target="_blank"
                                    rel="noopener"
                                    className="label-xs border border-hairline px-3 py-2 text-center hover:bg-ink hover:text-paper"
                                >
                                    Ansehen
                                </a>
                            )}
                            <Button
                                variant="danger"
                                onClick={() => {
                                    const replies =
                                        comment.replyCount === 0
                                            ? ''
                                            : comment.replyCount === 1
                                              ? ' Die Antwort darauf wird mit gelöscht.'
                                              : ` Die ${comment.replyCount} Antworten darauf werden mit gelöscht.`;
                                    if (window.confirm(`Diesen Kommentar löschen?${replies}`)) {
                                        router.delete(`/admin/kommentare/${comment.id}`, { preserveScroll: true });
                                    }
                                }}
                            >
                                Löschen
                            </Button>
                        </div>
                    </article>
                ))}
            </div>

            {comments.links.length > 3 && (
                <nav className="mt-6 flex flex-wrap gap-1" aria-label="Seiten">
                    {comments.links.map((link, i) => (
                        <button
                            key={i}
                            type="button"
                            disabled={!link.url}
                            onClick={() => link.url && router.visit(link.url)}
                            className={`label-xs min-h-9 border px-3 ${
                                link.active ? 'border-ink bg-ink text-paper' : 'border-hairline bg-paper text-graphite'
                            } disabled:opacity-30`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </nav>
            )}
        </AdminLayout>
    );
}
