import type { InertiaFormProps } from '@inertiajs/react';
import { Button, Field, inputClass } from '@/Components/Admin/Ui';
import { addDays, formatEur, formatNights, nightsBetween } from '@/lib/format';
import type { BookingKindOption } from '@/types';

export type BookingFormData = {
    kind: string;
    title: string;
    location: string;
    stop_id: string;
    url: string;
    check_in: string;
    check_out: string;
    status: 'planned' | 'booked';
    paid: boolean;
    price_amount: string;
    currency: string;
    price_eur: string;
    notes: string;
};

/** Die Waehrungen auf der Strecke; Ecuador, El Salvador und Panama zahlen in Dollar. */
const CURRENCIES = [
    'EUR', 'USD', 'MXN', 'GTQ', 'BZD', 'HNL', 'NIO', 'CRC', 'CUP', 'DOP',
    'COP', 'PEN', 'BOB', 'CLP', 'ARS', 'BRL', 'UYU', 'PYG',
];

type Props = {
    form: InertiaFormProps<BookingFormData>;
    editing: boolean;
    kinds: BookingKindOption[];
    stops: { id: number; name: string; country: string }[];
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    onDelete: () => void;
};

export default function BookingForm({ form, editing, kinds, stops, onSubmit, onCancel, onDelete }: Props) {
    const { data, errors } = form;
    const transport = kinds.find((k) => k.value === data.kind)?.transport ?? false;
    const nights = data.check_in && data.check_out ? nightsBetween(data.check_in, data.check_out) : 0;
    const foreign = data.currency.trim() !== '' && data.currency.trim().toUpperCase() !== 'EUR';

    const amount = parseDecimal(data.price_amount);
    const eur = foreign ? parseDecimal(data.price_eur) : amount;
    const eurCents = eur === null ? null : Math.round(eur * 100);

    const setCheckIn = (value: string) => {
        // Die Abreise rueckt mit, solange sie sonst vor oder auf der Ankunft laege.
        const checkOut = value && (!data.check_out || data.check_out <= value) ? addDays(value, 1) : data.check_out;
        form.setData({ ...data, check_in: value, check_out: checkOut });
    };

    const setStop = (value: string) => {
        const stop = stops.find((s) => String(s.id) === value);
        form.setData({
            ...data,
            stop_id: value,
            location: data.location || (stop ? `${stop.name}, ${stop.country}` : ''),
        });
    };

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
                <span className="label-xs block text-graphite">Art</span>
                <div className="mt-2 grid grid-cols-3 gap-px border border-hairline bg-hairline">
                    {kinds.map((kind) => (
                        <button
                            key={kind.value}
                            type="button"
                            onClick={() => form.setData('kind', kind.value)}
                            aria-pressed={data.kind === kind.value}
                            className={`min-h-10 px-2 text-xs ${
                                data.kind === kind.value ? 'bg-ink text-paper' : 'bg-paper hover:bg-paper-dim'
                            }`}
                        >
                            {kind.label}
                        </button>
                    ))}
                </div>
                {errors.kind && <span className="mt-1 block text-xs text-accent">{errors.kind}</span>}
            </div>

            <Field label={transport ? 'Verbindung' : 'Name'} error={errors.title}>
                <input
                    className={inputClass}
                    value={data.title}
                    onChange={(e) => form.setData('title', e.target.value)}
                    placeholder={transport ? 'Cruz del Sur, Cusco → Puno' : 'Hostel Pariwana'}
                    required
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label={transport ? 'Abfahrt (abends)' : 'Ankunft'} error={errors.check_in}>
                    <input
                        type="date"
                        className={inputClass}
                        value={data.check_in}
                        onChange={(e) => setCheckIn(e.target.value)}
                        required
                    />
                </Field>
                <Field label={transport ? 'Ankunft (morgens)' : 'Abreise'} error={errors.check_out}>
                    <input
                        type="date"
                        className={inputClass}
                        value={data.check_out}
                        min={data.check_in ? addDays(data.check_in, 1) : undefined}
                        onChange={(e) => form.setData('check_out', e.target.value)}
                        required
                    />
                </Field>
            </div>
            {nights > 0 && (
                <p className="-mt-2 text-xs text-graphite">
                    {formatNights(nights)}
                    {eurCents !== null && nights > 1 && ` · ${formatEur(Math.round(eurCents / nights))} pro Nacht`}
                </p>
            )}

            <Field label="Station" error={errors.stop_id} hint="Optional – ordnet die Nacht einem Ort der Route zu.">
                <select className={inputClass} value={data.stop_id} onChange={(e) => setStop(e.target.value)}>
                    <option value="">Keine</option>
                    {stops.map((stop) => (
                        <option key={stop.id} value={stop.id}>
                            {stop.name} ({stop.country})
                        </option>
                    ))}
                </select>
            </Field>

            <Field label={transport ? 'Abfahrtsort' : 'Ort / Adresse'} error={errors.location}>
                <input
                    className={inputClass}
                    value={data.location}
                    onChange={(e) => form.setData('location', e.target.value)}
                />
            </Field>

            <Field label="Link" error={errors.url}>
                <div className="flex gap-2">
                    <input
                        type="url"
                        className={inputClass}
                        value={data.url}
                        onChange={(e) => form.setData('url', e.target.value)}
                        placeholder="https://"
                    />
                    {/^https?:\/\//.test(data.url) && (
                        <a
                            href={data.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="label-xs flex shrink-0 items-center border border-hairline px-3 hover:bg-ink hover:text-paper"
                        >
                            Öffnen ↗
                        </a>
                    )}
                </div>
            </Field>

            <div>
                <span className="label-xs block text-graphite">Stand</span>
                <div className="mt-2 flex items-center gap-3">
                    <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline">
                        {(
                            [
                                ['planned', 'Geplant'],
                                ['booked', 'Gebucht'],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => form.setData('status', value)}
                                aria-pressed={data.status === value}
                                className={`min-h-10 px-4 text-xs ${
                                    data.status === value ? 'bg-ink text-paper' : 'bg-paper hover:bg-paper-dim'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={data.paid}
                            onChange={(e) => form.setData('paid', e.target.checked)}
                        />
                        Bezahlt
                    </label>
                </div>
                {errors.status && <span className="mt-1 block text-xs text-accent">{errors.status}</span>}
            </div>

            <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="Preis gesamt" error={errors.price_amount}>
                    <input
                        inputMode="decimal"
                        className={inputClass}
                        value={data.price_amount}
                        onChange={(e) => form.setData('price_amount', e.target.value)}
                        placeholder={data.kind === 'workaway' ? '0' : ''}
                    />
                </Field>
                <Field label="Währung" error={errors.currency}>
                    <input
                        className={`${inputClass} uppercase`}
                        list="booking-currencies"
                        maxLength={3}
                        value={data.currency}
                        onChange={(e) => form.setData('currency', e.target.value.toUpperCase())}
                    />
                    <datalist id="booking-currencies">
                        {CURRENCIES.map((c) => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>
                </Field>
            </div>

            {foreign && (
                <Field
                    label="Davon in Euro"
                    error={errors.price_eur}
                    hint={
                        amount !== null && eur
                            ? `Kurs: 1 € = ${(amount / eur).toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${data.currency}`
                            : 'Was es in Euro gekostet hat – für Summen und den Schnitt pro Nacht.'
                    }
                >
                    <input
                        inputMode="decimal"
                        className={inputClass}
                        value={data.price_eur}
                        onChange={(e) => form.setData('price_eur', e.target.value)}
                    />
                </Field>
            )}

            <Field label="Notizen" error={errors.notes} hint="Buchungsnummer, Check-in-Zeit, Kontakt …">
                <textarea
                    className={inputClass}
                    rows={3}
                    value={data.notes}
                    onChange={(e) => form.setData('notes', e.target.value)}
                />
            </Field>

            <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-3">
                    {editing && (
                        <>
                            <Button variant="ghost" onClick={onCancel}>
                                Abbrechen
                            </Button>
                            <Button variant="danger" onClick={onDelete}>
                                Löschen
                            </Button>
                        </>
                    )}
                </div>
                <Button type="submit" disabled={form.processing}>
                    {editing ? 'Speichern' : 'Buchung anlegen'}
                </Button>
            </div>
        </form>
    );
}

/** "12,50" wie "12.50"; leer oder unlesbar ist null. */
function parseDecimal(value: string): number | null {
    const n = Number(value.trim().replace(',', '.'));
    return value.trim() === '' || !Number.isFinite(n) ? null : n;
}
