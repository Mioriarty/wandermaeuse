import { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import land from '@/lib/americas.geo.json';
import type { StopProps } from '@/types';

const W = 800;
const H = 1000;

type Props = {
    stops: StopProps[];
    /** Dieser Halt wird groesser gezeichnet als die uebrigen. */
    focusStopId?: number | null;
    onSelect?: (stop: StopProps) => void;
    /** `compact` is the band above a blog entry, `full` the standalone map. */
    variant?: 'full' | 'compact';
};

/**
 * Die Route als Umrisszeichnung: graue Grenzen, sonst nichts.
 *
 * Keine Fuellung, kein Hintergrund, kein Rahmen, kein Zoom - die Karte steht
 * als Strich auf dem Papier der Seite. Die Ortsnamen stehen in der Liste
 * darunter, nicht im Bild; jeder Punkt traegt seinen Namen nur als <title>,
 * also im Tooltip und fuer den Screenreader.
 */
export default function RouteMap({ stops, focusStopId = null, onSelect, variant = 'full' }: Props) {
    const ordered = useMemo(() => [...stops].sort((a, b) => a.position - b.position), [stops]);

    const { countryPaths, points } = useMemo(() => {
        const collection = land as FeatureCollection;
        const projection = geoMercator().fitExtent(
            [
                [32, 32],
                [W - 32, H - 32],
            ],
            collection,
        );
        const pathFor = geoPath(projection);

        return {
            countryPaths: collection.features.map((feature, i) => ({
                key: (feature.properties?.iso as string) ?? String(i),
                d: pathFor(feature) ?? '',
            })),
            points: ordered.map((stop) => {
                const xy = projection([stop.lng, stop.lat]);
                return { stop, x: xy?.[0] ?? 0, y: xy?.[1] ?? 0 };
            }),
        };
    }, [ordered]);

    // Oeffentlich kommen nur Stationen an, an denen wir schon waren; nur die
    // Verwaltung sieht auch die kommenden und zeichnet sie grau. Der Weg
    // teilt sich an der letzten erreichten Station: bis dahin dunkel, danach
    // grau.
    const { pastD, futureD } = useMemo(() => {
        const lastStarted = points.findLastIndex((p) => p.stop.started);
        const line = (part: typeof points) =>
            part.length < 2 ? '' : 'M' + part.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L');

        return {
            pastD: line(points.slice(0, lastStarted + 1)),
            futureD: line(points.slice(Math.max(lastStarted, 0))),
        };
    }, [points]);

    const dot = variant === 'compact' ? 4.5 : 5;
    const focusPoint = points.find((p) => p.stop.id === focusStopId);

    // Die Karte reicht von Nordmexiko bis Feuerland und ist damit deutlich
    // hoeher als breit: ueber die volle Containerbreite waere sie auf einem
    // Laptop 1400px hoch. Der Kasten haelt das 4:5 des viewBox - genau das
    // Seitenverhaeltnis, das die Landmasse in Mercator hat - und ist in der
    // Breite gedeckelt. Er reserviert nur den Platz und ist selbst unsichtbar.
    const box =
        variant === 'compact'
            ? 'mx-auto aspect-[4/5] w-full max-w-[420px]'
            : 'mx-auto aspect-[4/5] w-full max-w-[560px]';

    return (
        <figure className={`relative m-0 ${box}`}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 block h-full w-full"
                role="img"
                aria-label={
                    focusPoint
                        ? `Karte der Reiseroute von Mexiko bis Feuerland, hervorgehoben: ${focusPoint.stop.name}`
                        : 'Karte der Reiseroute von Mexiko bis Feuerland'
                }
            >
                {/* Die Grenzen bleiben im Grau der Unterzeilen und treten damit
                    hinter die Route zurueck: erst der Weg, dann das Land. */}
                {countryPaths.map((country) => (
                    <path
                        key={country.key}
                        d={country.d}
                        fill="none"
                        stroke="var(--color-graphite)"
                        strokeWidth={1.25}
                        strokeLinejoin="round"
                    />
                ))}

                {futureD && (
                    <path
                        d={futureD}
                        fill="none"
                        stroke="var(--color-graphite)"
                        strokeOpacity={0.6}
                        strokeWidth={2}
                        strokeDasharray="7 5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                )}

                {pastD && (
                    <path
                        d={pastD}
                        fill="none"
                        stroke="var(--color-ink-soft)"
                        strokeWidth={2}
                        strokeDasharray="7 5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                )}

                {points.map(({ stop, x, y }) => (
                    <g key={stop.id}>
                        <circle
                            cx={x}
                            cy={y}
                            r={stop.id === focusStopId ? dot * 1.6 : dot}
                            fill={stop.started ? 'var(--color-ink)' : 'var(--color-graphite)'}
                        />
                        {/* Ein grosszuegiges unsichtbares Ziel: der Punkt selbst
                            ist auf dem Handy nicht zu treffen. */}
                        <circle
                            cx={x}
                            cy={y}
                            r={16}
                            fill="transparent"
                            className={onSelect ? 'cursor-pointer' : undefined}
                            onClick={() => onSelect?.(stop)}
                        >
                            <title>{stop.started ? stop.name : `${stop.name} (noch nicht erreicht)`}</title>
                        </circle>
                    </g>
                ))}
            </svg>
        </figure>
    );
}
