<?php

namespace App\Models;

use App\Support\NightCoverage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stop extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
            'arrived_on' => 'date',
            'departed_on' => 'date',
        ];
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    /**
     * Stationen, an denen wir schon angekommen sind. Nur die zeigt die
     * oeffentliche Seite - wohin es noch geht, verraten wir nicht vorab.
     * Ohne Ankunftsdatum ist eine Station noch Plan und bleibt verborgen.
     * "Heute" ist derselbe Tag wie bei den Naechten (NightCoverage).
     */
    public function scopeStarted(Builder $query): void
    {
        $query->whereNotNull('arrived_on')
            ->whereDate('arrived_on', '<=', NightCoverage::tonight()->toDateString());
    }

    public function hasStarted(): bool
    {
        return $this->arrived_on !== null && $this->arrived_on->lte(NightCoverage::tonight());
    }

    /**
     * Wo wir heute sind: die zuletzt erreichte Station, solange ihr Abreisetag
     * nicht vorbei ist. Danach sind wir unterwegs und die Karte markiert
     * nichts, bis die naechste Station ankommt. Einmal pro Anfrage gerechnet,
     * jede Station fragt beim Umwandeln fuer die Karte danach.
     */
    public static function current(): ?self
    {
        return once(function () {
            $latest = static::started()->orderByDesc('arrived_on')->orderByDesc('position')->first();

            return $latest && ($latest->departed_on === null || $latest->departed_on->gte(NightCoverage::tonight()))
                ? $latest
                : null;
        });
    }

    /**
     * The payload the map component consumes.
     *
     * @return array<string, mixed>
     */
    public function toMapProps(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'country' => $this->country,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'arrivedOn' => $this->arrived_on?->toDateString(),
            'departedOn' => $this->departed_on?->toDateString(),
            'position' => $this->position,
            'started' => $this->hasStarted(),
            'current' => static::current()?->is($this) ?? false,
        ];
    }
}
