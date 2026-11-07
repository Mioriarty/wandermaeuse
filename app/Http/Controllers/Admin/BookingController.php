<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BookingKind;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Stop;
use App\Support\BookingCosts;
use App\Support\NightCoverage;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BookingController extends Controller
{
    public function index(Request $request): Response
    {
        $month = $this->month($request->query('monat'));

        // Der Kalender zeigt ganze Wochen, Montag bis Sonntag.
        $gridFrom = $month->startOfWeek(CarbonImmutable::MONDAY);
        $gridUntil = $month->endOfMonth()->endOfWeek(CarbonImmutable::SUNDAY)->startOfDay()->addDay();

        $bookings = Booking::with('stop')->orderBy('check_in')->orderBy('id')->get();

        return Inertia::render('Admin/Bookings', [
            'month' => $month->format('Y-m'),
            'tonight' => NightCoverage::tonight()->toDateString(),
            'nights' => NightCoverage::nights($gridFrom, $gridUntil),
            'ahead' => NightCoverage::ahead(),
            'bookings' => $bookings->map(fn (Booking $b) => [
                ...$b->toAdminProps(),
                'stopName' => $b->stop?->name,
            ])->all(),
            'costs' => BookingCosts::summary($bookings),
            'kinds' => BookingKind::options(),
            'stops' => Stop::orderBy('position')->get(['id', 'name', 'country'])->all(),
            // Wer in Peru ist, bucht die naechste Nacht meist auch in Soles.
            'lastCurrency' => Booking::whereNotNull('currency')->latest('id')->value('currency'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Booking::create($this->validateBooking($request));

        return back()->with('success', 'Buchung angelegt.');
    }

    public function update(Request $request, Booking $booking): RedirectResponse
    {
        $booking->update($this->validateBooking($request));

        return back()->with('success', 'Buchung gespeichert.');
    }

    public function destroy(Booking $booking): RedirectResponse
    {
        $booking->delete();

        return back()->with('success', 'Buchung gelöscht.');
    }

    /** Der erste Tag des gewuenschten Monats; ohne gueltige Angabe der laufende. */
    private function month(mixed $value): CarbonImmutable
    {
        if (is_string($value) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value)) {
            return CarbonImmutable::parse("{$value}-01");
        }

        return NightCoverage::tonight()->startOfMonth();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateBooking(Request $request): array
    {
        // Im Formular tippt man "12,50" - das soll nicht an der Validierung scheitern.
        foreach (['price_amount', 'price_eur'] as $field) {
            if (is_string($request->input($field))) {
                $request->merge([$field => str_replace(',', '.', trim($request->input($field)))]);
            }
        }

        $data = $request->validate([
            'kind' => ['required', Rule::enum(BookingKind::class)],
            'title' => ['required', 'string', 'max:160'],
            'location' => ['nullable', 'string', 'max:160'],
            'stop_id' => ['nullable', 'integer', 'exists:stops,id'],
            'url' => ['nullable', 'url:http,https', 'max:2048'],
            'check_in' => ['required', 'date_format:Y-m-d'],
            'check_out' => ['required', 'date_format:Y-m-d', 'after:check_in'],
            'status' => ['required', Rule::in([Booking::STATUS_PLANNED, Booking::STATUS_BOOKED])],
            'paid' => ['boolean'],
            'price_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'currency' => ['nullable', 'required_with:price_amount', 'regex:/^[A-Za-z]{3}$/'],
            'price_eur' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'check_out.after' => 'Die Abreise muss mindestens einen Tag nach der Ankunft liegen.',
            'url.url' => 'Das ist kein gültiger Link (http:// oder https://).',
            'currency.required_with' => 'Zum Betrag gehört eine Währung.',
            'currency.regex' => 'Bitte den dreibuchstabigen Code, z. B. PEN oder USD.',
        ]);

        $amount = $data['price_amount'] ?? null;
        $currency = $amount === null ? null : strtoupper($data['currency']);
        // In Euro bezahlt heisst: nichts umzurechnen.
        $eur = $currency === 'EUR' ? $amount : ($data['price_eur'] ?? null);
        unset($data['price_eur']);

        return [
            ...$data,
            'paid' => (bool) ($data['paid'] ?? false),
            'price_amount' => $amount,
            'currency' => $currency,
            'price_eur_cents' => $eur === null ? null : (int) round((float) $eur * 100),
        ];
    }
}
