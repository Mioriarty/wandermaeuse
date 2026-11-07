<?php

namespace App\Support;

use App\Models\Booking;
use Carbon\CarbonImmutable;

/**
 * Fuer welche Naechte wir einen Schlafplatz haben.
 *
 * Kalender und Uebersicht der Verwaltung muessen dieselben Luecken melden,
 * deshalb steht die Regel hier einmal: Eine Nacht ist versorgt, wenn eine
 * gebuchte Buchung sie abdeckt; nur geplante Buchungen machen sie "geplant";
 * ohne beides fehlt sie. Zwei gebuchte Buchungen in einer Nacht sind eine
 * Doppelbuchung - geplante Optionen nebeneinander dagegen nicht.
 */
class NightCoverage
{
    /**
     * Der Bezug fuer "heute Nacht". Die Reise laeuft zwischen UTC-6 und UTC-3;
     * in UTC waere die laufende Nacht ab dem fruehen Abend schon gestern. Die
     * westlichste Zone haelt sie fuer alle Orte bis nach Mitternacht offen -
     * und um ein Uhr nachts liegt man ja noch im Bett von gestern.
     */
    public const TIMEZONE = 'America/Mexico_City';

    /** So weit schaut die Uebersicht nach fehlenden Naechten. */
    public const LOOKAHEAD_NIGHTS = 30;

    public const MISSING = 'missing';

    public const PLANNED = 'planned';

    public const BOOKED = 'booked';

    /** Das Datum der laufenden Nacht, als reiner Tag in der App-Zeitzone. */
    public static function tonight(): CarbonImmutable
    {
        return CarbonImmutable::parse(CarbonImmutable::now(self::TIMEZONE)->toDateString());
    }

    /**
     * Jede Nacht in [$from, $until) mit ihrem Zustand.
     *
     * @return list<array{date: string, state: string, bookingIds: list<int>, doubleBooked: bool}>
     */
    public static function nights(CarbonImmutable $from, CarbonImmutable $until): array
    {
        $bookings = Booking::coveringNights($from, $until)->orderBy('check_in')->get();
        $nights = [];

        for ($night = $from; $night < $until; $night = $night->addDay()) {
            $covering = $bookings->filter(fn (Booking $b) => $b->check_in <= $night && $b->check_out > $night);
            $booked = $covering->filter(fn (Booking $b) => $b->isBooked());

            $nights[] = [
                'date' => $night->toDateString(),
                'state' => match (true) {
                    $booked->isNotEmpty() => self::BOOKED,
                    $covering->isNotEmpty() => self::PLANNED,
                    default => self::MISSING,
                },
                'bookingIds' => $covering->pluck('id')->values()->all(),
                'doubleBooked' => $booked->count() > 1,
            ];
        }

        return $nights;
    }

    /**
     * Die naechsten Naechte ab heute, zusammengefasst fuer Uebersicht und Kalender.
     *
     * @return array{from: string, until: string, missing: int, planned: int, doubleBooked: int, gaps: list<array{from: string, until: string, nights: int, state: string}>, conflicts: list<array{from: string, until: string, nights: int, state: string}>}
     */
    public static function ahead(int $count = self::LOOKAHEAD_NIGHTS): array
    {
        $from = self::tonight();
        $nights = self::nights($from, $from->addDays($count));

        return [
            'from' => $from->toDateString(),
            // Die letzte betrachtete Nacht, nicht der Morgen danach.
            'until' => $from->addDays($count - 1)->toDateString(),
            'missing' => count(array_filter($nights, fn ($n) => $n['state'] === self::MISSING)),
            'planned' => count(array_filter($nights, fn ($n) => $n['state'] === self::PLANNED)),
            'doubleBooked' => count(array_filter($nights, fn ($n) => $n['doubleBooked'])),
            'gaps' => self::runs($nights, fn ($n) => $n['state'] === self::BOOKED ? null : $n['state']),
            'conflicts' => self::runs($nights, fn ($n) => $n['doubleBooked'] ? 'double' : null),
        ];
    }

    /**
     * Fasst aufeinanderfolgende Naechte mit demselben Schluessel zu Strecken
     * zusammen; null bricht eine Strecke ab. "until" ist die letzte Nacht.
     *
     * @param  list<array{date: string, state: string, bookingIds: list<int>, doubleBooked: bool}>  $nights
     * @param  callable(array): ?string  $key
     * @return list<array{from: string, until: string, nights: int, state: string}>
     */
    private static function runs(array $nights, callable $key): array
    {
        $runs = [];
        $current = null;

        foreach ($nights as $night) {
            $state = $key($night);

            if ($current !== null && $current['state'] === $state) {
                $current['until'] = $night['date'];
                $current['nights']++;

                continue;
            }

            if ($current !== null) {
                $runs[] = $current;
            }

            $current = $state === null ? null : [
                'from' => $night['date'],
                'until' => $night['date'],
                'nights' => 1,
                'state' => $state,
            ];
        }

        if ($current !== null) {
            $runs[] = $current;
        }

        return $runs;
    }
}
