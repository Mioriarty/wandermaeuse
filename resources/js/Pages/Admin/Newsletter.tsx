import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Button, Field, Panel, inputClass } from '@/Components/Admin/Ui';
import { formatShortDate } from '@/lib/format';

type Subscriber = {
    id: number;
    email: string;
    confirmedAt: string | null;
    unsubscribedAt: string | null;
    createdAt: string | null;
};

type Campaign = {
    id: number;
    subject: string;
    intro: string | null;
    status: string;
    postTitle: string | null;
    recipientCount: number;
    sentCount: number;
    sentAt: string | null;
};

type PostOption = {
    id: number;
    title: string;
    excerpt: string | null;
    stop: { name: string; country: string } | null;
};

type Props = {
    subscribers: Subscriber[];
    campaigns: Campaign[];
    posts: PostOption[];
    mailableCount: number;
};

/**
 * A warm starting point for announcing an entry. Only a suggestion: it lands
 * in the form fields and is meant to be edited before saving.
 */
function suggestCampaign(post: PostOption): { subject: string; intro: string } {
    const place = post.stop ? `${post.stop.name}, ${post.stop.country}` : null;

    const subject = post.stop ? `Neues aus ${post.stop.name}: ${post.title}` : `Neu im Reiseblog: ${post.title}`;

    const paragraphs = [
        'Hallo und schön, dass du dabei bist!',
        place
            ? `Unser neuer Eintrag „${post.title}“ ist online – diesmal melden wir uns aus ${place}.`
            : `Unser neuer Eintrag „${post.title}“ ist online, frisch von unterwegs.`,
        post.excerpt?.trim(),
        'Mach es dir gemütlich, hol dir einen Kaffee und komm ein Stück mit uns mit. Wir freuen uns riesig, wenn du reinliest – und noch mehr über ein paar Zeilen von dir in den Kommentaren.',
    ];

    return { subject, intro: paragraphs.filter(Boolean).join('\n\n') };
}

export default function Newsletter({ subscribers, campaigns, posts, mailableCount }: Props) {
    const form = useForm({ subject: '', intro: '', post_id: '' });
    const selectedPost = posts.find((post) => String(post.id) === form.data.post_id);

    return (
        <AdminLayout title="Newsletter">
            <Head title="Newsletter" />

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="flex flex-col gap-6 xl:col-span-2">
                    <Panel title="Neuen Newsletter schreiben">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post('/admin/newsletter', {
                                    preserveScroll: true,
                                    onSuccess: () => form.reset(),
                                });
                            }}
                            className="flex flex-col gap-4"
                        >
                            <Field label="Betreff" error={form.errors.subject}>
                                <input
                                    className={inputClass}
                                    value={form.data.subject}
                                    onChange={(e) => form.setData('subject', e.target.value)}
                                    required
                                />
                            </Field>

                            <Field label="Einleitung" error={form.errors.intro}>
                                <textarea
                                    className={inputClass}
                                    rows={5}
                                    value={form.data.intro}
                                    onChange={(e) => form.setData('intro', e.target.value)}
                                />
                            </Field>

                            <Field
                                label="Eintrag verlinken"
                                error={form.errors.post_id}
                                hint="Titel, Anriss und ein Knopf zum Lesen werden automatisch eingefügt. „Text vorschlagen“ füllt Betreff und Einleitung passend zum Eintrag."
                            >
                                <select
                                    className={inputClass}
                                    value={form.data.post_id}
                                    onChange={(e) => form.setData('post_id', e.target.value)}
                                >
                                    <option value="">– keinen –</option>
                                    {posts.map((post) => (
                                        <option key={post.id} value={post.id}>
                                            {post.title}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <div className="flex justify-between gap-2">
                                <Button
                                    variant="ghost"
                                    disabled={!selectedPost}
                                    onClick={() => {
                                        if (!selectedPost) return;
                                        if (
                                            (form.data.subject || form.data.intro) &&
                                            !window.confirm('Betreff und Einleitung durch einen Vorschlag ersetzen?')
                                        ) {
                                            return;
                                        }
                                        form.setData({ ...form.data, ...suggestCampaign(selectedPost) });
                                    }}
                                >
                                    Text vorschlagen
                                </Button>
                                <Button type="submit" disabled={form.processing}>
                                    Als Entwurf speichern
                                </Button>
                            </div>
                        </form>
                    </Panel>

                    <Panel title="Newsletter">
                        {campaigns.length === 0 ? (
                            <p className="text-sm text-graphite">Noch keine Newsletter angelegt.</p>
                        ) : (
                            <ul className="flex flex-col">
                                {campaigns.map((campaign) => (
                                    <li key={campaign.id} className="hairline-b py-4 last:border-b-0">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-medium">{campaign.subject}</p>
                                                <p className="label-xs mt-1 text-graphite">
                                                    {campaign.status === 'draft' && 'Entwurf'}
                                                    {campaign.status === 'sending' &&
                                                        `Wird versendet – ${campaign.sentCount} von ${campaign.recipientCount}`}
                                                    {campaign.status === 'sent' &&
                                                        `Versendet an ${campaign.sentCount} · ${formatShortDate(campaign.sentAt)}`}
                                                    {campaign.postTitle && ` · verlinkt: ${campaign.postTitle}`}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                {campaign.status === 'draft' && (
                                                    <Button
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(
                                                                    `Newsletter jetzt an ${mailableCount} bestätigte Empfänger senden?`,
                                                                )
                                                            ) {
                                                                router.post(
                                                                    `/admin/newsletter/${campaign.id}/senden`,
                                                                    {},
                                                                    { preserveScroll: true },
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        Senden
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="danger"
                                                    onClick={() => {
                                                        if (window.confirm('Newsletter löschen?')) {
                                                            router.delete(`/admin/newsletter/${campaign.id}`, {
                                                                preserveScroll: true,
                                                            });
                                                        }
                                                    }}
                                                >
                                                    Löschen
                                                </Button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <Panel title={`Empfänger (${mailableCount} bestätigt)`}>
                    <p className="mb-4 text-xs leading-relaxed text-graphite">
                        Der Versand läuft über einen Cronjob in kleinen Portionen – ein Newsletter braucht
                        je nach Listengröße ein paar Minuten, bis alle ihn haben.
                    </p>

                    <ul className="flex flex-col">
                        {subscribers.length === 0 && (
                            <li className="py-4 text-sm text-graphite">Noch keine Anmeldungen.</li>
                        )}
                        {subscribers.map((subscriber) => (
                            <li key={subscriber.id} className="hairline-b flex items-center justify-between gap-2 py-2 last:border-b-0">
                                <div className="min-w-0">
                                    <p className="truncate text-sm">{subscriber.email}</p>
                                    <p className="label-xs text-graphite">
                                        {subscriber.unsubscribedAt
                                            ? 'abgemeldet'
                                            : subscriber.confirmedAt
                                              ? `bestätigt ${formatShortDate(subscriber.confirmedAt)}`
                                              : 'wartet auf Bestätigung'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`${subscriber.email} löschen?`)) {
                                            router.delete(`/admin/newsletter/empfaenger/${subscriber.id}`, {
                                                preserveScroll: true,
                                            });
                                        }
                                    }}
                                    aria-label={`${subscriber.email} löschen`}
                                    className="shrink-0 px-2 text-graphite hover:text-accent"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>
        </AdminLayout>
    );
}
