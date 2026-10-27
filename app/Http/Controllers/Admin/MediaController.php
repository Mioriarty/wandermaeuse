<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Services\MediaService;
use App\Support\MediaUsage;
use Illuminate\Http\JsonResponse;
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

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $request->validate([
            'files' => ['required', 'array', 'max:20'],
            'files.*' => ['image', 'mimes:jpeg,jpg,png,webp,heic', 'max:24576'],
        ], [
            'files.*.image' => 'Das ist kein Bild.',
            'files.*.mimes' => 'Nur JPEG, PNG, WebP oder HEIC.',
            'files.*.max' => 'Größer als 24 MB.',
        ]);

        // Resizing a 20-megapixel photo into four widths twice over takes a
        // while; shared hosting starts at 30 seconds.
        @set_time_limit(300);

        $stored = array_map(fn ($file) => $this->media->store($file), $request->file('files'));

        // The picker in the post editor uploads without leaving the page, so
        // nothing the editor holds unsaved gets lost; it wants the pictures back.
        if ($request->expectsJson()) {
            return response()->json(['media' => array_map(fn (Media $m) => $m->toLibraryProps(), $stored)], 201);
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
