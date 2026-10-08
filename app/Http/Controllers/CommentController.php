<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Post;
use App\Services\CommentImageService;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class CommentController extends Controller
{
    public function __construct(private readonly CommentImageService $images) {}

    public function store(Request $request, string $slug): RedirectResponse
    {
        $post = Post::published()->where('slug', $slug)->firstOrFail();

        $validated = $request->validate([
            'author_name' => ['required', 'string', 'min:2', 'max:80'],
            'author_email' => ['nullable', 'email', 'max:180'],
            'body' => ['required', 'string', 'min:2', 'max:4000'],
            'website' => ['nullable', 'size:0'],
            // Only a comment under this very entry can be answered.
            'reply_to' => ['nullable', 'integer', Rule::exists('comments', 'id')->where('post_id', $post->id)],
            'images' => ['nullable', 'array', 'max:'.Comment::MAX_IMAGES],
            // `mimes` reads the type from the file's content, not from the
            // name or the Content-Type the browser claims. The pixel check
            // runs last, on a file already known to be an image.
            'images.*' => [
                'bail',
                'file',
                'mimes:jpeg,jpg,png,webp',
                'max:10240',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (! $value instanceof UploadedFile || ! CommentImageService::withinPixelLimit($value)) {
                        $fail('Dieses Bild ist zu groß. Bitte nimm ein kleineres Foto.');
                    }
                },
            ],
        ], [
            'author_name.required' => 'Bitte sag uns, wie du heißt.',
            'body.required' => 'Der Kommentar ist noch leer.',
            'body.max' => 'Das ist etwas lang – bitte kürze auf 4000 Zeichen.',
            'website.size' => 'Die Nachricht konnte nicht gesendet werden.',
            'reply_to.exists' => 'Den Kommentar, auf den du antworten wolltest, gibt es nicht mehr.',
            'images.max' => 'Bitte höchstens '.Comment::MAX_IMAGES.' Bilder pro Kommentar.',
            'images.*.file' => 'Ein Bild ist beim Hochladen verloren gegangen. Bitte versuch es noch einmal.',
            'images.*.mimes' => 'Bitte nur Fotos als JPEG, PNG oder WebP.',
            'images.*.max' => 'Ein Bild ist größer als 10 MB.',
        ]);

        $ipHash = hash('sha256', $request->ip().config('app.key'));

        // Ten comments an hour from one address is plenty for a family blog
        // and stops a script from filling the page.
        $key = 'comments:'.$ipHash;
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages([
                'body' => 'Du hast gerade viele Kommentare geschrieben. Bitte versuch es später noch einmal.',
            ]);
        }
        RateLimiter::hit($key, 3600);

        $replyTo = isset($validated['reply_to']) ? Comment::find($validated['reply_to']) : null;

        // Decoding and re-encoding a phone photo takes a moment; shared
        // hosting starts at 30 seconds.
        @set_time_limit(120);

        $stored = [];
        try {
            foreach ($request->file('images', []) as $file) {
                $stored[] = $this->images->store($file);
            }
        } catch (Throwable $e) {
            $this->images->discard($stored);
            report($e);

            throw ValidationException::withMessages([
                'images' => 'Ein Bild ließ sich nicht verarbeiten. Bitte versuch es mit einem anderen Foto.',
            ]);
        }

        try {
            DB::transaction(function () use ($post, $validated, $ipHash, $replyTo, $stored) {
                $comment = Comment::create([
                    'post_id' => $post->id,
                    'parent_id' => $replyTo ? ($replyTo->parent_id ?? $replyTo->id) : null,
                    'reply_to_id' => $replyTo?->id,
                    'author_name' => $validated['author_name'],
                    'author_email' => $validated['author_email'] ?? null,
                    'body' => $validated['body'],
                    'ip_hash' => $ipHash,
                ]);

                foreach ($stored as $position => $image) {
                    $comment->images()->create([...$image, 'position' => $position]);
                }
            });
        } catch (Throwable $e) {
            $this->images->discard($stored);

            throw $e;
        }

        return back()->with('success', 'Danke für deinen Kommentar.');
    }
}
