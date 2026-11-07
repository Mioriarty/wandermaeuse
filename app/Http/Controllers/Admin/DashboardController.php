<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Media;
use App\Models\Post;
use App\Models\Stop;
use App\Models\Subscriber;
use App\Support\NightCoverage;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'published' => Post::published()->count(),
                'drafts' => Post::where('status', '!=', Post::STATUS_PUBLISHED)->count(),
                'stops' => Stop::count(),
                'media' => Media::count(),
                'comments' => Comment::count(),
                'subscribers' => Subscriber::mailable()->count(),
                'pendingSubscribers' => Subscriber::whereNull('confirmed_at')->whereNull('unsubscribed_at')->count(),
            ],
            'nightsAhead' => NightCoverage::ahead(),
            'recentPosts' => Post::latest('updated_at')->take(5)->get()->map(fn (Post $post) => [
                'id' => $post->id,
                'title' => $post->title,
                'status' => $post->status,
                'updatedAt' => $post->updated_at?->toIso8601String(),
            ])->all(),
            'recentComments' => Comment::with('post')->latest()->take(5)->get()->map(fn (Comment $c) => [
                'id' => $c->id,
                'authorName' => $c->author_name,
                'body' => $c->body,
                'postTitle' => $c->post?->title,
                'createdAt' => $c->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }
}
