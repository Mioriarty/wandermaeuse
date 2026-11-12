import type { FeatureCollection } from 'geojson';
import land from '@/lib/americas.geo.json';

/**
 * Das Land einer Station ist freier Text ("Mexiko"), die Karte kennt ihre
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

/** Die Laendernamen der Karte, als Vorschlag fuer das Feld in der Verwaltung. */
export const mapCountryNames: string[] = features.map((f) => f.properties?.name as string).sort((a, b) => a.localeCompare(b, 'de'));

const isoByName = new Map<string, string>(
    features.flatMap((f) => {
        const iso = f.properties?.iso as string;
        return [
            [normalize(f.properties?.name as string), iso],
            [normalize(iso), iso],
        ];
    }),
);

export function countryIso(name: string): string | null {
    return isoByName.get(normalize(name)) ?? null;
}
