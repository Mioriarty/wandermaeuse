import { useId, useMemo } from 'react';
import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection } from 'geojson';
import land from '@/lib/americas.geo.json';
import detail from '@/lib/nicaragua-costarica.geo.json';
import { countryIso } from '@/lib/mapCountries';
import { placeKey } from '@/lib/places';
import type { StopProps } from '@/types';

const W = 800;
const H = 1000;

/**
 * Die Nebenkarte fuer Nicaragua und Costa Rica. Auf der grossen Karte sind
 * die beiden zusammen kaum groesser als ein Daumennagel, die Stationen dort
 * liegen aufeinander. Unter Mexiko, im leeren Pazifik vor Ecuador, ist Platz
 * fuer eine Vergroesserung - etwa sechsfach, mit feineren Kuesten und den
 * beiden grossen Seen.
 *
 * Der Rahmen ist so gewaehlt, dass er rechts vor der Kueste Ecuadors endet;
 * wer ihn verschiebt, prueft das auf der Karte nach.
 */
const INSET = { x: 44, y: 330, w: 296, h: 400 };
const INSET_PAD = 20;

const mainProjection = geoMercator().fitExtent(
    [
        [32, 32],
        [W - 32, H - 32],
    ],
    land as FeatureCollection,
);

const detailFeatures = (detail as FeatureCollection).features;

const insetProjection = geoMercator().fitExtent(
    [
        [INSET.x + INSET_PAD, INSET.y + INSET_PAD],
        [INSET.x + INSET.w - INSET_PAD, INSET.y + INSET.h - INSET_PAD],
    ],
    {
        type: 'FeatureCollection',
        features: detailFeatures.filter((f) => ['NIC', 'CRI'].includes(f.properties?.iso)),
    },
);

function shapes(features: Feature[], projection: GeoProjection) {
    const pathFor = geoPath(projection);
    return features.map((feature, i) => ({
        key: (feature.properties?.iso as string) ?? (feature.properties?.name as string) ?? String(i),
        iso: (feature.properties?.iso as string) ?? null,
        d: pathFor(feature) ?? '',
    }));
}

const countryShapes = shapes((land as FeatureCollection).features, mainProjection);
const insetCountryShapes = shapes(
    detailFeatures.filter((f) => f.properties?.kind === 'country'),
    insetProjection,
);
const lakeShapes = shapes(
    detailFeatures.filter((f) => f.properties?.kind === 'lake'),
    insetProjection,
);

// Was die Nebenkarte zeigt, in Laengen und Breiten - daraus der kleine
// Kasten auf der grossen Karte und die Frage, welcher Punkt dorthin gehoert.
const [west, north] = insetProjection.invert!([INSET.x, INSET.y])!;
const [east, south] = insetProjection.invert!([INSET.x + INSET.w, INSET.y + INSET.h])!;
const [boxLeft, boxTop] = mainProjection([west, north])!;
const [boxRight, boxBottom] = mainProjection([east, south])!;

function inInset(stop: StopProps): boolean {
    return stop.lng >= west && stop.lng <= east && stop.lat >= south && stop.lat <= north;
}

type Point = { stop: StopProps; x: number; y: number };

function project(stops: StopProps[], projection: GeoProjection): Point[] {
    return stops.map((stop) => {
        const xy = projection([stop.lng, stop.lat]);
        return { stop, x: xy?.[0] ?? 0, y: xy?.[1] ?? 0 };
    });
}

// Oeffentlich kommen nur Stationen an, an denen wir schon waren; nur die
// Verwaltung sieht auch die kommenden und zeichnet sie grau. Der Weg teilt
// sich an der letzten erreichten Station: bis dahin dunkel, danach grau.
function routeLines(points: Point[]) {
    const lastStarted = points.findLastIndex((p) => p.stop.started);
    const line = (part: Point[]) =>
        part.length < 2 ? '' : 'M' + part.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L');

    return {
        pastD: line(points.slice(0, lastStarted + 1)),
        futureD: line(points.slice(Math.max(lastStarted, 0))),
    };
}

