import { Head, useForm } from '@inertiajs/react';
import { inputClass } from '@/Components/Admin/Ui';

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    return (
        <div className="flex min-h-screen items-center justify-center bg-paper-dim px-5">
            <Head title="Anmelden" />

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    post('/admin/login');
                }}
                className="w-full max-w-sm border border-ink bg-paper"
            >
                <div className="hairline-b px-6 py-5">
                    <h1 className="font-ui text-xl font-bold tracking-tight">Wandermäuse</h1>
                    <p className="mt-1 text-sm text-graphite">Verwaltung</p>
                </div>

                <div className="flex flex-col gap-4 px-6 py-6">
                    <label className="block">
                        <span className="label-xs block text-graphite">E-Mail</span>
                        <input
                            type="email"
                            required
                            autoFocus
                            autoComplete="username"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            className={`${inputClass} mt-2`}
                        />
                    </label>

                    <label className="block">
                        <span className="label-xs block text-graphite">Passwort</span>
                        <input
                            type="password"
                            required
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className={`${inputClass} mt-2`}
                        />
                    </label>

                    {errors.email && <p className="text-sm text-error">{errors.email}</p>}

                    <label className="label-xs flex items-center gap-2 text-graphite">
                        <input
                            type="checkbox"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                        />
                        Angemeldet bleiben
                    </label>
                </div>

                <div className="hairline-t px-6 py-4">
                    <button
                        type="submit"
                        disabled={processing}
                        className="label-xs min-h-11 w-full bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-40"
                    >
                        {processing ? 'Einen Moment …' : 'Anmelden'}
                    </button>
                </div>
            </form>
        </div>
    );
}
