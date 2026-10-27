import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import BlockEditor, { type BlockTypeOption, type EditorBlock } from '@/Components/Admin/BlockEditor';
import MediaPicker from '@/Components/Admin/MediaPicker';
import { MediaLibraryProvider } from '@/Components/Admin/MediaLibrary';
import { Button, Field, Panel, inputClass } from '@/Components/Admin/Ui';
import CompositionForm from '@/Components/Admin/CompositionForm';
import type { BlockProps, CompositionProps, LibraryImage } from '@/types';

type PostForm = {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    stop_id: number | null;
    period_starts_on: string | null;
    period_ends_on: string | null;
    cover_media_id: number | null;
    status: string;
    published_at: string | null;
};

type Props = {
    post: PostForm | null;
    blocks: BlockProps[];
    composition: CompositionProps | null;
    stops: { id: number; name: string; country: string }[];
    blockTypes: BlockTypeOption[];
    mediaLibrary: LibraryImage[];
};

export default function PostEdit({ post, blocks, composition, stops, blockTypes, mediaLibrary }: Props) {
    const [editorBlocks, setEditorBlocks] = useState<EditorBlock[]>(() =>
        blocks.map((block) => ({ key: `b-${block.id}`, type: block.type, data: block.data })),
    );

    const form = useForm({
        title: post?.title ?? '',
        slug: post?.slug ?? '',
        excerpt: post?.excerpt ?? '',
        stop_id: post?.stop_id ?? null,
        period_starts_on: post?.period_starts_on ?? '',
        period_ends_on: post?.period_ends_on ?? '',
        cover_media_id: post?.cover_media_id ?? null,
        status: post?.status ?? 'draft',
        published_at: post?.published_at ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        // Blocks ride along via transform rather than living in the form state:
        // they are nested free-form objects, which the form data type does not
        // model, and the editor owns their order anyway.
        form.transform((data) => ({
            ...data,
            blocks: editorBlocks.map((block) => ({ type: block.type, data: block.data })),
        }));

        if (post) {
            form.put(`/admin/eintraege/${post.id}`, { preserveScroll: true });
        } else {
            form.post('/admin/eintraege');
        }
    };

    return (
        <AdminLayout
            title={post ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
            actions={
                <>
                    {post && (
                        <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener"
                            className="label-xs min-h-10 border border-hairline px-4 py-3 hover:bg-ink hover:text-paper"
                        >
                            Vorschau ↗
                        </a>
                    )}
                    <Button onClick={() => router.visit('/admin/eintraege')} variant="ghost">
                        Zurück
                    </Button>
                </>
            }
        >
            <Head title={post ? post.title : 'Neuer Eintrag'} />

            <MediaLibraryProvider initial={mediaLibrary}>
                <form onSubmit={submit} className="grid gap-6 xl:grid-cols-3">
                    <div className="flex flex-col gap-6 xl:col-span-2">
                        <Panel title="Grunddaten">
                            <div className="flex flex-col gap-4">
                                <Field label="Titel" error={form.errors.title}>
                                    <input
                                        className={inputClass}
                                        value={form.data.title}
                                        onChange={(e) => form.setData('title', e.target.value)}
                                        required
                                    />
                                </Field>

                                <Field
                                    label="URL-Kürzel"
                                    error={form.errors.slug}
                                    hint="Leer lassen, dann wird es aus dem Titel gebildet."
                                >
                                    <input
                                        className={inputClass}
                                        value={form.data.slug}
                                        onChange={(e) => form.setData('slug', e.target.value)}
                                        placeholder="z-b-erste-tage-in-lima"
                                    />
                                </Field>

                                <Field
                                    label="Anriss"
                                    error={form.errors.excerpt}
                                    hint="Erscheint in der Liste, im Newsletter und in der Linkvorschau."
                                >
                                    <textarea
                                        className={inputClass}
                                        rows={3}
                                        value={form.data.excerpt ?? ''}
                                        onChange={(e) => form.setData('excerpt', e.target.value)}
                                    />
                                </Field>
                            </div>
                        </Panel>

                        <Panel title="Abschnitte">
                            <BlockEditor blocks={editorBlocks} onChange={setEditorBlocks} blockTypes={blockTypes} />
                        </Panel>

                        {post ? (
                            <CompositionForm postId={post.id} composition={composition} />
                        ) : (
                            <Panel title="Komposition">
                                <p className="text-sm text-graphite">
                                    Speichere den Eintrag einmal, dann kannst du hier die Komposition und die
                                    Noten hochladen.
                                </p>
                            </Panel>
                        )}
                    </div>

                    <div className="flex flex-col gap-6">
                        <Panel
                            title="Veröffentlichung"
                            footer={
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs text-graphite">
                                        {form.isDirty ? 'Nicht gespeicherte Änderungen' : 'Alles gespeichert'}
                                    </span>
                                    <Button type="submit" disabled={form.processing}>
                                        {form.processing ? 'Speichert …' : 'Speichern'}
                                    </Button>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-4">
                                <Field label="Status" error={form.errors.status}>
                                    <select
                                        className={inputClass}
                                        value={form.data.status}
                                        onChange={(e) => form.setData('status', e.target.value)}
                                    >
                                        <option value="draft">Entwurf</option>
                                        <option value="scheduled">Geplant</option>
                                        <option value="published">Veröffentlicht</option>
                                    </select>
                                </Field>

                                <Field
                                    label="Datum"
                                    error={form.errors.published_at}
                                    hint="Bei „Geplant“ erscheint der Eintrag automatisch zu diesem Zeitpunkt."
                                >
                                    <input
                                        type="datetime-local"
                                        className={inputClass}
                                        value={form.data.published_at ?? ''}
                                        onChange={(e) => form.setData('published_at', e.target.value)}
                                    />
                                </Field>

                                <Field label="Station" error={form.errors.stop_id}>
                                    <select
                                        className={inputClass}
                                        value={form.data.stop_id ?? ''}
                                        onChange={(e) =>
                                            form.setData('stop_id', e.target.value ? Number(e.target.value) : null)
                                        }
                                    >
                                        <option value="">– keine –</option>
                                        {stops.map((stop) => (
                                            <option key={stop.id} value={stop.id}>
                                                {stop.name}, {stop.country}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field
                                    label="Erlebt von"
                                    error={form.errors.period_starts_on}
                                    hint="Welche Tage der Eintrag erzählt. Freiwillig."
                                >
                                    <input
                                        type="date"
                                        className={inputClass}
                                        value={form.data.period_starts_on ?? ''}
                                        onChange={(e) => form.setData('period_starts_on', e.target.value)}
                                    />
                                </Field>

                                <Field
                                    label="Erlebt bis"
                                    error={form.errors.period_ends_on}
                                    hint="Leer lassen, wenn es um einen einzigen Tag geht."
                                >
                                    <input
                                        type="date"
                                        className={inputClass}
                                        value={form.data.period_ends_on ?? ''}
                                        min={form.data.period_starts_on || undefined}
                                        onChange={(e) => form.setData('period_ends_on', e.target.value)}
                                    />
                                </Field>
                            </div>
                        </Panel>

                        <Panel title="Titelbild">
                            <MediaPicker
                                label="Bild für Liste und Linkvorschau"
                                title="Titelbild wählen"
                                selected={form.data.cover_media_id}
                                onSelect={(id) => form.setData('cover_media_id', id)}
                            />
                        </Panel>
                    </div>
                </form>
            </MediaLibraryProvider>
        </AdminLayout>
    );
}
