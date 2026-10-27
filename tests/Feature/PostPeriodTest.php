<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PostPeriodTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'Salz',
            // The form always sends every field, empty or not.
            'slug' => '',
            'period_starts_on' => '',
            'period_ends_on' => '',
            'status' => Post::STATUS_DRAFT,
            'blocks' => [],
            ...$overrides,
        ];
    }

    public function test_a_post_can_be_saved_without_a_period(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/eintraege', $this->payload())
            ->assertSessionHasNoErrors();

        $post = Post::sole();
        $this->assertNull($post->period_starts_on);
        $this->assertNull($post->periodProps());
    }

    public function test_a_period_is_stored(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/eintraege', $this->payload([
                'period_starts_on' => '2026-03-16',
                'period_ends_on' => '2026-03-18',
            ]))
            ->assertSessionHasNoErrors();

        $this->assertSame(['from' => '2026-03-16', 'until' => '2026-03-18'], Post::sole()->periodProps());
    }

    public function test_a_start_without_an_end_is_a_single_day(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/eintraege', $this->payload(['period_starts_on' => '2026-03-16']))
            ->assertSessionHasNoErrors();

        $this->assertSame(['from' => '2026-03-16', 'until' => '2026-03-16'], Post::sole()->periodProps());
    }

    public function test_an_end_needs_a_start(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/eintraege', $this->payload(['period_ends_on' => '2026-03-18']))
            ->assertSessionHasErrors('period_starts_on');
    }

    public function test_the_end_cannot_lie_before_the_start(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/eintraege', $this->payload([
                'period_starts_on' => '2026-03-18',
                'period_ends_on' => '2026-03-16',
            ]))
            ->assertSessionHasErrors('period_ends_on');
    }

    public function test_the_entry_page_shows_the_period(): void
    {
        $post = Post::create([
            'title' => 'Salz',
            'slug' => 'salz',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
            'period_starts_on' => '2026-03-16',
            'period_ends_on' => '2026-03-18',
        ]);

        $this->get('/blog/'.$post->slug)->assertInertia(
            fn (AssertableInertia $page) => $page
                ->where('post.period', ['from' => '2026-03-16', 'until' => '2026-03-18']),
        );
    }

    public function test_the_listing_carries_the_period_or_none(): void
    {
        Post::create([
            'title' => 'Mit Zeitraum',
            'slug' => 'mit-zeitraum',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
            'period_starts_on' => '2026-03-16',
        ]);
        Post::create([
            'title' => 'Ohne Zeitraum',
            'slug' => 'ohne-zeitraum',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subDay(),
        ]);

        $this->get('/blog')->assertInertia(
            fn (AssertableInertia $page) => $page
                ->where('groups.0.posts.0.period', ['from' => '2026-03-16', 'until' => '2026-03-16'])
                ->where('groups.0.posts.1.period', null),
        );
    }

    public function test_the_admin_list_is_sorted_by_period_then_publication_date(): void
    {
        $make = fn (string $slug, array $attributes) => Post::create([
            'title' => $slug,
            'slug' => $slug,
            'status' => Post::STATUS_DRAFT,
            ...$attributes,
        ]);

        $make('maerz-erlebt', ['period_starts_on' => '2026-03-16', 'published_at' => '2026-01-01 10:00']);
        $make('februar-online', ['published_at' => '2026-02-20 10:00']);
        $make('januar-erlebt', ['period_starts_on' => '2026-01-10', 'published_at' => '2026-04-01 10:00']);
        $make('undatiert', []);

        $this->actingAs(User::factory()->create())
            ->get('/admin/eintraege')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('posts.0.slug', 'undatiert')
                ->where('posts.1.slug', 'maerz-erlebt')
                ->where('posts.2.slug', 'februar-online')
                ->where('posts.3.slug', 'januar-erlebt'));
    }
}
