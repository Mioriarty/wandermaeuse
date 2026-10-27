<?php

namespace Tests\Feature;

use App\Models\Stop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class StopStayTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Cusco',
            // The form always sends every field, empty or not.
            'slug' => '',
            'country' => 'Peru',
            'lat' => -13.5319,
            'lng' => -71.9675,
            'arrived_on' => '',
            'departed_on' => '',
            'note' => '',
            ...$overrides,
        ];
    }

    public function test_a_stay_is_stored(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/stationen', $this->payload(['arrived_on' => '2026-03-01', 'departed_on' => '2026-03-11']))
            ->assertSessionHasNoErrors();

        $stop = Stop::sole();
        $this->assertSame('2026-03-01', $stop->arrived_on->toDateString());
        $this->assertSame('2026-03-11', $stop->departed_on->toDateString());
    }

    public function test_a_departure_needs_an_arrival(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/stationen', $this->payload(['departed_on' => '2026-03-11']))
            ->assertSessionHasErrors('arrived_on');
    }

    public function test_the_departure_cannot_lie_before_the_arrival(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/stationen', $this->payload(['arrived_on' => '2026-03-11', 'departed_on' => '2026-03-01']))
            ->assertSessionHasErrors('departed_on');
    }

    public function test_the_route_page_carries_both_dates(): void
    {
        Stop::create([
            'name' => 'Cusco',
            'slug' => 'cusco',
            'country' => 'Peru',
            'lat' => -13.5319,
            'lng' => -71.9675,
            'arrived_on' => '2026-03-01',
            'departed_on' => '2026-03-11',
        ]);

        $this->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('stops.0.arrivedOn', '2026-03-01')
            ->where('stops.0.departedOn', '2026-03-11'));
    }
}