type Props = {
    stops: StopProps[];
    /** Dieser Halt wird groesser gezeichnet als die uebrigen. */
    focusStopId?: number | null;
    onSelect?: (stop: StopProps) => void;
    /** `compact` is the band above a blog entry, `full` the standalone map. */
    variant?: 'full' | 'compact';
    /**
     * Der Ring pulsiert am hervorgehobenen Halt statt dort, wo wir gerade
     * sind - ueber einem aelteren Eintrag geht es um dessen Ort. Ist das
     * nicht die heutige Station, pulsiert er schwarz; die heutige bleibt im
     * Akzent, nur ohne Ring.
     */
    pulseAtFocus?: boolean;
};

/**
 * Die Route als Umrisszeichnung: graue Grenzen, kein Hintergrund, kein Rahmen,
 * kein Zoom - die Karte steht als Strich auf dem Papier der Seite.
 *
 * Farbe gibt es nur fuer die Reise selbst: besuchte Laender sind kaum
 * sichtbar grau unterlegt, das Land, in dem wir gerade sind, im Grau des
 * Akzents, und der Punkt, an dem wir sind, im Akzent. Die Ortsnamen stehen
 * in der Liste darunter, nicht im Bild; jeder Punkt traegt seinen Namen nur
 * als <title>, also im Tooltip und fuer den Screenreader.
 */
