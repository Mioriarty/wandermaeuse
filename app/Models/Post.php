<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class Post extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_PUBLISHED = 'published';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function stop(): BelongsTo
    {
        return $this->belongsTo(Stop::class);
    }

    public function coverMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(PostBlock::class)->orderBy('position');
    }

    public function composition(): HasOne
    {
        return $this->hasOne(Composition::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class)->oldest();
    }

    /**
     * Published means: marked published and the publication moment has passed.
     * Scheduled posts flip over on their own via the scheduler.
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED
            && $this->published_at !== null
            && $this->published_at->lessThanOrEqualTo(Carbon::now());
    }

    /**
     * Resolve every block's media ids into image props in a single query, so
     * rendering a post with six galleries is still two queries, not sixty.
     *
     * @return list<array<string, mixed>>
     */
    public function blocksWithMedia(): array
    {
        $blocks = $this->relationLoaded('blocks') ? $this->blocks : $this->blocks()->get();

        $ids = $blocks->flatMap->mediaIds()->unique()->all();
        $media = Media::whereIn('id', $ids)->get()->keyBy('id');

        return $blocks->map(function (PostBlock $block) use ($media) {
            $images = [];
            foreach ($block->mediaIds() as $id) {
                if ($found = $media->get($id)) {
                    $images[] = $found->toImageProps();
                }
            }

            return [
                'id' => $block->id,
                'type' => $block->type->value,
                'data' => $block->data ?? [],
                'images' => $images,
            ];
        })->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCardProps(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'publishedAt' => $this->published_at?->toIso8601String(),
            'readingMinutes' => $this->reading_minutes,
            'stop' => $this->stop ? [
                'name' => $this->stop->name,
                'country' => $this->stop->country,
            ] : null,
            'cover' => $this->coverMedia?->toImageProps(),
        ];
    }
}
