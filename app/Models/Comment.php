<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    use HasFactory;

    public const MAX_IMAGES = 3;

    protected $guarded = [];

    /**
     * The email is never serialised to the public page.
     *
     * @var list<string>
     */
    protected $hidden = ['author_email', 'ip_hash'];

    protected static function booted(): void
    {
        // The database would cascade on its own, but only through Eloquent do
        // the images get to delete their files. Replies first, so a thread
        // takes its photos with it.
        static::deleting(function (Comment $comment) {
            $comment->replies()->get()->each->delete();
            $comment->images()->get()->each->delete();
        });
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * The comment that opened the thread. Null for that comment itself.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_id')->oldest();
    }

    /**
     * The comment this one answers - the thread's first one or a reply in it.
     */
    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'reply_to_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(CommentImage::class)->orderBy('position');
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicProps(): array
    {
        return [
            'id' => $this->id,
            'authorName' => $this->author_name,
            'body' => $this->body,
            'createdAt' => $this->created_at?->toIso8601String(),
            // Indentation already says "answers the first comment"; the name
            // is only worth showing when someone answers a reply further down.
            'replyToName' => $this->reply_to_id !== null && $this->reply_to_id !== $this->parent_id
                ? $this->replyTo?->author_name
                : null,
            'images' => $this->images->map->toPublicProps()->all(),
            'replies' => $this->parent_id === null
                ? $this->replies->map->toPublicProps()->all()
                : [],
        ];
    }
}