export default function RouteMap({ stops, focusStopId = null, onSelect, variant = 'full', pulseAtFocus = false }: Props) {
    const clipId = useId();
    const ordered = useMemo(() => [...stops].sort((a, b) => a.position - b.position), [stops]);

    const { visited, currentIso } = useMemo(
        () => ({
            visited: new Set(ordered.filter((s) => s.started).map((s) => countryIso(s.country))),
            currentIso: countryIso(ordered.find((s) => s.current)?.country ?? ''),
        }),
        [ordered],
    );

    const { points, insetPoints, route, insetRoute } = useMemo(() => {
        const all = project(ordered, mainProjection);
        const zoomed = project(ordered, insetProjection);

        return {
            // Was in der Nebenkarte liegt, zeichnet die grosse Karte nicht
            // doppelt - dort laeuft nur der Weg durch den Kasten.
            points: all.filter((p) => !inInset(p.stop)),
            insetPoints: zoomed.filter((p) => inInset(p.stop)),
            route: routeLines(all),
            insetRoute: routeLines(zoomed),
        };
    }, [ordered]);

    const fillFor = (iso: string | null) =>
        iso === null
            ? 'none'
            : iso === currentIso
              ? 'var(--color-map-current)'
              : visited.has(iso)
                ? 'var(--color-map-visited)'
                : 'none';

    const dot = variant === 'compact' ? 4.5 : 5;
    const focusStop = ordered.find((s) => s.id === focusStopId);
    // Ohne Ort im Eintrag bleibt der Ring, wo wir gerade sind.
    const pulseStopId = pulseAtFocus && focusStop ? focusStop.id : ordered.find((s) => s.current)?.id;

    const renderCountries = (list: typeof countryShapes) =>
        list.map((country) => (
            <path
                key={country.key}
                d={country.d}
                fill={fillFor(country.iso)}
                stroke="var(--color-graphite)"
                strokeWidth={1.25}
                strokeLinejoin="round"
            />
        ));

    const renderRoute = ({ pastD, futureD }: ReturnType<typeof routeLines>) => (
        <>
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
        </>
    );

    // Mehrere Besuche desselben Ortes sind ein Punkt - der Weg laeuft
    // trotzdem durch jeden Besuch. Der Punkt zeigt den wichtigsten Stand
    // seiner Besuche: heute vor erreicht vor geplant.
    const renderPoints = (list: Point[]) => {
        const places = new Map<string, Point[]>();
        for (const point of list) {
            const key = placeKey(point.stop);
            places.set(key, [...(places.get(key) ?? []), point]);
        }

        return [...places].map(([key, visits]) => {
            const { x, y } = visits[0];
            const stops = visits.map((v) => v.stop);
            const name = stops[0].name;
            const current = stops.find((s) => s.current);
            const focused = stops.find((s) => s.id === focusStopId);
            const pulsing = stops.find((s) => s.id === pulseStopId);
            const reached = stops.filter((s) => s.started);
            // Getippt wird der Besuch, um den es gerade geht, sonst der juengste.
            const target = focused ?? current ?? reached.at(-1) ?? stops[0];
            const r = focused ? dot * 1.6 : current ? dot * 1.3 : dot;

            return (
                <g key={key}>
                    {pulsing && (
                        <circle
                            cx={x}
                            cy={y}
                            r={r}
                            fill="none"
                            stroke={pulsing.current ? 'var(--color-accent)' : 'var(--color-ink)'}
                            strokeWidth={1.5}
                            className="map-here"
                        />
                    )}
                    <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill={
                            current
                                ? 'var(--color-accent)'
                                : reached.length > 0
                                  ? 'var(--color-ink)'
                                  : 'var(--color-graphite)'
                        }
                    />
                    {/* Ein grosszuegiges unsichtbares Ziel: der Punkt selbst
                        ist auf dem Handy nicht zu treffen. */}
                    <circle
                        cx={x}
                        cy={y}
                        r={16}
                        fill="transparent"
                        className={onSelect ? 'cursor-pointer' : undefined}
                        onClick={() => onSelect?.(target)}
                    >
                        <title>
                            {current
                                ? `${name} (hier sind wir gerade)`
                                : reached.length > 1
                                  ? `${name} (${reached.length} Besuche)`
                                  : reached.length === 1
                                    ? name
                                    : `${name} (noch nicht erreicht)`}
                        </title>
                    </circle>
                </g>
            );
        });
    };

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
                    focusStop
                        ? `Karte der Reiseroute von Mexiko bis Feuerland, hervorgehoben: ${focusStop.name}`
                        : 'Karte der Reiseroute von Mexiko bis Feuerland'
                }
            >
                <defs>
                    <clipPath id={clipId}>
                        <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} />
                    </clipPath>
                    {/* Der Weg setzt am kleinen Kasten aus: darin stehen nur die
                        Umrisse, die Route erzaehlt die Nebenkarte. */}
                    <mask id={`${clipId}-box`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
                        <rect x={0} y={0} width={W} height={H} fill="white" />
                        <rect x={boxLeft} y={boxTop} width={boxRight - boxLeft} height={boxBottom - boxTop} fill="black" />
                    </mask>
                </defs>

                {/* Die Grenzen bleiben im Grau der Unterzeilen und treten damit
                    hinter die Route zurueck: erst der Weg, dann das Land. */}
                {renderCountries(countryShapes)}

                {/* Der Ausschnitt und die zwei Linien zur Nebenkarte darunter,
                    von den unteren Ecken des Kastens zu den oberen des Rahmens. */}
                <g fill="none" stroke="var(--color-graphite)" strokeWidth={0.75}>
                    <rect x={boxLeft} y={boxTop} width={boxRight - boxLeft} height={boxBottom - boxTop} />
                    <line x1={boxLeft} y1={boxBottom} x2={INSET.x} y2={INSET.y} strokeOpacity={0.6} />
                    <line x1={boxRight} y1={boxBottom} x2={INSET.x + INSET.w} y2={INSET.y} strokeOpacity={0.6} />
                </g>

                <g mask={`url(#${clipId}-box)`}>{renderRoute(route)}</g>
                {renderPoints(points)}

                <rect
                    x={INSET.x}
                    y={INSET.y}
                    width={INSET.w}
                    height={INSET.h}
                    fill="var(--color-paper)"
                    stroke="var(--color-graphite)"
                    strokeWidth={0.75}
                />
                <g clipPath={`url(#${clipId})`}>
                    {renderCountries(insetCountryShapes)}
                    {/* Die Seen liegen in Papierfarbe auf dem Land; Ometepe und
                        Zapatera sind Loecher darin und behalten die Fuellung
                        Nicaraguas. */}
                    {lakeShapes.map((lake) => (
                        <path
                            key={lake.key}
                            d={lake.d}
                            fill="var(--color-paper)"
                            stroke="var(--color-graphite)"
                            strokeWidth={1}
                            strokeLinejoin="round"
                        />
                    ))}
                    {renderRoute(insetRoute)}
                    {renderPoints(insetPoints)}
                </g>
            </svg>
        </figure>
    );
}
