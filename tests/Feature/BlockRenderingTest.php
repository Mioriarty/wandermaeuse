<?php

namespace Tests\Feature;

use App\Enums\BlockType;
use App\Models\Media;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BlockRenderingTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Every pattern must survive the round trip from the database into the
     * props the React renderer receives - including its images, in order.
     */
    public function test_all_block_types_round_trip_with_their_media(): void
    {
        $media = collect(range(1, 3))->map(fn (int $i) => Media::create([
            'path' => "demo/{$i}.jpg",
            'mime' => 'image/jpeg',
            'width' => 1200,
            'height' => 800,
            'aspect_ratio' => 1.5,
            'dominant_color' => '#abcdef',
            'variants' => ['webp' => [480 => "demo/{$i}-480.webp"], 'jpeg' => [480 => "demo/{$i}-480.jpg"]],
        ]));

        $post = Post::create([
            'title' => 'Alle Muster',
            'slug' => 'alle-muster',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
        ]);

        $data = [
            BlockType::Text->value => ['html' => '<p>Hallo</p>'],
            BlockType::Heading->value => ['text' => 'Titel', 'label' => 'Eins'],
            BlockType::ImageFull->value => ['media_id' => $media[0]->id, 'caption' => 'A'],
            BlockType::ImageText->value => ['media_ids' => [$media[1]->id, $media[2]->id], 'html' => '<p>Text</p>', 'variant' => 'right'],
            BlockType::ImagePair->value => ['left_media_id' => $media[0]->id, 'right_media_id' => $media[1]->id],
            BlockType::Gallery->value => ['media_ids' => [$media[2]->id, $media[0]->id]],
            BlockType::Quote->value => ['text' => 'Zitat', 'attribution' => 'Wer'],
            BlockType::Divider->value => ['glyph' => '*'],
        ];

        foreach (array_values($data) as $position => $payload) {
            $post->blocks()->create([
                'type' => array_keys($data)[$position],
                'position' => $position,
                'data' => $payload,
            ]);
        }

        $rendered = collect($post->fresh()->blocksWithMedia())->keyBy('type');

        $this->assertCount(count(BlockType::cases()), $rendered);

        $this->assertSame([], $rendered[BlockType::Text->value]['images']);
        $this->assertCount(1, $rendered[BlockType::ImageFull->value]['images']);
        $this->assertCount(2, $rendered[BlockType::ImagePair->value]['images']);
        $this->assertSame(
            [$media[1]->id, $media[2]->id],
            array_column($rendered[BlockType::ImageText->value]['images'], 'id'),
        );

        // Gallery order is the order the editor stored, not the media id order.
        $gallery = $rendered[BlockType::Gallery->value]['images'];
        $this->assertSame([$media[2]->id, $media[0]->id], array_column($gallery, 'id'));

        $this->assertSame('#abcdef', $gallery[0]['dominantColor']);
    }

    public function test_blocks_keep_their_order(): void
    {
        $post = Post::create([
            'title' => 'Reihenfolge',
            'slug' => 'reihenfolge',
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
        ]);

        foreach (['C', 'A', 'B'] as $i => $text) {
            $post->blocks()->create([
                'type' => BlockType::Heading,
                'position' => $i,
                'data' => ['text' => $text],
            ]);
        }

        $texts = array_column(array_column($post->blocksWithMedia(), 'data'), 'text');

        $this->assertSame(['C', 'A', 'B'], $texts);
    }
}
