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
