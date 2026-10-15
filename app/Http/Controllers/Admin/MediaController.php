<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Services\MediaService;
use App\Support\MediaUsage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MediaController extends Controller
{
    public function __construct(private readonly MediaService $media) {}

    public function index(): Response
    {
        $page = Media::latest()->paginate(60);
        $usage = MediaUsage::of($page->getCollection()->modelKeys());

        return Inertia::render('Admin/Media', [
            'media' => $page->through(fn (Media $m) => [
                ...$m->toImageProps(),
                'originalName' => $m->original_name,
                'createdAt' => $m->created_at?->toIso8601String(),
                'usedIn' => $usage[$m->id] ?? [],
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'files' => ['required', 'array', 'max:20'],
            'files.*' => ['image', 'mimes:jpeg,jpg,png,webp,heic', 'max:24576'],
        ]);

        // Resizing a 20-megapixel photo into four widths twice over takes a
        // while; shared hosting starts at 30 seconds.
        @set_time_limit(300);

        foreach ($request->file('files') as $file) {
            $this->media->store($file);
        }

        return back()->with('success', 'Bilder hochgeladen.');
    }

    public function update(Request $request, Media $medium): RedirectResponse
    {
        $validated = $request->validate([
            'alt' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $medium->update($validated);

        return back()->with('success', 'Bild aktualisiert.');
    }

    public function destroy(Media $medium): RedirectResponse
    {
        $this->media->delete($medium);

        return back()->with('success', 'Bild gelöscht.');
    }
}
