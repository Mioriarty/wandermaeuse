import type { ReactNode } from 'react';

export function Panel({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
    return (
        <section className="border border-hairline bg-paper">
            {title && <h2 className="label-xs hairline-b px-5 py-3 text-graphite">{title}</h2>}
            <div className="p-5">{children}</div>
            {footer && <div className="hairline-t px-5 py-3">{footer}</div>}
        </section>
    );
}

export function Button({
    children,
    onClick,
    type = 'button',
    variant = 'primary',
    disabled = false,
}: {
    children: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    variant?: 'primary' | 'ghost' | 'danger';
    disabled?: boolean;
}) {
    const styles = {
        primary: 'bg-ink text-paper hover:bg-accent',
        ghost: 'border border-hairline text-ink hover:bg-ink hover:text-paper',
        danger: 'border border-error text-error hover:bg-error hover:text-paper',
    }[variant];

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`label-xs min-h-10 px-4 transition-colors disabled:opacity-40 ${styles}`}
        >
            {children}
        </button>
    );
}

export function Field({
    label,
    children,
    error,
    hint,
}: {
    label: string;
    children: ReactNode;
    error?: string;
    hint?: string;
}) {
    return (
        <label className="block">
            <span className="label-xs block text-graphite">{label}</span>
            <span className="mt-2 block">{children}</span>
            {hint && <span className="mt-1 block text-xs text-graphite">{hint}</span>}
            {error && <span className="mt-1 block text-xs text-error">{error}</span>}
        </label>
    );
}

export const inputClass =
    'w-full border border-hairline bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none';
