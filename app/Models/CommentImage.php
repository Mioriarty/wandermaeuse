<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CommentImage extends Model
{
    protected $guarded = [];

    protected static function booted(): void
    {
        // The row goes, the files go. Without this every deleted comment
        // would leave its photos behind on the webspace.
        static::deleting(function (CommentImage $image) {
            Storage::disk('public')->delete([$image->path, $image->thumb_path]);
        });
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicProps(): array
    {
        $disk = Storage::disk('public');

        return [
            'id' => $this->id,
            'src' => $disk->url($this->path),
            'thumb' => $disk->url($this->thumb_path),
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
