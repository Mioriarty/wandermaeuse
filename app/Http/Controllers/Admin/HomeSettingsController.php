<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\Setting;
use App\Support\HomeHero;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeSettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('Admin/Home', [
            'mediaId' => HomeHero::chosen()?->id,
            'fallback' => HomeHero::fallback()?->toImageProps(),
            'mediaLibrary' => Media::latest()->take(300)->get()->map->toLibraryProps()->all(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'media_id' => ['nullable', 'integer', 'exists:media,id'],
        ]);

        Setting::set(Setting::HOME_MEDIA, $validated['media_id'] ?? null);

        return back()->with('success', $validated['media_id'] === null
            ? 'Titelbild zurückgesetzt – es zeigt wieder das neueste Aufmacherfoto.'
            : 'Titelbild gespeichert.');
    }
}
