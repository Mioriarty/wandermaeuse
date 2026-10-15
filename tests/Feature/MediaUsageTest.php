<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\Post;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class MediaUsageTest extends TestCase
{
    use RefreshDatabase;

    private function media(string $name): Media
    {
        return Media::create([
            'path' => "media/{$name}.jpg",
            'original_name' => "{$name}.jpg",
            'mime' => 'image/jpeg',
            'size' => 1024,
            'width' => 2400,
            'height' => 1600,
            'aspect_ratio' => 1.5,
            'dominant_color' => '#7b8870',
            'alt' => $name,
            'variants' => ['webp' => [], 'jpeg' => []],
        ]);
    }

    /** @return array<int, list<array{label: string, url: string}>> */
    private function usageOnMediaPage(): array
    {
        $usage = [];

        $this->actingAs(User::factory()->create())
            ->get('/admin/bilder')
            ->assertInertia(function (AssertableInertia $page) use (&$usage) {
                foreach ($page->toArray()['props']['media']['data'] as $row) {
                    $usage[$row['id']] = $row['usedIn'];
                }
            });

        return $usage;
    }

    public function test_the_media_page_says_where_each_picture_is_used(): void
    {
        $cover = $this->media('aufmacher');
        $inGallery = $this->media('galerie');
        $hero = $this->media('startseite');
        $unused = $this->media('unbenutzt');

        $post = Post::create(['title' => 'Salar de Uyuni', 'slug' => 'salar', 'cover_media_id' => $cover->id]);
        $post->blocks()->create(['type' => 'gallery', 'position' => 0, 'data' => ['media_ids' => [$inGallery->id, $cover->id]]]);
        $post->blocks()->create(['type' => 'text', 'position' => 1, 'data' => ['html' => '<p>Weiss.</p>']]);
        Setting::set(Setting::HOME_MEDIA, (string) $hero->id);

        $usage = $this->usageOnMediaPage();

        // Aufmacher und Galerie im selben Eintrag: einmal genannt.
        $this->assertSame([['label' => 'Salar de Uyuni', 'url' => "/admin/eintraege/{$post->id}"]], $usage[$cover->id]);
        $this->assertSame('Salar de Uyuni', $usage[$inGallery->id][0]['label']);
        $this->assertSame([['label' => 'Startseite', 'url' => '/admin/startseite']], $usage[$hero->id]);
        $this->assertSame([], $usage[$unused->id]);
    }

    public function test_a_picture_in_several_entries_lists_each_of_them(): void
    {
        $image = $this->media('anden');

        foreach (['Cusco', 'Arequipa'] as $title) {
            Post::create(['title' => $title, 'slug' => strtolower($title)])
                ->blocks()->create(['type' => 'image_pair', 'position' => 0, 'data' => ['left_media_id' => null, 'right_media_id' => $image->id]]);
        }

        $labels = array_column($this->usageOnMediaPage()[$image->id], 'label');

        $this->assertSame(['Arequipa', 'Cusco'], $labels);
    }
}
