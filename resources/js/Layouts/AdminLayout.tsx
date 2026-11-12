import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
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

/**
 * Desktop-first on purpose - this is the only part of the site not built for
 * phones. Below lg the navigation folds into a menu, so a quick look on the
 * phone (a new comment, tonight's bed) still works.
 */
export default function AdminLayout({ children, title, actions }: Props) {
    const { url, props } = usePage<SharedProps>();
    const [menuOpen, setMenuOpen] = useState(false);
    const isActive = (item: (typeof NAV)[number]) => (item.exact ? url === item.href : url.startsWith(item.href));

    // Any navigation closes the menu, including the browser back button.
    useEffect(() => setMenuOpen(false), [url]);

    return (
        <div className="min-h-screen bg-paper-dim">
            <header className="border-b border-ink bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
                    <div className="flex items-center gap-8">
                        <Link href="/admin" className="font-ui text-base font-bold tracking-tight">
                            Wandermäuse<span className="text-graphite"> / Verwaltung</span>
                        </Link>
                        <nav className="hidden flex-wrap gap-6 lg:flex" aria-label="Verwaltung">
                            {NAV.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`label-xs hover:text-accent ${isActive(item) ? 'text-ink' : 'text-graphite'}`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <div className="hidden items-center gap-4 lg:flex">
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

                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-expanded={menuOpen}
                        aria-controls="admin-nav"
                        aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
                        className="-mr-3 flex h-11 w-11 items-center justify-center hover:text-accent lg:hidden"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                            {menuOpen ? (
                                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" />
                            ) : (
                                <path d="M2 5H18M2 10H18M2 15H18" stroke="currentColor" strokeWidth="1.5" />
                            )}
                        </svg>
                    </button>
                </div>

                {menuOpen && (
                    <div id="admin-nav" className="border-t border-hairline lg:hidden">
                        {props.auth.user && (
                            <p className="px-6 pt-4 pb-2 text-sm text-graphite">
                                Angemeldet als <span className="font-medium text-ink">{props.auth.user.name}</span>
                            </p>
                        )}
                        <nav aria-label="Verwaltung">
                            {NAV.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={isActive(item) ? 'page' : undefined}
                                    className={`label-xs flex min-h-12 items-center border-l-2 px-6 hover:text-accent ${
                                        isActive(item) ? 'border-ink text-ink' : 'border-transparent text-graphite'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-2 flex items-center justify-between gap-4 border-t border-hairline px-6 py-3">
                            <a href="/" target="_blank" rel="noopener" className="label-xs text-graphite hover:text-ink">
                                Website ↗
                            </a>
                            <button
                                type="button"
                                onClick={() => router.post('/admin/logout')}
                                className="label-xs min-h-11 border border-hairline px-4 hover:bg-ink hover:text-paper"
                            >
                                Abmelden
                            </button>
                        </div>
                    </div>
                )}
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
