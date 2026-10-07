<?php

namespace Tests\Feature;

use App\Jobs\SendCampaignChunk;
use App\Mail\CampaignMail;
use App\Mail\ConfirmSubscription;
use App\Models\Campaign;
use App\Models\CampaignSend;
use App\Models\Post;
use App\Models\Subscriber;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NewsletterTest extends TestCase
{
    use RefreshDatabase;

    public function test_subscribing_sends_a_confirmation_and_does_not_confirm_yet(): void
    {
        Mail::fake();

        $this->post('/newsletter', ['email' => 'neu@example.org'])->assertRedirect();

        $subscriber = Subscriber::firstWhere('email', 'neu@example.org');

        $this->assertNotNull($subscriber);
        $this->assertNull($subscriber->confirmed_at, 'Double opt-in: not confirmed before the link is clicked.');
        $this->assertNotEmpty($subscriber->token);

        Mail::assertSent(ConfirmSubscription::class);
    }

    public function test_a_failing_mailer_reports_an_error_instead_of_a_500(): void
    {
        Mail::shouldReceive('to->send')->andThrow(
            new \Symfony\Component\Mailer\Exception\TransportException('535 Incorrect authentication data'),
        );

        $this->post('/newsletter', ['email' => 'neu@example.org'])
            ->assertRedirect()
            ->assertSessionHasErrors('email');

        $this->assertNull(
            Subscriber::firstWhere('email', 'neu@example.org'),
            'A row created just before a failing send is rolled back.',
        );
    }

    public function test_a_failing_mailer_keeps_an_address_that_already_existed(): void
    {
        $existing = Subscriber::create(['email' => 'schon@example.org']);

        Mail::shouldReceive('to->send')->andThrow(
            new \Symfony\Component\Mailer\Exception\TransportException('535 Incorrect authentication data'),
        );

        $this->post('/newsletter', ['email' => 'schon@example.org'])
            ->assertRedirect()
            ->assertSessionHasErrors('email');

        $this->assertNotNull($existing->fresh());
    }

    public function test_the_confirmation_link_confirms(): void
    {
        Mail::fake();
        $subscriber = Subscriber::create(['email' => 'neu@example.org']);

        $this->get('/newsletter/bestaetigen/'.$subscriber->token)->assertOk();

        $this->assertNotNull($subscriber->fresh()->confirmed_at);
    }

    public function test_the_unsubscribe_link_unsubscribes(): void
    {
        $subscriber = Subscriber::create(['email' => 'weg@example.org', 'confirmed_at' => now()]);

        $this->get('/newsletter/abmelden/'.$subscriber->token)->assertOk();

        $this->assertNotNull($subscriber->fresh()->unsubscribed_at);
        $this->assertFalse($subscriber->fresh()->isConfirmed());
    }

    public function test_an_unknown_token_does_not_error(): void
    {
        $this->get('/newsletter/bestaetigen/unsinn')->assertOk();
        $this->get('/newsletter/abmelden/unsinn')->assertOk();
    }

    public function test_an_unconfirmed_subscriber_is_never_mailed_a_campaign(): void
    {
        Mail::fake();

        $confirmed = Subscriber::create(['email' => 'ja@example.org', 'confirmed_at' => now()]);
        Subscriber::create(['email' => 'nein@example.org']);
        Subscriber::create(['email' => 'weg@example.org', 'confirmed_at' => now(), 'unsubscribed_at' => now()]);

        $campaign = Campaign::create(['subject' => 'Neu aus Peru', 'status' => 'draft']);

        $this->actingAs(User::factory()->create())
            ->post('/admin/newsletter/'.$campaign->id.'/senden')
            ->assertRedirect();

        // Only the confirmed address is on the frozen recipient list.
        $this->assertSame(1, CampaignSend::count());
        $this->assertSame($confirmed->id, CampaignSend::first()->subscriber_id);

        // QUEUE_CONNECTION is sync in tests, so the chunk has already run.
        Mail::assertSent(CampaignMail::class, 1);
        $this->assertSame('sent', $campaign->fresh()->status);
    }

    public function test_a_campaign_cannot_be_sent_twice(): void
    {
        Mail::fake();
        Subscriber::create(['email' => 'ja@example.org', 'confirmed_at' => now()]);
        $campaign = Campaign::create(['subject' => 'Einmal', 'status' => 'sent', 'sent_at' => now()]);

        $this->actingAs(User::factory()->create())
            ->post('/admin/newsletter/'.$campaign->id.'/senden')
            ->assertSessionHas('error');

        $this->assertSame(0, CampaignSend::count());
        Mail::assertNothingSent();
    }

    public function test_someone_who_unsubscribes_after_queueing_is_skipped(): void
    {
        Mail::fake();

        $subscriber = Subscriber::create(['email' => 'spaet@example.org', 'confirmed_at' => now()]);
        $campaign = Campaign::create(['subject' => 'Später', 'status' => 'sending', 'recipient_count' => 1]);
        CampaignSend::create(['campaign_id' => $campaign->id, 'subscriber_id' => $subscriber->id]);

        $subscriber->forceFill(['unsubscribed_at' => now()])->save();

        (new SendCampaignChunk($campaign->id))->handle();

        Mail::assertNothingSent();
        $this->assertSame('abgemeldet', CampaignSend::first()->error);
    }

    public function test_an_excerpt_quoted_in_the_intro_is_not_repeated_below_it(): void
    {
        $post = Post::create([
            'title' => 'Uyuni',
            'slug' => 'uyuni',
            'excerpt' => 'Salz, soweit man sehen kann.',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
        ]);
        $subscriber = Subscriber::create(['email' => 'ja@example.org', 'confirmed_at' => now()]);

        $quoted = Campaign::create([
            'subject' => 'Neues aus Uyuni',
            'intro' => "Hallo!\n\nSalz, soweit man sehen kann.",
            'post_id' => $post->id,
            'status' => 'draft',
        ]);
        $plain = Campaign::create(['subject' => 'Neu', 'intro' => 'Hallo!', 'post_id' => $post->id, 'status' => 'draft']);

        $this->assertSame(1, substr_count((new CampaignMail($quoted, $subscriber))->render(), 'Salz, soweit man sehen kann.'));
        $this->assertSame(1, substr_count((new CampaignMail($plain, $subscriber))->render(), 'Salz, soweit man sehen kann.'));
    }
}
