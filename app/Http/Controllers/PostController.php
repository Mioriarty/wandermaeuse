<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Stop;
use App\Support\Seo;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class PostController extends Controller
{
    public function index(): Response
    {
        $posts = Post::published()
            ->with(['stop', 'coverMedia'])
            ->latest('published_at')
            ->get();

        // Grouped by country, but kept in publication order - the trip reads
        // as a sequence, not as an alphabetised index.
        $groups = $posts
            ->groupBy(fn (Post $post) => $post->stop?->country ?? 'Unterwegs')
            ->map(fn ($group, $country) => [
                'country' => $country,
                'posts' => $group->map->toCardProps()->values()->all(),
            ])
            ->values()
            ->all();

        Seo::set('Einträge', 'Alle Einträge aus unserem Reisetagebuch, nach Ländern sortiert.');

        return Inertia::render('Blog/Index', [
            'groups' => $groups,
            'total' => $posts->count(),
        ]);
    }

    public function show(string $slug): Response
    {
        $query = Post::query()
            ->where('slug', $slug)
            ->with(['stop', 'coverMedia', 'composition', 'blocks', 'comments']);

        // Angemeldet heisst Vorschau: ein Entwurf laesst sich unter seiner
        // spaeteren Adresse ansehen, bevor er jemand anderem gehoert. Fuer
        // alle uebrigen bleibt er, als gaebe es ihn nicht.
        if (! Auth::check()) {
            $query->published();
        }

        $post = $query->firstOrFail();
        $isPreview = ! $post->isPublished();

        // Ein Entwurf hat oft noch gar kein Datum; ohne das ergibt "davor" und
        // "danach" nichts, und der Vergleich mit null faende ohnehin nichts.
        $previous = $post->published_at === null ? null : Post::published()
            ->where('published_at', '<', $post->published_at)
            ->latest('published_at')
            ->first();

        $next = $post->published_at === null ? null : Post::published()
            ->where('published_at', '>', $post->published_at)
            ->oldest('published_at')
            ->first();

        Seo::set(
            title: $post->title,
            description: $post->excerpt,
            image: $post->coverMedia?->url(),
            type: 'article',
            publishedAt: $post->published_at?->toIso8601String(),
            noindex: $isPreview,
        );

        return Inertia::render('Blog/Show', [
            'post' => [
                'id' => $post->id,
                'title' => $post->title,
                'slug' => $post->slug,
                'excerpt' => $post->excerpt,
                'publishedAt' => $post->published_at?->toIso8601String(),
                'readingMinutes' => $post->reading_minutes,
                'stop' => $post->stop?->toMapProps(),
                'status' => $post->status,
            ],
            'isPreview' => $isPreview,
            'blocks' => $post->blocksWithMedia(),
            'composition' => $post->composition?->toPlayerProps(),
            'comments' => $post->comments->map->toPublicProps()->all(),
            // The whole path, so the reader always sees where this entry sits.
            'stops' => Stop::orderBy('position')->get()->map->toMapProps()->all(),
            'neighbours' => [
                'previous' => $previous?->toCardProps(),
                'next' => $next?->toCardProps(),
            ],
        ]);
    }
}
