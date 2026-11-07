import { addDays, formatDay, formatEur, formatNights, formatPeriod } from '@/lib/format';
import type { BookingKindOption, BookingProps, NightProps } from '@/types';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Hoehe einer Balkenzeile und des Kopfs mit der Tageszahl, in px. */
const LANE = 26;
const HEAD = 30;
/** Platz unter den Balken fuer "Keine Unterkunft" und Co. */
const FOOT = 24;

/** Schraffur fuer Naechte, die nur geplant sind. */
export const HATCH = 'repeating-linear-gradient(135deg, var(--color-hairline) 0 1px, transparent 1px 7px)';

type Props = {
    /** Y-m */
    month: string;
    tonight: string;
    /** Ganze Wochen, Montag bis Sonntag. */
    nights: NightProps[];
    bookings: BookingProps[];
    kinds: BookingKindOption[];
    selectedId: number | null;
    onSelectBooking: (booking: BookingProps) => void;
    onSelectNight: (date: string) => void;
};

/**
 * Ein Monat als Raster aus Naechten: jedes Feld ist die Nacht, die an diesem
 * Tag beginnt. Buchungen laufen als Balken ueber ihre Naechte; der Abreisetag
 * gehoert nicht mehr dazu.
 */
export default function BookingCalendar({ nights, ...rest }: Props) {
    const weeks: NightProps[][] = [];
    for (let i = 0; i < nights.length; i += 7) weeks.push(nights.slice(i, i + 7));

    return (
        <div className="border-t border-l border-hairline">
            <div className="grid grid-cols-7">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="label-xs border-r border-b border-hairline px-2 py-2 text-graphite">
                        {day}
                    </div>
                ))}
            </div>
            {weeks.map((week) => (
                <Week key={week[0].date} days={week} {...rest} />
            ))}
        </div>
    );
}

function Week({
    days,
    month,
    tonight,
    bookings,
    kinds,
    selectedId,
    onSelectBooking,
    onSelectNight,
}: Omit<Props, 'nights'> & { days: NightProps[] }) {
    const start = days[0].date;
    const end = addDays(start, 7);

    // Balken auf Zeilen verteilen: jeder nimmt die erste, auf der er nicht
    // mit einem frueheren kollidiert. Lange zuerst, damit sie oben liegen.
    const laneEnds: string[] = [];
    const segments = bookings
        .filter((b) => b.checkIn < end && b.checkOut > start)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || b.nights - a.nights)
        .map((booking) => {
            const from = booking.checkIn > start ? booking.checkIn : start;
            const until = booking.checkOut < end ? booking.checkOut : end;
            let lane = laneEnds.findIndex((laneEnd) => laneEnd <= from);
            if (lane === -1) lane = laneEnds.length;
            laneEnds[lane] = until;

            return {
                booking,
                lane,
                col: days.findIndex((d) => d.date === from),
                span: days.filter((d) => d.date >= from && d.date < until).length,
                continues: booking.checkIn < start,
                carriesOn: booking.checkOut > end,
            };
        });

    const height = HEAD + Math.max(2, laneEnds.length) * LANE + FOOT;

    return (
        <div className="relative grid grid-cols-7" style={{ minHeight: height }}>
            {days.map((night) => (
                <NightCell
                    key={night.date}
                    night={night}
                    inMonth={night.date.startsWith(month)}
                    isPast={night.date < tonight}
                    isTonight={night.date === tonight}
                    onSelect={onSelectNight}
                />
            ))}

            <div
                className="pointer-events-none absolute inset-x-0 grid grid-cols-7"
                style={{ top: HEAD, gridAutoRows: LANE }}
            >
                {segments.map(({ booking, lane, col, span, continues, carriesOn }) => {
                    const kind = kinds.find((k) => k.value === booking.kind);
                    const label = kind && booking.kind !== 'stay' ? `${kind.label} · ${booking.title}` : booking.title;
                    const selected = booking.id === selectedId;
                    const planned = booking.status === 'planned';

                    return (
                        <button
                            key={booking.id}
                            type="button"
                            onClick={() => onSelectBooking(booking)}
                            title={[
                                label,
                                formatPeriod(booking.checkIn, addDays(booking.checkOut, -1)),
                                formatNights(booking.nights),
                                planned ? 'geplant' : 'gebucht',
                                formatEur(booking.priceEurCents),
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                            style={{ gridColumn: `${col + 1} / span ${span}`, gridRow: lane + 1 }}
                            className={`pointer-events-auto my-0.5 truncate px-2 text-left text-xs transition-colors ${
                                continues ? 'ml-0' : 'ml-1'
                            } ${carriesOn ? 'mr-0' : 'mr-1'} ${
                                selected
                                    ? 'bg-accent text-paper'
                                    : planned
                                      ? 'border border-dashed border-ink bg-paper text-ink hover:border-accent hover:text-accent'
                                      : 'bg-ink text-paper hover:bg-accent'
                            }`}
                        >
                            {continues && '… '}
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function NightCell({
    night,
    inMonth,
    isPast,
    isTonight,
    onSelect,
}: {
    night: NightProps;
    inMonth: boolean;
    isPast: boolean;
    isTonight: boolean;
    onSelect: (date: string) => void;
}) {
    const day = Number(night.date.slice(8));
    // Vergangene Luecken sind vorbei - markiert wird nur, was noch kommt.
    const flagged = !isPast && night.state !== 'booked';

    return (
        <button
            type="button"
            onClick={() => onSelect(night.date)}
            aria-label={`Nacht vom ${formatDay(night.date)}: neue Buchung ab hier`}
            style={flagged && night.state === 'planned' ? { backgroundImage: HATCH } : undefined}
            className={`relative flex flex-col justify-between border-r border-b border-hairline px-2 pt-1.5 pb-1 text-left hover:bg-paper-dim ${
                flagged && night.state === 'missing' ? 'bg-accent/10' : ''
            } ${isPast ? 'bg-paper-dim/60' : ''}`}
        >
            <span
                className={`self-start px-1 text-xs tabular-nums ${
                    isTonight ? 'bg-ink text-paper' : inMonth ? (isPast ? 'text-graphite' : 'text-ink') : 'text-graphite/50'
                }`}
            >
                {day}
            </span>
            <span className="text-[10px] leading-tight font-medium tracking-wide uppercase">
                {night.doubleBooked && <span className="text-accent">Doppelt gebucht</span>}
                {!night.doubleBooked && flagged && night.state === 'missing' && (
                    <span className="text-accent">Keine Unterkunft</span>
                )}
                {!night.doubleBooked && flagged && night.state === 'planned' && (
                    <span className="text-graphite">Nur geplant</span>
                )}
            </span>
        </button>
    );
}
