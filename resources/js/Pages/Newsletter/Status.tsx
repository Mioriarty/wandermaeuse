import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

type Props = { heading: string; message: string; ok: boolean };

export default function NewsletterStatus({ heading, message, ok }: Props) {
    return (
        <PublicLayout>
            <Head title={heading} />

            <div className="mx-auto max-w-2xl px-5 pt-16 pb-24 sm:px-8 sm:pt-28">
                <p className="label-xs" style={{ color: ok ? undefined : 'var(--color-error)' }}>
                    Newsletter
                </p>
                <h1 className="mt-4 font-display text-[clamp(2.25rem,6vw,4rem)] leading-[1]">
                    {heading}
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-graphite">{message}</p>
                <Link href="/" className="label-xs mt-10 inline-flex min-h-11 items-center hover:text-accent">
                    Zur Startseite ↗
                </Link>
            </div>
        </PublicLayout>
    );
}
