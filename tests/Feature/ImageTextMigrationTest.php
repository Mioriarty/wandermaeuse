<?php

namespace Tests\Feature;

use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ImageTextMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_old_image_text_block_keeps_its_picture(): void
    {
        $post = Post::create(['title' => 'Alt', 'slug' => 'alt', 'status' => Post::STATUS_DRAFT]);
        $migration = require database_path('migrations/2026_10_26_000200_image_text_blocks_hold_several_images.php');

        // Back to the shape blocks had before, as they still sit in production.
        $id = DB::table('post_blocks')->insertGetId([
            'post_id' => $post->id,
            'type' => 'image_text',
            'position' => 0,
            'data' => json_encode(['media_id' => 7, 'html' => '<p>Text</p>', 'variant' => 'right']),
        ]);
        $empty = DB::table('post_blocks')->insertGetId([
            'post_id' => $post->id,
            'type' => 'image_text',
            'position' => 1,
            'data' => json_encode(['media_id' => null, 'html' => '']),
        ]);

        $migration->up();

        $data = fn (int $id) => json_decode(DB::table('post_blocks')->where('id', $id)->value('data'), true);
        $this->assertSame(['media_ids' => [7], 'html' => '<p>Text</p>', 'variant' => 'right'], $data($id));
        $this->assertSame(['media_ids' => [], 'html' => ''], $data($empty));
    }
}
