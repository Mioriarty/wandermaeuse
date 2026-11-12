import { Link, router, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { SharedProps } from '@/types';

const NAV = [
    { href: '/admin', label: 'Übersicht', exact: true },
    { href: '/admin/startseite', label: 'Startseite' },
    { href: '/admin/eintraege', label: 'Einträge' },
    { href: '/admin/bilder', label: 'Bilder' },
    { href: '/admin/stationen', label: 'Stationen' },
    { href: '/admin/unterkuenfte', label: 'Unterkünfte' },
    { href: '/admin/kommentare', label: 'Kommentare' },
    { href: '/admin/newsletter', label: 'Newsletter' },
];

type Props = {
    children: ReactNode;
    title: string;
    actions?: ReactNode;
};

/** Desktop-first on purpose - this is the only part of the site not built for phones. */
export default function AdminLayout({ children, title, actions }: Props) {
    const { url, props } = usePage<SharedProps>();

    return (
        <div className="min-h-screen bg-paper-dim">
            <header className="border-b border-ink bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
                    <div className="flex items-center gap-8">
                        <Link href="/admin" className="font-ui text-base font-bold tracking-tight">
                            Wandermäuse<span className="text-graphite"> / Verwaltung</span>
                        </Link>
                        <nav className="flex flex-wrap gap-6" aria-label="Verwaltung">
                            {NAV.map((item) => {
                                const active = item.exact ? url === item.href : url.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`label-xs hover:text-accent ${active ? 'text-ink' : 'text-graphite'}`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="/" target="_blank" rel="noopener" className="label-xs text-graphite hover:text-ink">
                            Website ↗
                        </a>
                        <span className="label-xs text-graphite">{props.auth.user?.name}</span>
                        <button
                            type="button"
                            onClick={() => router.post('/admin/logout')}
                            className="label-xs border border-hairline px-3 py-2 hover:bg-ink hover:text-paper"
                        >
                            Abmelden
                        </button>
                    </div>
                </div>
            </header>

            {props.flash?.success && (
                <p role="status" className="border-b border-ink bg-ink px-6 py-2 text-sm text-paper">
                    {props.flash.success}
                </p>
            )}
            {props.flash?.error && (
                <p role="alert" className="border-b border-error bg-error px-6 py-2 text-sm text-paper">
                    {props.flash.error}
                </p>
            )}

            <div className="px-6 py-8">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <h1 className="font-ui text-3xl font-bold tracking-tight">{title}</h1>
                    {actions && <div className="flex items-center gap-3">{actions}</div>}
                </div>
                {children}
            </div>
        </div>
    );
}
