import { Head, router, useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import BookingCalendar, { HATCH } from '@/Components/Admin/BookingCalendar';
import BookingForm, { type BookingFormData } from '@/Components/Admin/BookingForm';
import { Button, Panel } from '@/Components/Admin/Ui';
import {
    addDays,
    formatDay,
    formatEur,
    formatMoney,
    formatMonth,
    formatNights,
    formatPeriod,
    nightsBetween,
} from '@/lib/format';
import type { BookingKindOption, BookingProps, NightProps, NightRun, NightsAhead } from '@/types';

type Totals = { nights: number; cents: number; pricedNights: number; perNightCents: number | null; unpriced: number };

type Costs = {
    sleep: Totals;
    transport: Totals;
    byKind: (Totals & { kind: string })[];
    byCountry: (Totals & { country: string | null })[];
    unpaidCents: number;
    unpaidCount: number;
    plannedCents: number;
};

type Props = {
    month: string;
    tonight: string;
    nights: NightProps[];
    ahead: NightsAhead;
    bookings: BookingProps[];
    costs: Costs;
    kinds: BookingKindOption[];
    stops: { id: number; name: string; country: string }[];
    lastCurrency: string | null;
};

const blank = (currency: string | null, checkIn = '', checkOut = ''): BookingFormData => ({
    kind: 'stay',
    title: '',
    location: '',
    stop_id: '',
    url: '',
    check_in: checkIn,
    check_out: checkOut || (checkIn ? addDays(checkIn, 1) : ''),
    status: 'booked',
    paid: false,
    price_amount: '',
    currency: currency ?? 'EUR',
    price_eur: '',
    notes: '',
});

export default function Bookings({ month, tonight, nights, ahead, bookings, costs, kinds, stops, lastCurrency }: Props) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showPast, setShowPast] = useState(false);
    const form = useForm<BookingFormData>(blank(lastCurrency));
    const formRef = useRef<HTMLDivElement>(null);

    const kindLabel = (value: string) => kinds.find((k) => k.value === value)?.label ?? value;

    const reveal = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const startNew = (checkIn = '', checkOut = '') => {
        setEditingId(null);
        form.setData(blank(lastCurrency, checkIn, checkOut));
        form.clearErrors();
        reveal();
    };

    const startEdit = (booking: BookingProps) => {
        setEditingId(booking.id);
        form.setData({
            kind: booking.kind,
            title: booking.title,
            location: booking.location ?? '',
            stop_id: booking.stopId ? String(booking.stopId) : '',
            url: booking.url ?? '',
            check_in: booking.checkIn,
            check_out: booking.checkOut,
            status: booking.status,
            paid: booking.paid,
            // "180.00" -> "180", "12.50" -> "12.5"
            price_amount: booking.priceAmount === null ? '' : String(Number(booking.priceAmount)),
            currency: booking.currency ?? lastCurrency ?? 'EUR',
            price_eur:
                booking.currency !== 'EUR' && booking.priceEurCents !== null
                    ? String(booking.priceEurCents / 100)
                    : '',
            notes: booking.notes ?? '',
        });
        form.clearErrors();
        reveal();
    };

    const reset = () => startNew();

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setEditingId(null) };
        if (editingId) {
            form.put(`/admin/unterkuenfte/${editingId}`, options);
        } else {
            form.post('/admin/unterkuenfte', { ...options, onSuccess: () => form.setData(blank(form.data.currency)) });
        }
    };

    const destroy = () => {
        const booking = bookings.find((b) => b.id === editingId);
        if (!booking || !window.confirm(`„${booking.title}“ wirklich löschen?`)) return;
        router.delete(`/admin/unterkuenfte/${booking.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingId(null);
                form.setData(blank(lastCurrency));
            },
        });
    };

    const goToMonth = (target: string) => {
        router.get(
            '/admin/unterkuenfte',
            { monat: target },
            { preserveState: true, preserveScroll: true, only: ['month', 'nights'] },
        );
    };

    // Eine offene Luecke wird eine neue Buchung; eine geplante oeffnet die
    // Option, die schon dasteht, damit sie gebucht werden kann.
    const fillGap = (gap: NightRun) => {
        const option = bookings.find(
            (b) => b.status === 'planned' && b.checkIn <= gap.from && b.checkOut > gap.from,
        );
        if (gap.state === 'planned' && option) {
            startEdit(option);
        } else {
            startNew(gap.from, addDays(gap.until, 1));
        }
        if (!gap.from.startsWith(month)) goToMonth(gap.from.slice(0, 7));
    };

    const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
    const nextMonth = addDays(`${month}-01`, 32).slice(0, 7);
    const currentMonth = tonight.slice(0, 7);

    const upcoming = bookings.filter((b) => b.checkOut > tonight);
    const past = bookings.filter((b) => b.checkOut <= tonight);
    const listed = showPast ? bookings : upcoming;

    return (
        <AdminLayout title="Unterkünfte" actions={<Button onClick={() => startNew()}>Neue Buchung</Button>}>
            <Head title="Unterkünfte" />

            <AheadPanel ahead={ahead} onFill={fillGap} />

            <dl className="my-6 grid grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-4">
                <Stat
                    label="Schlafen gesamt"
                    value={formatEur(costs.sleep.cents)}
                    note={`${formatNights(costs.sleep.nights)} gebucht`}
                />
                <Stat
                    label="Ø pro Nacht"
                    value={costs.sleep.perNightCents === null ? '–' : formatEur(costs.sleep.perNightCents)}
                    note={
                        costs.sleep.unpriced > 0
                            ? `${costs.sleep.unpriced} Buchung(en) ohne Euro-Preis nicht eingerechnet`
                            : 'Unterkünfte und Workaways'
                    }
                />
                <Stat
                    label="Nachtfahrten"
                    value={formatEur(costs.transport.cents)}
                    note={formatNights(costs.transport.nights)}
                />
                <Stat
                    label="Noch zu zahlen"
                    value={formatEur(costs.unpaidCents)}
                    note={
                        costs.plannedCents > 0
                            ? `dazu ${formatEur(costs.plannedCents)} geplant, nicht gebucht`
                            : `${costs.unpaidCount} gebuchte Buchung(en) offen`
                    }
                />
            </dl>

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="flex flex-col gap-6 xl:col-span-2">
                    <section className="border border-hairline bg-paper">
                        <div className="hairline-b flex items-center justify-between gap-4 px-5 py-3">
                            <h2 className="font-ui text-lg font-bold">{formatMonth(month)}</h2>
                            <div className="flex gap-1">
                                <Button variant="ghost" onClick={() => goToMonth(prevMonth)}>
                                    ← <span className="sr-only">Vorheriger Monat</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => goToMonth(currentMonth)}
                                    disabled={month === currentMonth}
                                >
                                    Heute
                                </Button>
                                <Button variant="ghost" onClick={() => goToMonth(nextMonth)}>
                                    → <span className="sr-only">Nächster Monat</span>
                                </Button>
                            </div>
                        </div>
                        <div className="p-5">
                            <BookingCalendar
                                month={month}
                                tonight={tonight}
                                nights={nights}
                                bookings={bookings}
                                kinds={kinds}
                                selectedId={editingId}
                                onSelectBooking={startEdit}
                                onSelectNight={(date) => startNew(date)}
                            />
                            <Legend />
                        </div>
                    </section>

                    <div className="border border-hairline bg-paper">
                        <div className="hairline-b flex items-center justify-between px-5 py-3">
                            <h2 className="label-xs text-graphite">
                                {showPast ? 'Alle Buchungen' : 'Aktuelle und kommende Buchungen'}
                            </h2>
                            {past.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowPast(!showPast)}
                                    className="label-xs text-graphite hover:text-ink"
                                >
                                    {showPast ? 'Nur kommende' : `Auch vergangene (${past.length})`}
                                </button>
                            )}
                        </div>
                        <BookingTable
                            bookings={listed}
                            tonight={tonight}
                            kindLabel={kindLabel}
                            selectedId={editingId}
                            onSelect={startEdit}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div ref={formRef} className="scroll-mt-6">
                        <Panel title={editingId ? 'Buchung bearbeiten' : 'Neue Buchung'}>
                            <BookingForm
                                form={form}
                                editing={editingId !== null}
                                kinds={kinds}
                                stops={stops}
                                onSubmit={submit}
                                onCancel={reset}
                                onDelete={destroy}
                            />
                        </Panel>
                    </div>

                    <CostPanel costs={costs} kindLabel={kindLabel} />
                </div>
            </div>
        </AdminLayout>
    );
}

/** Die naechsten 30 Naechte auf einen Blick, mit jeder Luecke als Sprungziel. */
function AheadPanel({ ahead, onFill }: { ahead: NightsAhead; onFill: (gap: NightRun) => void }) {
    const count = nightsBetween(ahead.from, ahead.until) + 1;
    const days = Array.from({ length: count }, (_, i) => addDays(ahead.from, i));
    const stateOf = (date: string) =>
        ahead.gaps.find((gap) => gap.from <= date && date <= gap.until)?.state ?? 'booked';
    const isDouble = (date: string) => ahead.conflicts.some((c) => c.from <= date && date <= c.until);

    const allGood = ahead.missing === 0 && ahead.planned === 0 && ahead.doubleBooked === 0;

    return (
        <Panel title={`Die nächsten ${count} Nächte`}>
            <div className="flex gap-px" aria-hidden>
                {days.map((date) => {
                    const state = stateOf(date);
                    return (
                        <div
                            key={date}
                            title={`${formatDay(date)}: ${
                                state === 'missing' ? 'keine Unterkunft' : state === 'planned' ? 'nur geplant' : 'gebucht'
                            }${isDouble(date) ? ', doppelt gebucht' : ''}`}
                            style={state === 'planned' ? { backgroundImage: HATCH } : undefined}
                            className={`h-8 flex-1 ${
                                state === 'missing'
                                    ? 'bg-error'
                                    : state === 'planned'
                                      ? 'border border-ink'
                                      : 'bg-ink'
                            } ${isDouble(date) ? 'outline-2 -outline-offset-4 outline-error' : ''}`}
                        />
                    );
                })}
            </div>
            <div className="mt-1 flex justify-between text-xs text-graphite tabular-nums">
                <span>{formatDay(ahead.from)}</span>
                <span>{formatDay(ahead.until)}</span>
            </div>

            {allGood ? (
                <p className="mt-4 text-sm">Für jede Nacht ist ein Schlafplatz gebucht.</p>
            ) : (
                <>
                    <p className="mt-4 text-sm">
                        {[
                            ahead.missing > 0 && (
                                <strong key="m" className="text-error">
                                    {formatNights(ahead.missing)} ohne Unterkunft
                                </strong>
                            ),
                            ahead.planned > 0 && <span key="p">{formatNights(ahead.planned)} nur geplant</span>,
                            ahead.doubleBooked > 0 && (
                                <span key="d">{formatNights(ahead.doubleBooked)} doppelt gebucht</span>
                            ),
                        ]
                            .filter(Boolean)
                            .flatMap((part, i) => (i === 0 ? [part] : [' · ', part]))}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {ahead.gaps.map((gap) => (
                            <li key={gap.from}>
                                <button
                                    type="button"
                                    onClick={() => onFill(gap)}
                                    className={`min-h-10 border px-3 text-left text-sm hover:bg-ink hover:text-paper ${
                                        gap.state === 'missing' ? 'border-error text-error' : 'border-hairline'
                                    }`}
                                >
                                    {formatPeriod(gap.from, gap.until)} · {formatNights(gap.nights)}
                                    <span className="label-xs ml-2">
                                        {gap.state === 'missing' ? 'Offen – eintragen' : 'Geplant – ansehen'}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {ahead.conflicts.map((conflict) => (
                            <li
                                key={`c${conflict.from}`}
                                className="flex min-h-10 items-center border border-error px-3 text-sm"
                            >
                                {formatPeriod(conflict.from, conflict.until)} · doppelt gebucht
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Panel>
    );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="bg-paper px-4 py-5">
            <dt className="label-xs text-graphite">{label}</dt>
            <dd className="mt-2 font-ui text-3xl font-bold tabular-nums">{value}</dd>
            <dd className="mt-1 text-xs text-graphite">{note}</dd>
        </div>
    );
}

function Legend() {
    return (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-graphite">
            <span>Jedes Feld ist die Nacht, die an diesem Tag beginnt.</span>
            <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 bg-ink" /> gebucht
            </span>
            <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 border border-dashed border-ink" /> geplant
            </span>
            <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 bg-error/10" /> keine Unterkunft
            </span>
        </div>
    );
}

function BookingTable({
    bookings,
    tonight,
    kindLabel,
    selectedId,
    onSelect,
}: {
    bookings: BookingProps[];
    tonight: string;
    kindLabel: (kind: string) => string;
    selectedId: number | null;
    onSelect: (booking: BookingProps) => void;
}) {
    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="hairline-b">
                    <th className="label-xs px-4 py-3 text-left text-graphite">Nächte</th>
                    <th className="label-xs px-4 py-3 text-left text-graphite">Schlafplatz</th>
                    <th className="label-xs px-4 py-3 text-right text-graphite">Preis</th>
                    <th className="label-xs px-4 py-3 text-right text-graphite">pro Nacht</th>
                    <th className="label-xs px-4 py-3 text-left text-graphite">Stand</th>
                </tr>
            </thead>
            <tbody>
                {bookings.map((b) => {
                    const local = b.currency && b.currency !== 'EUR' ? formatMoney(b.priceAmount, b.currency) : '';
                    return (
                        <tr
                            key={b.id}
                            onClick={() => onSelect(b)}
                            className={`hairline-b cursor-pointer last:border-b-0 hover:bg-paper-dim ${
                                b.id === selectedId ? 'bg-paper-dim' : ''
                            } ${b.checkOut <= tonight ? 'text-graphite' : ''}`}
                        >
                            <td className="px-4 py-3 align-top whitespace-nowrap tabular-nums">
                                {formatPeriod(b.checkIn, addDays(b.checkOut, -1))}
                                <span className="block text-xs text-graphite">{formatNights(b.nights)}</span>
                            </td>
                            <td className="px-4 py-3 align-top">
                                <span className="label-xs mr-2 text-graphite">{kindLabel(b.kind)}</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(b);
                                    }}
                                    className="text-left font-medium hover:text-accent"
                                >
                                    {b.title}
                                </button>
                                {b.url && (
                                    <a
                                        href={b.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="ml-2 text-graphite hover:text-accent"
                                        aria-label={`Link zu ${b.title} öffnen`}
                                    >
                                        ↗
                                    </a>
                                )}
                                {(b.location || b.stopName) && (
                                    <span className="block text-xs text-graphite">
                                        {b.location || b.stopName}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
                                {b.priceEurCents !== null ? formatEur(b.priceEurCents) : '–'}
                                {local && <span className="block text-xs text-graphite">{local}</span>}
                            </td>
                            <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
                                {b.priceEurCents !== null ? formatEur(Math.round(b.priceEurCents / b.nights)) : '–'}
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                <span className={b.status === 'planned' ? 'text-graphite' : ''}>
                                    {b.status === 'planned' ? 'Geplant' : 'Gebucht'}
                                </span>
                                <span
                                    className={`block text-xs ${
                                        b.paid || b.status === 'planned' ? 'text-graphite' : 'text-error'
                                    }`}
                                >
                                    {b.paid ? 'bezahlt' : b.status === 'planned' ? '' : 'noch offen'}
                                </span>
                            </td>
                        </tr>
                    );
                })}
                {bookings.length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-graphite">
                            Keine Buchungen. Klick im Kalender auf eine Nacht, um eine anzulegen.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function CostPanel({ costs, kindLabel }: { costs: Costs; kindLabel: (kind: string) => string }) {
    if (costs.byKind.length === 0) return null;

    return (
        <Panel title="Kosten nach Art und Land">
            <table className="w-full text-sm">
                <thead>
                    <tr className="hairline-b">
                        <th className="label-xs pb-2 text-left text-graphite">Art</th>
                        <th className="label-xs pb-2 text-right text-graphite">Nächte</th>
                        <th className="label-xs pb-2 text-right text-graphite">Summe</th>
                        <th className="label-xs pb-2 text-right text-graphite">Ø / Nacht</th>
                    </tr>
                </thead>
                <tbody>
                    {costs.byKind.map((row) => (
                        <CostRow key={row.kind} label={kindLabel(row.kind)} totals={row} />
                    ))}
                </tbody>
            </table>

            {costs.byCountry.length > 0 && (
                <table className="mt-6 w-full text-sm">
                    <thead>
                        <tr className="hairline-b">
                            <th className="label-xs pb-2 text-left text-graphite">Land</th>
                            <th className="label-xs pb-2 text-right text-graphite">Nächte</th>
                            <th className="label-xs pb-2 text-right text-graphite">Summe</th>
                            <th className="label-xs pb-2 text-right text-graphite">Ø / Nacht</th>
                        </tr>
                    </thead>
                    <tbody>
                        {costs.byCountry.map((row) => (
                            <CostRow key={row.country ?? ''} label={row.country ?? 'Ohne Station'} totals={row} />
                        ))}
                    </tbody>
                </table>
            )}

            <p className="mt-4 text-xs leading-relaxed text-graphite">
                Nur gebuchte Buchungen. Länder ergeben sich aus der Station; Nachtfahrten zählen nicht in den
                Schnitt.
            </p>
        </Panel>
    );
}

function CostRow({ label, totals }: { label: string; totals: Totals }) {
    return (
        <tr className="hairline-b last:border-b-0">
            <td className="py-2">{label}</td>
            <td className="py-2 text-right tabular-nums">{totals.nights}</td>
            <td className="py-2 text-right tabular-nums">{formatEur(totals.cents)}</td>
            <td className="py-2 text-right tabular-nums">
                {totals.perNightCents === null ? '–' : formatEur(totals.perNightCents)}
            </td>
        </tr>
    );
}
