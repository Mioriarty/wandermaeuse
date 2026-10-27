<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    use HasFactory;

    protected $table = 'media';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'variants' => 'array',
            'taken_at' => 'datetime',
            'aspect_ratio' => 'float',
        ];
    }

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    /**
     * A srcset over the generated widths, so phones fetch a 480px file rather
     * than the 2400px original.
     */
    public function srcset(string $format = 'webp'): string
    {
        $variants = $this->variants[$format] ?? [];

        $entries = [];
        foreach ($variants as $width => $path) {
            $entries[] = Storage::disk('public')->url($path).' '.$width.'w';
        }

        return implode(', ', $entries);
    }

    /**
     * The payload the React components consume.
     *
     * @return array<string, mixed>
     */
    public function toImageProps(): array
    {
        return [
            'id' => $this->id,
            'src' => $this->url(),
            'srcset' => $this->srcset(),
            'jpegSrcset' => $this->srcset('jpeg'),
            'width' => $this->width,
            'height' => $this->height,
            'aspectRatio' => $this->aspect_ratio ?: 1.0,
            'dominantColor' => $this->dominant_color,
            'alt' => $this->alt ?? '',
            'caption' => $this->caption,
        ];
    }

    /**
     * What the admin's picture picker needs on top: the file name to search
     * by. Never on public pages - it would leak how the photos are named.
     *
     * @return array<string, mixed>
     */
    public function toLibraryProps(): array
    {
        return [
            ...$this->toImageProps(),
            'originalName' => $this->original_name,
        ];
    }
}
