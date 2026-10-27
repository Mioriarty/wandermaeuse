<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Stop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PostPublishingTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_published_post_is_visible(): void
    {
        $post = Post::create([
            'title' => 'Sichtbar',
            'slug' => 'sichtbar',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
        ]);

        $this->get('/blog/'.$post->slug)->assertOk();

        $this->get('/blog')->assertInertia(
            fn (AssertableInertia $page) => $page
                ->where('total', 1)
                ->where('groups.0.posts.0.title', 'Sichtbar'),
        );
    }

    public function test_a_draft_is_not_reachable(): void
    {
        $post = Post::create([
            'title' => 'Entwurf',
            'slug' => 'entwurf',
            'status' => Post::STATUS_DRAFT,
            'published_at' => now()->subHour(),
        ]);

        $this->get('/blog/'.$post->slug)->assertNotFound();
    }

    public function test_a_post_dated_in_the_future_is_not_reachable_yet(): void
    {
        $post = Post::create([
            'title' => 'Später',
            'slug' => 'spaeter',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->addDay(),
        ]);

        $this->get('/blog/'.$post->slug)->assertNotFound();
    }

    public function test_a_published_post_without_a_date_is_not_reachable(): void
    {
        $post = Post::create([
            'title' => 'Ohne Datum',
            'slug' => 'ohne-datum',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => null,
        ]);

        $this->get('/blog/'.$post->slug)->assertNotFound();
    }

    /**
     * @return array<string, array{string, string|null}>
     */
    public static function unpublishedStates(): array
    {
        return [
            'Entwurf ohne Datum' => [Post::STATUS_DRAFT, null],
            'Entwurf mit Datum' => [Post::STATUS_DRAFT, '-1 hour'],
            'geplant' => [Post::STATUS_SCHEDULED, '+1 day'],
            'veroeffentlicht, aber noch nicht faellig' => [Post::STATUS_PUBLISHED, '+1 day'],
        ];
    }

    #[DataProvider('unpublishedStates')]
    public function test_an_admin_can_preview_an_unpublished_post(string $status, ?string $when): void
    {
        $post = Post::create([
            'title' => 'Noch nicht so weit',
            'slug' => 'noch-nicht',
            'status' => $status,
            'published_at' => $when === null ? null : new \DateTimeImmutable($when),
        ]);

        $this->actingAs(User::factory()->create())
            ->get('/blog/'.$post->slug)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('isPreview', true));
    }

    #[DataProvider('unpublishedStates')]
    public function test_a_guest_still_gets_nothing(string $status, ?string $when): void
    {
        $post = Post::create([
            'title' => 'Noch nicht so weit',
            'slug' => 'noch-nicht',
            'status' => $status,
            'published_at' => $when === null ? null : new \DateTimeImmutable($when),
        ]);

        $this->get('/blog/'.$post->slug)->assertNotFound();
    }

    public function test_a_preview_is_marked_noindex(): void
    {
        $post = Post::create([
            'title' => 'Entwurf',
            'slug' => 'entwurf-noindex',
            'status' => Post::STATUS_DRAFT,
            'published_at' => null,
        ]);

        $this->actingAs(User::factory()->create())
            ->get('/blog/'.$post->slug)
            ->assertOk()
            ->assertSee('name="robots" content="noindex, nofollow"', false);
    }

    public function test_a_published_post_is_not_a_preview_and_stays_indexable(): void
    {
        $post = Post::create([
            'title' => 'Live',
            'slug' => 'live',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
        ]);

        $this->actingAs(User::factory()->create())
            ->get('/blog/'.$post->slug)
            ->assertOk()
            ->assertDontSee('noindex', false)
            ->assertInertia(fn (AssertableInertia $page) => $page->where('isPreview', false));
    }

    /**
     * Angemeldet zeigen die Listen der Seite auch, was noch nicht draussen
     * ist - markiert, damit es niemand fuer live haelt. Feed und Sitemap
     * gehen an Fremde und bleiben bei den veroeffentlichten.
     */
    public function test_a_logged_in_reader_sees_drafts_flagged_in_the_lists(): void
    {
        $stop = Stop::create([
            'name' => 'Lima', 'slug' => 'lima', 'country' => 'Peru', 'lat' => -12.0464, 'lng' => -77.0428,
        ]);
        Post::create([
            'title' => 'Live',
            'slug' => 'live-liste',
            'stop_id' => $stop->id,
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subDay(),
        ]);
        Post::create([
            'title' => 'Entwurf',
            'slug' => 'entwurf-liste',
            'stop_id' => $stop->id,
            'status' => Post::STATUS_DRAFT,
            'published_at' => null,
        ]);

        $admin = User::factory()->create();

        // Ohne Datum ist ein Entwurf juenger als alles Veroeffentlichte.
        $this->actingAs($admin)->get('/')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('posts.0.slug', 'entwurf-liste')
            ->where('posts.0.previewLabel', 'Entwurf')
            ->where('posts.1.previewLabel', null));
        $this->actingAs($admin)->get('/blog')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('total', 2)
            ->where('groups.0.posts.0.previewLabel', 'Entwurf'));
        $this->actingAs($admin)->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('stops.0.posts.0.slug', 'entwurf-liste')
            ->where('stops.0.posts.0.previewLabel', 'Entwurf'));

        $this->actingAs($admin)->get('/feed.xml')->assertDontSee('entwurf-liste');
        $this->actingAs($admin)->get('/sitemap.xml')->assertDontSee('entwurf-liste');
    }

    public function test_a_guest_sees_no_drafts_in_the_lists(): void
    {
        $stop = Stop::create([
            'name' => 'Lima', 'slug' => 'lima', 'country' => 'Peru', 'lat' => -12.0464, 'lng' => -77.0428,
        ]);
        Post::create([
            'title' => 'Geplant',
            'slug' => 'geplant-liste',
            'stop_id' => $stop->id,
            'status' => Post::STATUS_SCHEDULED,
            'published_at' => now()->addDay(),
        ]);

        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('posts', []));
        $this->get('/blog')->assertInertia(fn (AssertableInertia $page) => $page->where('total', 0));
        $this->get('/reise')->assertInertia(fn (AssertableInertia $page) => $page->where('stops.0.posts', []));
    }

    public function test_a_scheduled_post_is_flagged_as_planned(): void
    {
        Post::create([
            'title' => 'Geplant',
            'slug' => 'geplant-flagge',
            'status' => Post::STATUS_SCHEDULED,
            'published_at' => now()->addDay(),
        ]);

        $this->actingAs(User::factory()->create())->get('/blog')->assertInertia(
            fn (AssertableInertia $page) => $page->where('groups.0.posts.0.previewLabel', 'Geplant'),
        );
    }

    public function test_a_draft_without_a_date_has_no_neighbours(): void
    {
        Post::create([
            'title' => 'Vorher',
            'slug' => 'vorher',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subWeek(),
        ]);

        $draft = Post::create([
            'title' => 'Entwurf',
            'slug' => 'entwurf-nachbarn',
            'status' => Post::STATUS_DRAFT,
            'published_at' => null,
        ]);

        $this->actingAs(User::factory()->create())
            ->get('/blog/'.$draft->slug)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('neighbours.previous', null)
                ->where('neighbours.next', null));
    }
}
