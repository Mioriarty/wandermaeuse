<?php

namespace App\Models;

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
        ];
    }
}
