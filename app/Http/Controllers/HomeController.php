<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Stop;
use App\Support\HomeHero;
use App\Support\Seo;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        $posts = Post::published()
            ->with(['stop', 'coverMedia'])
            ->latest('published_at')
            ->take(4)
            ->get();

        $stops = Stop::orderBy('position')->get();

        // Das Titelbild wird in der Verwaltung unter "Startseite" gewaehlt;
        // ohne Wahl ist es das Aufmacherfoto des juengsten Eintrags.
        $hero = HomeHero::current();

        Seo::set(
            title: 'Wandermäuse',
            description: 'Ein Reiseblog über unsere Reise durch Süd- und Mittelamerika – mit Karte und Bildern.',
            image: $hero?->url() ?? $posts->first()?->coverMedia?->url(),
        );

        return Inertia::render('Home', [
            'hero' => $hero?->toImageProps(),
            'posts' => $posts->map->toCardProps()->all(),
            'stops' => $stops->map->toMapProps()->all(),
            'intro' => [
                'kilometres' => null,
                'countries' => $stops->pluck('country')->unique()->count(),
                'stopCount' => $stops->count(),
            ],
        ]);
    }
}
