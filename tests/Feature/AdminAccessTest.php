<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    public static function adminRoutes(): array
    {
        return [
            ['/admin'],
            ['/admin/startseite'],
            ['/admin/eintraege'],
            ['/admin/eintraege/neu'],
            ['/admin/bilder'],
            ['/admin/stationen'],
            ['/admin/unterkuenfte'],
            ['/admin/kommentare'],
            ['/admin/newsletter'],
        ];
    }

    #[DataProvider('adminRoutes')]
    public function test_a_guest_is_sent_to_the_login(string $route): void
    {
        $this->get($route)->assertRedirect('/admin/login');
    }

    #[DataProvider('adminRoutes')]
    public function test_an_admin_can_open_it(string $route): void
    {
        $this->actingAs(User::factory()->create())->get($route)->assertOk();
    }

    public function test_a_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'moritz@example.org', 'password' => Hash::make('das-richtige-passwort')]);

        $this->post('/admin/login', [
            'email' => 'moritz@example.org',
            'password' => 'falsch',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_a_correct_password_logs_in(): void
    {
        $user = User::factory()->create([
            'email' => 'moritz@example.org',
            'password' => Hash::make('das-richtige-passwort'),
        ]);

        $this->post('/admin/login', [
            'email' => 'moritz@example.org',
            'password' => 'das-richtige-passwort',
        ])->assertRedirect('/admin');

        $this->assertAuthenticatedAs($user);
    }

    public function test_repeated_wrong_passwords_are_throttled(): void
    {
        User::factory()->create(['email' => 'moritz@example.org', 'password' => Hash::make('richtig')]);

        for ($i = 0; $i < 5; $i++) {
            $this->post('/admin/login', ['email' => 'moritz@example.org', 'password' => 'falsch']);
        }

        // Even the right password is refused once the limiter has tripped.
        $this->post('/admin/login', ['email' => 'moritz@example.org', 'password' => 'richtig'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_there_is_no_public_registration(): void
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [])->assertNotFound();
    }
}
