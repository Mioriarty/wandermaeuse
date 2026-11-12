import type { FeatureCollection } from 'geojson';
import land from '@/lib/americas.geo.json';

/**
 * Das Land einer Station ist freier Text ("México"), die Karte kennt ihre
 * Laender unter einem ISO-Kuerzel. Verglichen wird ohne Gross- und
 * Kleinschreibung und ohne Akzente, Umlaute auch als ae/oe/ue - so trifft
 * "Französisch-Guayana" das "Franzoesisch-Guayana" der Karte.
 */
function normalize(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

const features = (land as FeatureCollection).features;

/**
 * Die Karte nennt ihre Laender auf Deutsch, in den Stationen stehen sie aber
 * oft so, wie man sie unterwegs liest - auf Spanisch ("México", "Panamá"),
 * manchmal auf Englisch. Akzente fallen beim Vergleich ohnehin weg.
 */
const ALIASES: Record<string, string[]> = {
    ARG: ['Argentina'],
    BLZ: ['Belice', 'Belize'],
    BOL: ['Bolivia'],
    BRA: ['Brasil', 'Brazil'],
    CHL: ['Chile'],
    COL: ['Colombia'],
    CRI: ['Costa Rica'],
    CUB: ['Cuba'],
    DOM: ['República Dominicana', 'Dominican Republic'],
    ECU: ['Ecuador'],
    FLK: ['Islas Malvinas', 'Malvinas', 'Falkland Islands'],
    GTM: ['Guatemala'],
    GUF: ['Guayana Francesa', 'French Guiana'],
    GUY: ['Guyana'],
    HND: ['Honduras'],
    HTI: ['Haití', 'Haiti'],
    JAM: ['Jamaica'],
    MEX: ['México', 'Mexico'],
    NIC: ['Nicaragua'],
    PAN: ['Panamá', 'Panama'],
    PER: ['Perú', 'Peru'],
    PRY: ['Paraguay'],
    SLV: ['El Salvador'],
    SUR: ['Surinam', 'Suriname'],
    URY: ['Uruguay'],
    VEN: ['Venezuela'],
};

/**
 * Die spanischen Namen als Vorschlag fuer das Feld in der Verwaltung - so
 * stehen die Laender in den Stationen.
 */
export const mapCountryNames: string[] = features
    .map((f) => ALIASES[f.properties?.iso as string]?.[0] ?? (f.properties?.name as string))
    .sort((a, b) => a.localeCompare(b, 'es'));

const isoByName = new Map<string, string>(
    features.flatMap((f) => {
        const iso = f.properties?.iso as string;
        return [
            [normalize(f.properties?.name as string), iso],
            [normalize(iso), iso],
            ...(ALIASES[iso] ?? []).map((alias): [string, string] => [normalize(alias), iso]),
        ];
    }),
);

export function countryIso(name: string): string | null {
    return isoByName.get(normalize(name)) ?? null;
}
