<?php

namespace Tests\Feature;

use App\Enums\BookingKind;
use App\Models\Booking;
use App\Models\Stop;
use App\Models\User;
use App\Support\BookingCosts;
use App\Support\NightCoverage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Mittags in Mexiko - die laufende Nacht ist eindeutig der 7.
        $this->travelTo('2026-11-07 18:00:00');
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'kind' => 'stay',
            'title' => 'Hostel Pariwana',
            'location' => '',
            'stop_id' => '',
            'url' => '',
            'check_in' => '2026-11-07',
            'check_out' => '2026-11-10',
            'status' => 'booked',
            'paid' => false,
            'price_amount' => '',
            'currency' => 'EUR',
            'price_eur' => '',
            'notes' => '',
            ...$overrides,
        ];
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function booking(string $checkIn, string $checkOut, array $attributes = []): Booking
    {
        return Booking::create([
            'kind' => BookingKind::Stay,
            'title' => 'Unterkunft',
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'status' => Booking::STATUS_BOOKED,
            ...$attributes,
        ]);
    }

    public function test_a_booking_paid_in_local_currency_keeps_both_prices(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/unterkuenfte', $this->payload([
                'price_amount' => '180',
                'currency' => 'pen',
                'price_eur' => '45,50',
                'url' => 'https://example.org/hostel',
            ]))
            ->assertSessionHasNoErrors();

        $booking = Booking::sole();
        $this->assertSame('180.00', $booking->price_amount);
        $this->assertSame('PEN', $booking->currency);
        $this->assertSame(4550, $booking->price_eur_cents);
        $this->assertSame(3, $booking->nights());
    }

    public function test_a_euro_price_needs_no_conversion(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/unterkuenfte', $this->payload(['price_amount' => '12,50', 'price_eur' => '99']))
            ->assertSessionHasNoErrors();

        $this->assertSame(1250, Booking::sole()->price_eur_cents);
    }

    public function test_without_an_amount_no_currency_is_stored(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/unterkuenfte', $this->payload(['currency' => 'PEN']))
            ->assertSessionHasNoErrors();

        $booking = Booking::sole();
        $this->assertNull($booking->currency);
        $this->assertNull($booking->price_eur_cents);
    }

    public function test_a_booking_needs_at_least_one_night(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/unterkuenfte', $this->payload(['check_out' => '2026-11-07']))
            ->assertSessionHasErrors('check_out');
    }

    public function test_an_amount_needs_a_currency(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/unterkuenfte', $this->payload(['price_amount' => '20', 'currency' => '']))
            ->assertSessionHasErrors('currency');
    }

    public function test_only_web_links_are_accepted(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/unterkuenfte', $this->payload(['url' => 'javascript:alert(1)']))
            ->assertSessionHasErrors('url');
    }

    public function test_a_booking_can_be_updated_and_deleted(): void
    {
        $user = User::factory()->create();
        $booking = $this->booking('2026-11-07', '2026-11-08');

        $this->actingAs($user)
            ->put("/admin/unterkuenfte/{$booking->id}", $this->payload(['kind' => 'bus', 'title' => 'Cusco → Puno', 'paid' => true]))
            ->assertSessionHasNoErrors();

        $booking->refresh();
        $this->assertSame(BookingKind::Bus, $booking->kind);
        $this->assertTrue($booking->paid);

        $this->actingAs($user)->delete("/admin/unterkuenfte/{$booking->id}");
        $this->assertModelMissing($booking);
    }

    public function test_deleting_a_stop_keeps_its_bookings(): void
    {
        $stop = Stop::create(['name' => 'Cusco', 'slug' => 'cusco', 'country' => 'Peru', 'lat' => -13.5, 'lng' => -72]);
        $booking = $this->booking('2026-11-07', '2026-11-08', ['stop_id' => $stop->id]);

        $stop->delete();

        $this->assertNull($booking->fresh()->stop_id);
    }

    public function test_the_check_out_day_is_not_a_night(): void
    {
        $this->booking('2026-11-07', '2026-11-09');

        $states = array_column(
            NightCoverage::nights(NightCoverage::tonight(), NightCoverage::tonight()->addDays(3)),
            'state',
        );

        $this->assertSame(['booked', 'booked', 'missing'], $states);
    }

    public function test_tonight_lasts_until_the_morning_on_the_travellers_clock(): void
    {
        // 3 Uhr UTC ist 21 Uhr in Mexiko und Mitternacht in Buenos Aires.
        $this->travelTo('2026-11-08 03:00:00');

        $this->assertSame('2026-11-07', NightCoverage::tonight()->toDateString());
    }

    public function test_the_next_month_reports_gaps_and_planned_nights(): void
    {
        $this->booking('2026-11-07', '2026-11-09');
        $this->booking('2026-11-09', '2026-11-10', ['status' => Booking::STATUS_PLANNED]);
        $this->booking('2026-11-12', '2026-11-13', ['kind' => BookingKind::Bus]);

        $ahead = NightCoverage::ahead();

        $this->assertSame('2026-11-07', $ahead['from']);
        $this->assertSame('2026-12-06', $ahead['until']);
        $this->assertSame(1, $ahead['planned']);
        // 30 Naechte, davon 3 gebucht (zwei im Hostel, eine im Bus) und eine geplant.
        $this->assertSame(26, $ahead['missing']);
        $this->assertSame([
            ['from' => '2026-11-09', 'until' => '2026-11-09', 'nights' => 1, 'state' => 'planned'],
            ['from' => '2026-11-10', 'until' => '2026-11-11', 'nights' => 2, 'state' => 'missing'],
            ['from' => '2026-11-13', 'until' => '2026-12-06', 'nights' => 24, 'state' => 'missing'],
        ], $ahead['gaps']);
    }

    public function test_two_bookings_on_one_night_are_flagged_but_planned_options_are_not(): void
    {
        $this->booking('2026-11-07', '2026-11-09');
        $this->booking('2026-11-08', '2026-11-10');
        $this->booking('2026-11-10', '2026-11-11', ['status' => Booking::STATUS_PLANNED]);
        $this->booking('2026-11-10', '2026-11-11', ['status' => Booking::STATUS_PLANNED]);

        $ahead = NightCoverage::ahead();

        $this->assertSame(1, $ahead['doubleBooked']);
        $this->assertSame([['from' => '2026-11-08', 'until' => '2026-11-08', 'nights' => 1, 'state' => 'double']], $ahead['conflicts']);
    }

    public function test_costs_keep_transport_planned_and_unpriced_out_of_the_average(): void
    {
        $peru = Stop::create(['name' => 'Cusco', 'slug' => 'cusco', 'country' => 'Peru', 'lat' => -13.5, 'lng' => -72]);

        $this->booking('2026-11-01', '2026-11-05', ['price_eur_cents' => 8000, 'stop_id' => $peru->id, 'paid' => true]);
        $this->booking('2026-11-05', '2026-11-07', ['kind' => BookingKind::Workaway, 'price_eur_cents' => 0, 'stop_id' => $peru->id]);
        $this->booking('2026-11-07', '2026-11-08', ['kind' => BookingKind::Bus, 'price_eur_cents' => 3500]);
        $this->booking('2026-11-08', '2026-11-09');
        $this->booking('2026-11-09', '2026-11-10', ['status' => Booking::STATUS_PLANNED, 'price_eur_cents' => 9999]);

        $costs = BookingCosts::summary(Booking::with('stop')->get());

        $this->assertSame(8000, $costs['sleep']['cents']);
        $this->assertSame(7, $costs['sleep']['nights']);
        // 80 € auf 6 Naechte mit Preis; die eine ohne Preis zieht den Schnitt nicht herunter.
        $this->assertSame(1333, $costs['sleep']['perNightCents']);
        $this->assertSame(1, $costs['sleep']['unpriced']);
        $this->assertSame(3500, $costs['transport']['cents']);
        $this->assertSame(3500, $costs['unpaidCents']);
        $this->assertSame(9999, $costs['plannedCents']);
        $this->assertSame('Peru', $costs['byCountry'][0]['country']);
        $this->assertSame(6, $costs['byCountry'][0]['nights']);
    }

    public function test_the_calendar_shows_whole_weeks_of_the_chosen_month(): void
    {
        $this->booking('2026-11-07', '2026-11-09');

        $this->actingAs(User::factory()->create())
            ->get('/admin/unterkuenfte?monat=2027-02')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Bookings')
                ->where('month', '2027-02')
                ->where('tonight', '2026-11-07')
                // Februar 2027 beginnt an einem Montag und endet an einem Sonntag.
                ->has('nights', 28)
                ->where('nights.0.date', '2027-02-01')
                ->has('bookings', 1)
                ->where('ahead.missing', 28));
    }

    public function test_a_broken_month_falls_back_to_the_current_one(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/admin/unterkuenfte?monat=2026-13')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('month', '2026-11')
                // November 2026: Montag, 26. Oktober bis Sonntag, 6. Dezember.
                ->has('nights', 42)
                ->where('nights.0.date', '2026-10-26'));
    }

    public function test_the_dashboard_warns_about_missing_nights(): void
    {
        $this->booking('2026-11-07', '2026-11-27');

        $this->actingAs(User::factory()->create())
            ->get('/admin')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('nightsAhead.missing', 10)
                ->where('nightsAhead.gaps.0.from', '2026-11-27'));
    }
}
