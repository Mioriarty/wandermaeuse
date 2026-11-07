const MONTHS = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** 14. März 2026 */
export function formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * 14.–18. März 2026 · 28. Februar – 3. März 2026 · 30. Dezember 2025 – 2. Januar 2026
 *
 * Takes plain Y-m-d days and reads them as such: through `new Date` they would
 * be UTC midnight and slip to the previous day west of Greenwich.
 */
export function formatPeriod(from: string, until: string): string {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [uy, um, ud] = until.split('-').map(Number);

    if (from === until) return `${fd}. ${MONTHS[fm - 1]} ${fy}`;
    if (fy === uy && fm === um) return `${fd}.–${ud}. ${MONTHS[um - 1]} ${uy}`;
    if (fy === uy) return `${fd}. ${MONTHS[fm - 1]} – ${ud}. ${MONTHS[um - 1]} ${uy}`;
    return `${fd}. ${MONTHS[fm - 1]} ${fy} – ${ud}. ${MONTHS[um - 1]} ${uy}`;
}

/**
 * The date readers see on an entry: the days it tells of, and only where
 * those were never filled in, the day it went online.
 */
export function formatPostDate(post: {
    period: { from: string; until: string } | null;
    publishedAt: string | null;
}): string {
    return post.period ? formatPeriod(post.period.from, post.period.until) : formatDate(post.publishedAt);
}

/** 14. März 2026, aus einem reinen Y-m-d-Tag - formatDate wuerde ihn westlich von Greenwich auf den Vortag schieben. */
export function formatDay(iso: string): string {
    return formatPeriod(iso, iso);
}

/** A stop's stay, or just its arrival day; empty when neither is known. */
export function formatStay(stop: { arrivedOn: string | null; departedOn: string | null }): string {
    return stop.arrivedOn ? formatPeriod(stop.arrivedOn, stop.departedOn ?? stop.arrivedOn) : '';
}

/** 14.03.2026 */
export function formatShortDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** 3:07 */
export function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** 1.234,50 € - Betraege in Cent, damit sich beim Summieren nichts verrundet. */
export function formatEur(cents: number | null): string {
    if (cents === null) return '';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** 180,00 PEN - ein Preis, wie er bezahlt wurde. */
export function formatMoney(amount: string | number | null, currency: string | null): string {
    if (amount === null || amount === '' || !currency) return '';
    try {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency, currencyDisplay: 'code' }).format(
            Number(amount),
        );
    } catch {
        return `${amount} ${currency}`;
    }
}

/** Ein Y-m-d-Tag plus n Tage, ohne Umweg ueber die lokale Zeitzone. */
export function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Naechte zwischen zwei Y-m-d-Tagen. */
export function nightsBetween(from: string, until: string): number {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [uy, um, ud] = until.split('-').map(Number);
    return Math.round((Date.UTC(uy, um - 1, ud) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** November 2026, aus "2026-11". */
export function formatMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
}

/** "1 Nacht" / "3 Nächte" */
export function formatNights(n: number): string {
    return n === 1 ? '1 Nacht' : `${n} Nächte`;
}
