<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Stop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Die oeffentliche Karte zeigt nur, wo wir schon angekommen sind. Die
 * Verwaltung sieht die ganze Route und weiss, welche Stationen noch kommen.
 */
class StopVisibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // 21 Uhr in Mexiko-Stadt, in UTC schon der naechste Tag.
        $this->travelTo('2026-11-08 03:00:00');

        $this->stop('Oaxaca', 0, '2026-10-20');
        $this->stop('Puebla', 1, '2026-11-07');
        $this->stop('Chiapas', 2, '2026-11-08');
        $this->stop('Yucatán', 3, null);
    }

    private function stop(string $name, int $position, ?string $arrivedOn): Stop
    {
        return Stop::create([
            'name' => $name,
            'slug' => str($name)->slug(),
            'country' => 'Mexiko',
            'lat' => 17.0,
            'lng' => -96.7,
            'arrived_on' => $arrivedOn,
            'position' => $position,
        ]);
    }

    public function test_the_route_page_shows_only_started_stops(): void
    {
        $this->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page
            ->has('stops', 2)
            ->where('stops.0.name', 'Oaxaca')
            ->where('stops.1.name', 'Puebla'));
    }

    public function test_the_home_page_counts_only_started_stops(): void
    {
        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page
            ->has('stops', 2)
            ->where('intro.stopCount', 2));
    }

    public function test_an_entry_shows_only_started_stops(): void
    {
        Post::create([
            'title' => 'Unterwegs',
            'slug' => 'unterwegs',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subDay(),
        ]);

        $this->get('/blog/unterwegs')->assertInertia(fn (AssertableInertia $page) => $page
            ->has('stops', 2));
    }

    public function test_the_admin_sees_every_stop_and_which_ones_are_still_ahead(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/admin/stationen')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('stops', 4)
                ->where('stops.0.started', true)
                ->where('stops.1.started', true)
                ->where('stops.2.started', false)
                ->where('stops.3.started', false));
    }

    public function test_the_last_reached_stop_is_where_we_are(): void
    {
        $this->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('stops.0.current', false)
            ->where('stops.1.current', true));
    }

    public function test_after_the_departure_day_no_stop_is_where_we_are(): void
    {
        Stop::where('name', 'Puebla')->update(['departed_on' => '2026-11-06']);

        $this->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('stops.0.current', false)
            ->where('stops.1.current', false));
    }

    public function test_on_the_departure_day_we_are_still_there(): void
    {
        Stop::where('name', 'Puebla')->update(['departed_on' => '2026-11-07']);

        $this->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('stops.1.current', true));
    }
}
