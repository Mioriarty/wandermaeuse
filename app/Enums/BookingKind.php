<?php

namespace App\Enums;

/**
 * Wie wir eine Nacht verbringen. Unterkunft und Workaway sind ein Bett,
 * alles andere eine Nachtfahrt: die zaehlt als versorgte Nacht, ihr Preis
 * laeuft aber getrennt, damit ein Flug den Schnitt pro Nacht nicht verzerrt.
 */
enum BookingKind: string
{
    case Stay = 'stay';
    case Workaway = 'workaway';
    case Bus = 'bus';
    case Train = 'train';
    case Flight = 'flight';
    case Ferry = 'ferry';

    public function label(): string
    {
        return match ($this) {
            self::Stay => 'Unterkunft',
            self::Workaway => 'Workaway',
            self::Bus => 'Nachtbus',
            self::Train => 'Nachtzug',
            self::Flight => 'Nachtflug',
            self::Ferry => 'Nachtfähre',
        };
    }

    public function isTransport(): bool
    {
        return ! in_array($this, [self::Stay, self::Workaway], true);
    }

    /**
     * Was das Formular und der Kalender ueber die Arten wissen muessen.
     *
     * @return list<array{value: string, label: string, transport: bool}>
     */
    public static function options(): array
    {
        return array_map(fn (self $kind) => [
            'value' => $kind->value,
            'label' => $kind->label(),
            'transport' => $kind->isTransport(),
        ], self::cases());
    }
}
