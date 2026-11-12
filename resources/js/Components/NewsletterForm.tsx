import { useForm } from '@inertiajs/react';

export default function NewsletterForm({ compact = false }: { compact?: boolean }) {
    const { data, setData, post, processing, errors, reset, wasSuccessful } = useForm({
        email: '',
        name: '',
        website: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/newsletter', {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    if (wasSuccessful) {
        return (
            <div className="border border-ink p-6" role="status">
                <p className="font-display text-2xl font-medium leading-none">Fast geschafft.</p>
                <p className="mt-2 text-sm leading-relaxed text-graphite">
                    Wir haben dir eine E-Mail geschickt. Bestätige darin einmal kurz deine Adresse – dann
                    bist du dabei.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="border border-ink">
            {!compact && (
                <div className="hairline-b px-5 py-4 sm:px-6">
                    <h2 className="font-display text-2xl font-medium leading-none">Neue Einträge per E-Mail</h2>
                    <p className="mt-2 text-sm leading-relaxed text-graphite">
                        Keine Werbung, kein Tracking – nur eine Nachricht, wenn es etwas Neues zu lesen und
                        zu hören gibt.
                    </p>
                </div>
            )}

            <div className="bg-paper px-5 py-4 sm:px-6">
                <label className="label-xs block text-graphite" htmlFor="newsletter-email">
                    E-Mail-Adresse
                </label>
                <input
                    id="newsletter-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="mt-2 w-full border border-hairline bg-paper px-3 py-2 text-base focus:border-ink focus:outline-none"
                />
                {errors.email && <p className="mt-2 text-sm text-error">{errors.email}</p>}
            </div>

            <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="newsletter-website">Website</label>
                <input
                    id="newsletter-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={data.website}
                    onChange={(e) => setData('website', e.target.value)}
                />
            </div>

            <div className="hairline-t flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <p className="text-xs leading-relaxed text-graphite">
                    Abmeldung jederzeit über den Link in jeder E-Mail.
                </p>
                <button
                    type="submit"
                    disabled={processing}
                    className="label-xs min-h-11 shrink-0 bg-ink px-6 text-paper transition-colors hover:bg-accent disabled:opacity-40"
                >
                    {processing ? '…' : 'Anmelden'}
                </button>
            </div>
        </form>
    );
}
