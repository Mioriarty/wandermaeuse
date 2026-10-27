<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Stop;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StopController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Stops', [
            'stops' => Stop::withCount('posts')->orderBy('position')->get()->map(fn (Stop $stop) => [
                ...$stop->toMapProps(),
                'note' => $stop->note,
                'postsCount' => $stop->posts_count,
            ])->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateStop($request);
        $data['position'] = (int) (Stop::max('position') ?? -1) + 1;

        Stop::create($data);

        return back()->with('success', 'Station angelegt.');
    }

    public function update(Request $request, Stop $stop): RedirectResponse
    {
        $stop->update($this->validateStop($request, $stop));

        return back()->with('success', 'Station gespeichert.');
    }

    public function destroy(Stop $stop): RedirectResponse
    {
        $stop->delete();

        return back()->with('success', 'Station gelöscht.');
    }

    /**
     * Persist a new order for the whole route in one go.
     */
    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:stops,id'],
        ]);

        foreach ($validated['ids'] as $position => $id) {
            Stop::whereKey($id)->update(['position' => $position]);
        }

        return back()->with('success', 'Reihenfolge gespeichert.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateStop(Request $request, ?Stop $stop = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash', Rule::unique('stops', 'slug')->ignore($stop?->id)],
            'country' => ['required', 'string', 'max:80'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'arrived_on' => ['nullable', 'date', 'required_with:departed_on'],
            'departed_on' => ['nullable', 'date', 'after_or_equal:arrived_on'],
            'note' => ['nullable', 'string', 'max:1000'],
        ], [
            'arrived_on.required_with' => 'Eine Abreise braucht auch eine Ankunft.',
            'departed_on.after_or_equal' => 'Die Abreise liegt vor der Ankunft.',
        ]);

        $data['slug'] = $data['slug'] ?: Str::slug($data['name']);

        return $data;
    }
}
