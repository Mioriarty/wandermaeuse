<?php

namespace Tests\Feature;

use App\Mail\NewComments;
use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CommentNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function comment(array $attributes = []): Comment
    {
        $post = Post::firstOrCreate(['slug' => 'oaxaca'], [
            'title' => 'Markt in Oaxaca',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subDay(),
        ]);

        return Comment::create([
            'post_id' => $post->id,
            'author_name' => 'Oma',
            'body' => 'Schöne Bilder!',
            ...$attributes,
        ]);
    }

    public function test_new_comments_go_to_every_admin_in_one_mail(): void
    {
        Mail::fake();
        User::factory()->create(['email' => 'anna@example.org']);
        User::factory()->create(['email' => 'ben@example.org']);
        $this->comment();
        $this->comment(['author_name' => 'Jonas']);

        $this->artisan('wandermaeuse:notify-comments')->assertSuccessful();

        Mail::assertSent(NewComments::class, 1);
        Mail::assertSent(NewComments::class, fn (NewComments $mail) => $mail->hasTo('anna@example.org')
            && $mail->hasTo('ben@example.org')
            && $mail->comments->count() === 2);
        $this->assertSame(0, Comment::whereNull('notified_at')->count());
    }

    public function test_a_comment_is_only_reported_once(): void
    {
        Mail::fake();
        User::factory()->create();
        $this->comment();

        $this->artisan('wandermaeuse:notify-comments');
        $this->artisan('wandermaeuse:notify-comments');

        Mail::assertSent(NewComments::class, 1);
    }

    public function test_nothing_is_sent_without_new_comments(): void
    {
        Mail::fake();
        User::factory()->create();
        $this->comment(['notified_at' => now()]);

        $this->artisan('wandermaeuse:notify-comments')->assertSuccessful();

        Mail::assertNothingSent();
    }

    public function test_comments_stay_pending_while_there_is_no_admin(): void
    {
        Mail::fake();
        $this->comment();

        $this->artisan('wandermaeuse:notify-comments')->assertSuccessful();

        Mail::assertNothingSent();
        $this->assertSame(1, Comment::whereNull('notified_at')->count());
    }

    public function test_the_mail_names_author_time_entry_and_links_to_all_comments(): void
    {
        $this->travelTo('2026-11-07 18:30:00');
        $first = $this->comment(['author_email' => 'oma@example.org']);
        $this->comment([
            'author_name' => 'Jonas',
            'body' => "Erste Zeile\n[Klick](https://evil.example) <b>fett</b>",
            'parent_id' => $first->id,
            'reply_to_id' => $first->id,
        ]);

        $html = (new NewComments(Comment::with(['post', 'replyTo', 'images'])->get()))->render();

        $this->assertStringContainsString('Oma', $html);
        $this->assertStringContainsString('oma@example.org', $html);
        $this->assertStringContainsString('antwortet Oma', $html);
        $this->assertStringContainsString('Markt in Oaxaca', $html);
        $this->assertStringContainsString(url('/blog/oaxaca'), $html);
        // 18:30 UTC is 12:30 in Mexico City.
        $this->assertStringContainsString('7. November 2026, 12:30 Uhr', $html);
        $this->assertStringContainsString(route('admin.comments.index'), $html);
        // What a reader writes stays text: no link, no markup.
        $this->assertStringContainsString('Erste Zeile<br>[Klick](https://evil.example) &lt;b&gt;fett&lt;/b&gt;', $html);
        $this->assertStringNotContainsString('href="https://evil.example"', $html);
    }
}
