<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BlockType;
use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\Post;
use App\Models\Stop;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PostController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Posts/Index', [
            // Newest first by the days an entry tells of, else by when it went
            // online. Entries with neither are still being written and go on
            // top, most recently touched first (the sort is stable).
            'posts' => Post::with('stop')->latest('updated_at')->get()
                ->sortByDesc(fn (Post $post) => ($post->period_starts_on ?? $post->published_at)?->getTimestamp() ?? PHP_INT_MAX)
                ->values()
                ->map(fn (Post $post) => [
                    'id' => $post->id,
                    'title' => $post->title,
                    'slug' => $post->slug,
                    'status' => $post->status,
                    'publishedAt' => $post->published_at?->toIso8601String(),
                    'period' => $post->periodProps(),
                    'stopName' => $post->stop?->name,
                ])
                ->all(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Posts/Edit', [
            'post' => null,
            'blocks' => [],
            'composition' => null,
            ...$this->formOptions(),
        ]);
    }

    public function edit(Post $post): Response
    {
        $post->load(['blocks', 'composition']);

        return Inertia::render('Admin/Posts/Edit', [
            'post' => [
                'id' => $post->id,
                'title' => $post->title,
                'slug' => $post->slug,
                'excerpt' => $post->excerpt,
                'stop_id' => $post->stop_id,
                'period_starts_on' => $post->period_starts_on?->toDateString(),
                'period_ends_on' => $post->period_ends_on?->toDateString(),
                'cover_media_id' => $post->cover_media_id,
                'status' => $post->status,
                'published_at' => $post->published_at?->format('Y-m-d\TH:i'),
            ],
            'blocks' => $post->blocksWithMedia(),
            'composition' => $post->composition ? [
                'id' => $post->composition->id,
                'title' => $post->composition->title,
                'description' => $post->composition->description,
                'audioUrl' => $post->composition->audioUrl(),
                'durationSeconds' => $post->composition->duration_seconds,
                'scoreUrl' => $post->composition->scoreUrl(),
                'scoreIsPdf' => $post->composition->scoreIsPdf(),
            ] : null,
            ...$this->formOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatePost($request);
        $post = Post::create($this->attributes($data));
        $this->syncBlocks($post, $data['blocks'] ?? []);

        return redirect()->route('admin.posts.edit', $post)->with('success', 'Eintrag angelegt.');
    }

    public function update(Request $request, Post $post): RedirectResponse
    {
        $data = $this->validatePost($request, $post);
        $post->update($this->attributes($data));
        $this->syncBlocks($post, $data['blocks'] ?? []);

        return back()->with('success', 'Eintrag gespeichert.');
    }

    public function destroy(Post $post): RedirectResponse
    {
        $post->delete();

        return redirect()->route('admin.posts.index')->with('success', 'Eintrag gelöscht.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePost(Request $request, ?Post $post = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'slug' => [
                'nullable', 'string', 'max:180', 'alpha_dash',
                Rule::unique('posts', 'slug')->ignore($post?->id),
            ],
            'excerpt' => ['nullable', 'string', 'max:500'],
            'stop_id' => ['nullable', 'exists:stops,id'],
            'period_starts_on' => ['nullable', 'date', 'required_with:period_ends_on'],
            'period_ends_on' => ['nullable', 'date', 'after_or_equal:period_starts_on'],
            'cover_media_id' => ['nullable', 'exists:media,id'],
            'status' => ['required', Rule::in([Post::STATUS_DRAFT, Post::STATUS_SCHEDULED, Post::STATUS_PUBLISHED])],
            'published_at' => ['nullable', 'date'],
            'blocks' => ['array'],
            'blocks.*.type' => ['required', Rule::enum(BlockType::class)],
            'blocks.*.data' => ['present', 'array'],
        ], [
            'period_starts_on.required_with' => 'Ein Ende braucht auch einen Anfang.',
            'period_ends_on.after_or_equal' => 'Das Ende liegt vor dem Anfang.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data): array
    {
        $publishedAt = $data['published_at'] ?? null;

        // Publishing without a date means "now" rather than "never".
        if ($data['status'] === Post::STATUS_PUBLISHED && ! $publishedAt) {
            $publishedAt = now();
        }

        return [
            'title' => $data['title'],
            'slug' => $data['slug'] ?: Str::slug($data['title']),
            'excerpt' => $data['excerpt'] ?? null,
            'stop_id' => $data['stop_id'] ?? null,
            'period_starts_on' => $data['period_starts_on'] ?? null,
            'period_ends_on' => $data['period_ends_on'] ?? null,
            'cover_media_id' => $data['cover_media_id'] ?? null,
            'status' => $data['status'],
            'published_at' => $publishedAt,
            'reading_minutes' => $this->readingMinutes($data['blocks'] ?? []),
        ];
    }

    /**
     * Replace the block list wholesale - the editor always sends the complete,
     * ordered set, so reordering and deleting need no extra bookkeeping.
     *
     * @param  list<array<string, mixed>>  $blocks
     */
    private function syncBlocks(Post $post, array $blocks): void
    {
        $post->blocks()->delete();

        foreach (array_values($blocks) as $position => $block) {
            $post->blocks()->create([
                'type' => $block['type'],
                'position' => $position,
                'data' => $block['data'],
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $blocks
     */
    private function readingMinutes(array $blocks): int
    {
        $words = 0;

        foreach ($blocks as $block) {
            foreach (['html', 'text'] as $key) {
                if (isset($block['data'][$key]) && is_string($block['data'][$key])) {
                    $words += str_word_count(strip_tags($block['data'][$key]));
                }
            }
        }

        return max(1, (int) ceil($words / 200));
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'stops' => Stop::orderBy('position')->get(['id', 'name', 'country'])->all(),
            'blockTypes' => array_map(
                fn (BlockType $type) => [
                    'value' => $type->value,
                    'label' => $type->label(),
                    'blank' => $type->blankData(),
                ],
                BlockType::cases(),
            ),
            'mediaLibrary' => Media::latest()->take(300)->get()->map->toImageProps()->all(),
        ];
    }
}
