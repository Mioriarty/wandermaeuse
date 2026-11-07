<?php

namespace App\Support;

use App\Enums\BookingKind;
use App\Models\Booking;
use Illuminate\Support\Collection;

/**
 * Was das Schlafen kostet, in Euro.
 *
 * Gezaehlt werden nur gebuchte Buchungen; geplante sind Optionen, die sich
 * ueberschneiden duerfen, und stehen deshalb als eigene Summe daneben.
 * Den Schnitt pro Nacht bilden nur Buchungen mit bekanntem Euro-Preis, sonst
 * zoege jede Nacht ohne Preis ihn nach unten. Nachtfahrten haben eine eigene
 * Summe und gehen nicht in den Schnitt ein.
 */
class BookingCosts
{
    /**
     * @param  Collection<int, Booking>  $bookings
     * @return array<string, mixed>
     */
    public static function summary(Collection $bookings): array
    {
        $booked = $bookings->filter(fn (Booking $b) => $b->isBooked());
        [$transport, $sleep] = $booked->partition(fn (Booking $b) => $b->kind->isTransport());

        return [
            'sleep' => self::totals($sleep),
            'transport' => self::totals($transport),
            'byKind' => collect(BookingKind::cases())
                ->map(fn (BookingKind $kind) => [
                    'kind' => $kind->value,
                    ...self::totals($booked->filter(fn (Booking $b) => $b->kind === $kind)),
                ])
                ->filter(fn (array $row) => $row['nights'] > 0)
                ->values()
                ->all(),
            'byCountry' => $sleep
                ->groupBy(fn (Booking $b) => $b->stop?->country ?? '')
                ->map(fn (Collection $group, string $country) => [
                    'country' => $country === '' ? null : $country,
                    ...self::totals($group),
                ])
                ->sortByDesc('perNightCents')
                ->values()
                ->all(),
            'unpaidCents' => (int) $booked->filter(fn (Booking $b) => ! $b->paid)->sum('price_eur_cents'),
            'unpaidCount' => $booked->filter(fn (Booking $b) => ! $b->paid && $b->price_eur_cents !== null)->count(),
            'plannedCents' => (int) $bookings
                ->filter(fn (Booking $b) => ! $b->isBooked())
                ->sum('price_eur_cents'),
        ];
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     * @return array{nights: int, cents: int, pricedNights: int, perNightCents: ?int, unpriced: int}
     */
    private static function totals(Collection $bookings): array
    {
        $priced = $bookings->filter(fn (Booking $b) => $b->price_eur_cents !== null);
        $pricedNights = $priced->sum(fn (Booking $b) => $b->nights());
        $cents = (int) $priced->sum('price_eur_cents');

        return [
            'nights' => (int) $bookings->sum(fn (Booking $b) => $b->nights()),
            'cents' => $cents,
            'pricedNights' => (int) $pricedNights,
            'perNightCents' => $pricedNights > 0 ? (int) round($cents / $pricedNights) : null,
            'unpriced' => $bookings->count() - $priced->count(),
        ];
    }
}
