import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
import MiniPlayer from '@/Components/MiniPlayer';
import type { SharedProps } from '@/types';

const NAV = [
    { href: '/blog', label: 'Einträge' },
    { href: '/reise', label: 'Die Route' },
    { href: '/newsletter', label: 'Newsletter' },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
    const { url, props } = usePage<SharedProps>();
    const [menuOpen, setMenuOpen] = useState(false);
    const flash = props.flash;

    // Any navigation closes the menu, including the browser back button.
    useEffect(() => setMenuOpen(false), [url]);

    return (
        <div className="flex min-h-screen flex-col">
            {/*
              Keine Trennlinie unter der Kopfleiste: auf der Startseite soll das
              Titelbild ohne Kante anschliessen. Die Leiste traegt ihren eigenen
              Hintergrund, damit der Text darunter beim Scrollen lesbar bleibt.
            */}
            <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-[100rem] items-center justify-between px-5 sm:h-18 sm:px-8">
                    <Link href="/" className="flex min-h-11 items-center font-display text-2xl font-medium leading-none sm:text-[1.75rem]">
                        Wandermäuse
                    </Link>

                    <nav className="hidden gap-9 sm:flex" aria-label="Hauptnavigation">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`label-xs transition-colors hover:text-accent ${
                                    url.startsWith(item.href) ? 'text-ink' : 'text-graphite'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-expanded={menuOpen}
                        aria-controls="mobile-nav"
                        className="label-xs -mr-2 flex h-11 items-center px-2 sm:hidden"
                    >
                        {menuOpen ? 'Schließen' : 'Menü'}
                    </button>
                </div>

                {menuOpen && (
                    <nav id="mobile-nav" className="hairline-t bg-paper sm:hidden" aria-label="Hauptnavigation">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="label-xs hairline-b flex min-h-14 items-center px-5 last:border-b-0"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </header>

            {flash?.success && (
                <p role="status" className="bg-ink px-5 py-3 text-center text-sm text-paper sm:px-8">
                    {flash.success}
                </p>
            )}
            {flash?.error && (
                <p role="alert" className="bg-accent px-5 py-3 text-center text-sm text-paper sm:px-8">
                    {flash.error}
                </p>
            )}

            <main className="flex-1">{children}</main>

            <MiniPlayer />

            <footer className="hairline-t mt-24 sm:mt-32">
                <div className="mx-auto max-w-[100rem] px-5 py-12 sm:px-8 sm:py-16">
                    <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
                        <div>
                            <p className="font-display text-3xl leading-none sm:text-4xl">Wandermäuse</p>
                            <p className="mt-4 max-w-xs text-sm leading-relaxed text-graphite">
                                Ein Reisetagebuch aus Süd- und Mittelamerika – mit Bildern und Karte.
                            </p>
                        </div>
                        <nav className="-my-3 flex flex-col" aria-label="Rechtliches">
                            <Link
                                href="/impressum"
                                className="label-xs flex min-h-11 items-center text-graphite hover:text-ink"
                            >
                                Impressum
                            </Link>
                            <Link
                                href="/datenschutz"
                                className="label-xs flex min-h-11 items-center text-graphite hover:text-ink"
                            >
                                Datenschutz
                            </Link>
                            <a
                                href="/feed.xml"
                                className="label-xs flex min-h-11 items-center text-graphite hover:text-ink"
                            >
                                RSS
                            </a>
                        </nav>
                    </div>
                </div>
            </footer>
        </div>
    );
}
