<?php

namespace Tests\Feature;

use App\Models\Stop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Manche Orte besuchen wir mehrmals - San José liegt zwischen fast allem in
 * Costa Rica. Jeder Besuch ist eine eigene Station mit eigenen Daten.
 */
class StopRevisitTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'San José',
            'slug' => '',
            'country' => 'Costa Rica',
            'lat' => 9.9281,
            'lng' => -84.0907,
            'arrived_on' => '',
            'departed_on' => '',
            'note' => '',
            ...$overrides,
        ];
    }

    public function test_each_visit_gets_its_own_slug(): void
    {
        $admin = User::factory()->create();

        foreach (['2026-11-10', '2026-11-16', '2026-11-22'] as $arrival) {
            $this->actingAs($admin)
                ->post('/admin/stationen', $this->payload(['arrived_on' => $arrival]))
                ->assertSessionHasNoErrors();
        }

        $this->assertSame(['san-jose', 'san-jose-2', 'san-jose-3'], Stop::orderBy('position')->pluck('slug')->all());
    }

    public function test_editing_a_later_visit_keeps_its_slug(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin)->post('/admin/stationen', $this->payload());
        $this->actingAs($admin)->post('/admin/stationen', $this->payload());
        $second = Stop::where('slug', 'san-jose-2')->sole();

        $this->actingAs($admin)
            ->put("/admin/stationen/{$second->id}", $this->payload(['note' => 'Wieder hier.']))
            ->assertSessionHasNoErrors();

        $this->assertSame('san-jose-2', $second->fresh()->slug);
    }

    public function test_a_place_visited_twice_counts_as_one_stop(): void
    {
        $this->travelTo('2026-11-20 18:00:00');

        foreach ([['San José', '2026-11-10', 0], ['Monteverde', '2026-11-12', 1], ['San José', '2026-11-16', 2]] as [$name, $arrival, $position]) {
            Stop::create([
                ...$this->payload(['name' => $name, 'arrived_on' => $arrival]),
                'slug' => str($name)->slug().'-'.$position,
                'lat' => $name === 'San José' ? 9.9281 : 10.3,
                'position' => $position,
            ]);
        }

        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page
            ->has('stops', 3)
            ->where('intro.stopCount', 2));
    }
}
