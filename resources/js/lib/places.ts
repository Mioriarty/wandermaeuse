import type { StopProps } from '@/types';

/**
 * Einen Ort besuchen wir manchmal mehrmals; jeder Besuch ist eine eigene
 * Station mit eigenen Daten und Eintraegen. Derselbe Ort heisst: gleicher
 * Name an gleicher Stelle. Muss zu Stop::placeKey() passen.
 */
export function placeKey(stop: Pick<StopProps, 'name' | 'lat' | 'lng'>): string {
    return `${stop.name.trim().toLowerCase()}|${stop.lat}|${stop.lng}`;
}

/** Wie oft wir bis einschliesslich dieser Station schon dort waren, je Station. */
export function visitNumbers(stops: StopProps[]): Map<number, number> {
    const seen = new Map<string, number>();
    const numbers = new Map<number, number>();

    for (const stop of [...stops].sort((a, b) => a.position - b.position)) {
        const n = (seen.get(placeKey(stop)) ?? 0) + 1;
        seen.set(placeKey(stop), n);
        numbers.set(stop.id, n);
    }

    return numbers;
}
