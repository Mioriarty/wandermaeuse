import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import RouteMap from '@/Components/RouteMap';
import { Button, Field, Panel, inputClass } from '@/Components/Admin/Ui';
import { formatStay } from '@/lib/format';
import type { StopProps } from '@/types';

type Row = StopProps & { note: string | null; postsCount: number };

const BLANK = {
    name: '',
    slug: '',
    country: '',
    lat: '',
    lng: '',
    arrived_on: '',
    departed_on: '',
    note: '',
};

export default function Stops({ stops }: { stops: Row[] }) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const form = useForm<Record<string, string>>({ ...BLANK });

    const startEdit = (stop: Row) => {
        setEditingId(stop.id);
        form.setData({
            name: stop.name,
            slug: stop.slug,
            country: stop.country,
            lat: String(stop.lat),
            lng: String(stop.lng),
            arrived_on: stop.arrivedOn ?? '',
            departed_on: stop.departedOn ?? '',
            note: stop.note ?? '',
        });
    };

    const reset = () => {
        setEditingId(null);
        form.setData({ ...BLANK });
        form.clearErrors();
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            form.put(`/admin/stationen/${editingId}`, { preserveScroll: true, onSuccess: reset });
        } else {
            form.post('/admin/stationen', { preserveScroll: true, onSuccess: reset });
        }
    };

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= stops.length) return;
        const ids = stops.map((s) => s.id);
        [ids[index], ids[target]] = [ids[target], ids[index]];
        router.put('/admin/stationen/reihenfolge', { ids }, { preserveScroll: true });
    };

    return (
        <AdminLayout title="Stationen">
            <Head title="Stationen" />

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <Panel title="Route">
                        {stops.length > 0 ? (
                            <RouteMap stops={stops} focusStopId={editingId} onSelect={(s) => startEdit(s as Row)} />
                        ) : (
                            <p className="text-sm text-graphite">
                                Noch keine Stationen. Lege rechts die erste an.
                            </p>
                        )}
                    </Panel>

                    <div className="mt-6 border border-hairline bg-paper">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="hairline-b">
                                    <th className="label-xs px-4 py-3 text-left text-graphite">#</th>
                                    <th className="label-xs px-4 py-3 text-left text-graphite">Ort</th>
                                    <th className="label-xs px-4 py-3 text-left text-graphite">Zeitraum</th>
                                    <th className="label-xs px-4 py-3 text-left text-graphite">Einträge</th>
                                    <th className="label-xs px-4 py-3 text-right text-graphite">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stops.map((stop, index) => (
                                    <tr key={stop.id} className="hairline-b last:border-b-0">
                                        <td className="px-4 py-3 text-graphite tabular-nums">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium">{stop.name}</span>
                                            <span className="ml-2 text-graphite">{stop.country}</span>
                                        </td>
                                        <td className="px-4 py-3 text-graphite tabular-nums">
                                            {formatStay(stop) || '–'}
                                        </td>
                                        <td className="px-4 py-3 text-graphite tabular-nums">{stop.postsCount}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <SmallButton label="Nach oben" onClick={() => move(index, -1)} disabled={index === 0}>
                                                    ↑
                                                </SmallButton>
                                                <SmallButton
                                                    label="Nach unten"
                                                    onClick={() => move(index, 1)}
                                                    disabled={index === stops.length - 1}
                                                >
                                                    ↓
                                                </SmallButton>
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(stop)}
                                                    className="label-xs border border-hairline px-3 hover:bg-ink hover:text-paper"
                                                >
                                                    Bearbeiten
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`„${stop.name}“ wirklich löschen?`)) {
                                                            router.delete(`/admin/stationen/${stop.id}`, {
                                                                preserveScroll: true,
                                                            });
                                                        }
                                                    }}
                                                    className="label-xs border border-accent px-3 text-accent hover:bg-accent hover:text-paper"
                                                >
                                                    Löschen
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {stops.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-graphite">
                                            Noch keine Stationen angelegt.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Panel title={editingId ? 'Station bearbeiten' : 'Neue Station'}>
                    <form onSubmit={submit} className="flex flex-col gap-4">
                        <Field label="Ort" error={form.errors.name}>
                            <input
                                className={inputClass}
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                required
                            />
                        </Field>

                        <Field label="Land" error={form.errors.country}>
                            <input
                                className={inputClass}
                                value={form.data.country}
                                onChange={(e) => form.setData('country', e.target.value)}
                                required
                            />
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Breitengrad" error={form.errors.lat}>
                                <input
                                    className={inputClass}
                                    value={form.data.lat}
                                    onChange={(e) => form.setData('lat', e.target.value)}
                                    placeholder="-12.0464"
                                    required
                                />
                            </Field>
                            <Field label="Längengrad" error={form.errors.lng}>
                                <input
                                    className={inputClass}
                                    value={form.data.lng}
                                    onChange={(e) => form.setData('lng', e.target.value)}
                                    placeholder="-77.0428"
                                    required
                                />
                            </Field>
                        </div>

                        <p className="text-xs leading-relaxed text-graphite">
                            Koordinaten bekommst du z. B. bei OpenStreetMap: Rechtsklick auf den Ort →
                            „Adresse anzeigen“.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Ankunft" error={form.errors.arrived_on}>
                                <input
                                    type="date"
                                    className={inputClass}
                                    value={form.data.arrived_on}
                                    onChange={(e) => form.setData('arrived_on', e.target.value)}
                                />
                            </Field>
                            <Field label="Abreise" error={form.errors.departed_on}>
                                <input
                                    type="date"
                                    className={inputClass}
                                    value={form.data.departed_on}
                                    min={form.data.arrived_on || undefined}
                                    onChange={(e) => form.setData('departed_on', e.target.value)}
                                />
                            </Field>
                        </div>

                        <Field label="Notiz" error={form.errors.note}>
                            <textarea
                                className={inputClass}
                                rows={3}
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                            />
                        </Field>

                        <div className="flex justify-between gap-3">
                            {editingId && (
                                <Button variant="ghost" onClick={reset}>
                                    Abbrechen
                                </Button>
                            )}
                            <Button type="submit" disabled={form.processing}>
                                {editingId ? 'Speichern' : 'Station anlegen'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            </div>
        </AdminLayout>
    );
}

function SmallButton({
    children,
    label,
    onClick,
    disabled,
}: {
    children: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className="w-8 border border-hairline text-sm hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-paper disabled:hover:text-ink"
        >
            {children}
        </button>
    );
}
