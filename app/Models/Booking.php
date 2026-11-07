<?php

namespace App\Models;

use App\Enums\BookingKind;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Eine Unterkunft, ein Workaway oder eine Nachtfahrt ueber eine oder mehrere
 * Naechte. check_out ist der Abreisetag und selbst keine Nacht mehr.
 */
class Booking extends Model
{
    /** Erst eine Idee oder Option - die Nacht gilt noch nicht als sicher. */
    public const STATUS_PLANNED = 'planned';

    public const STATUS_BOOKED = 'booked';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'kind' => BookingKind::class,
            'check_in' => 'immutable_date',
            'check_out' => 'immutable_date',
            'paid' => 'boolean',
            'price_amount' => 'decimal:2',
            'price_eur_cents' => 'integer',
        ];
    }

    public function stop(): BelongsTo
    {
        return $this->belongsTo(Stop::class);
    }

    public function nights(): int
    {
        return (int) $this->check_in->diffInDays($this->check_out);
    }

    public function isBooked(): bool
    {
        return $this->status === self::STATUS_BOOKED;
    }

    /**
     * Buchungen mit mindestens einer Nacht in [$from, $until).
     */
    public function scopeCoveringNights(Builder $query, CarbonImmutable $from, CarbonImmutable $until): void
    {
        $query->where('check_in', '<', $until->toDateString())
            ->where('check_out', '>', $from->toDateString());
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminProps(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'title' => $this->title,
            'location' => $this->location,
            'stopId' => $this->stop_id,
            'url' => $this->url,
            'checkIn' => $this->check_in->toDateString(),
            'checkOut' => $this->check_out->toDateString(),
            'nights' => $this->nights(),
            'status' => $this->status,
            'paid' => $this->paid,
            'priceAmount' => $this->price_amount,
            'currency' => $this->currency,
            'priceEurCents' => $this->price_eur_cents,
            'notes' => $this->notes,
        ];
    }
}
