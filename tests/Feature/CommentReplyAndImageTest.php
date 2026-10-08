<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\CommentImage;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class CommentReplyAndImageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        RateLimiter::clear('comments:'.hash('sha256', '127.0.0.1'.config('app.key')));
    }

    private function publishedPost(string $slug = 'eintrag'): Post
    {
        return Post::create([
            'title' => 'Eintrag',
            'slug' => $slug,
            'status' => Post::STATUS_PUBLISHED,
            'published_at' => now()->subHour(),
        ]);
    }

    private function comment(Post $post, string $author, ?Comment $replyTo = null): Comment
    {
        return Comment::create([
            'post_id' => $post->id,
            'parent_id' => $replyTo ? ($replyTo->parent_id ?? $replyTo->id) : null,
            'reply_to_id' => $replyTo?->id,
            'author_name' => $author,
            'body' => 'Text von '.$author,
        ]);
    }

    /**
     * A real PNG with a PHP script glued to its end - the classic polyglot.
     */
    private function pngWithPayload(string $payload): string
    {
        $gd = imagecreatetruecolor(40, 30);
        ob_start();
        imagepng($gd);

        return ob_get_clean().$payload;
    }

    public function test_a_reply_is_nested_under_the_comment_it_answers(): void
    {
        $post = $this->publishedPost();
        $root = $this->comment($post, 'Oma');

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Jonas',
            'body' => 'Finde ich auch!',
            'reply_to' => $root->id,
        ])->assertSessionHasNoErrors();

        $reply = Comment::latest('id')->first();
        $this->assertSame($root->id, $reply->parent_id);
        $this->assertSame($root->id, $reply->reply_to_id);

        $this->get('/blog/eintrag')->assertInertia(
            fn (AssertableInertia $page) => $page
                ->has('comments', 1)
                ->has('comments.0.replies', 1)
                ->where('comments.0.replies.0.body', 'Finde ich auch!')
                // Answering the first comment needs no name: the indentation says it.
                ->where('comments.0.replies.0.replyToName', null),
        );
    }

    public function test_answering_a_reply_stays_in_the_same_thread_and_names_who_is_answered(): void
    {
        $post = $this->publishedPost();
        $root = $this->comment($post, 'Oma');
        $reply = $this->comment($post, 'Jonas', $root);

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Lena',
            'body' => 'Genau, Jonas.',
            'reply_to' => $reply->id,
        ])->assertSessionHasNoErrors();

        $answer = Comment::latest('id')->first();
        $this->assertSame($root->id, $answer->parent_id);
        $this->assertSame($reply->id, $answer->reply_to_id);

        $this->get('/blog/eintrag')->assertInertia(
            fn (AssertableInertia $page) => $page
                ->has('comments', 1)
                ->has('comments.0.replies', 2)
                ->where('comments.0.replies.1.replyToName', 'Jonas'),
        );
    }

    public function test_a_comment_under_another_entry_cannot_be_answered(): void
    {
        $this->publishedPost();
        $elsewhere = $this->comment($this->publishedPost('anderer'), 'Fremd');

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Jonas',
            'body' => 'Hallo',
            'reply_to' => $elsewhere->id,
        ])->assertSessionHasErrors('reply_to');

        $this->assertDatabaseCount('comments', 1);
    }

    public function test_images_are_reencoded_as_webp_and_shown_with_the_comment(): void
    {
        $this->publishedPost();

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Oma',
            'body' => 'Mein Garten',
            'images' => [
                UploadedFile::fake()->image('garten.jpg', 3000, 2000),
                UploadedFile::fake()->image('blume.png', 300, 400),
            ],
        ])->assertSessionHasNoErrors();

        $images = CommentImage::orderBy('position')->get();
        $this->assertCount(2, $images);

        // Scaled down to the long edge, never up.
        $this->assertSame([1600, 1067], [$images[0]->width, $images[0]->height]);
        $this->assertSame([300, 400], [$images[1]->width, $images[1]->height]);

        foreach ($images as $image) {
            foreach ([$image->path, $image->thumb_path] as $path) {
                $this->assertStringEndsWith('.webp', $path);
                // The client's file name is gone.
                $this->assertStringNotContainsString('garten', $path);
                $bytes = Storage::disk('public')->get($path);
                $this->assertSame('WEBP', substr($bytes, 8, 4));
            }
        }

        $this->get('/blog/eintrag')->assertInertia(
            fn (AssertableInertia $page) => $page
                ->has('comments.0.images', 2)
                ->where('comments.0.images.0.width', 1600),
        );
    }

    public function test_anything_hidden_in_the_upload_does_not_survive(): void
    {
        $this->publishedPost();

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Angreifer',
            'body' => 'Schönes Bild',
            'images' => [
                UploadedFile::fake()->createWithContent('bild.png', $this->pngWithPayload('<?php system($_GET["c"]); ?>')),
            ],
        ])->assertSessionHasNoErrors();

        $image = CommentImage::sole();
        $this->assertStringNotContainsString('<?php', Storage::disk('public')->get($image->path));
        $this->assertStringNotContainsString('<?php', Storage::disk('public')->get($image->thumb_path));
    }

    public function test_exif_metadata_such_as_the_location_is_stripped(): void
    {
        $this->publishedPost();

        $gd = imagecreatetruecolor(60, 40);
        ob_start();
        imagejpeg($gd);
        $jpeg = ob_get_clean();

        // An APP1/Exif segment right after the SOI marker, as a phone writes it.
        $exif = "Exif\0\0".'GPS-48.137154-11.576124';
        $jpeg = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Oma',
            'body' => 'Vom Balkon',
            'images' => [UploadedFile::fake()->createWithContent('balkon.jpg', $jpeg)],
        ])->assertSessionHasNoErrors();

        $stored = Storage::disk('public')->get(CommentImage::sole()->path);
        $this->assertStringNotContainsString('48.137154', $stored);
        $this->assertStringNotContainsString('Exif', $stored);
    }

    public function test_files_that_are_not_photos_are_rejected(): void
    {
        $this->publishedPost();

        $cases = [
            'script with an image name' => UploadedFile::fake()->createWithContent('bild.jpg', '<?php echo 1;'),
            'svg' => UploadedFile::fake()->createWithContent('bild.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
            'html' => UploadedFile::fake()->createWithContent('bild.png', '<html><script>alert(1)</script></html>'),
        ];

        foreach ($cases as $file) {
            $this->post('/blog/eintrag/kommentare', [
                'author_name' => 'Angreifer',
                'body' => 'Hallo',
                'images' => [$file],
            ])->assertSessionHasErrors('images.0');
        }

        $this->assertDatabaseCount('comments', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_an_image_claiming_an_enormous_size_is_rejected_before_decoding(): void
    {
        $this->publishedPost();

        // A tiny PNG whose header claims 20000 x 20000 pixels: decoded, that
        // would ask for 1.6 GB of memory.
        $png = $this->pngWithPayload('');
        $png = substr_replace($png, pack('NN', 20000, 20000), 16, 8);

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Angreifer',
            'body' => 'Hallo',
            'images' => [UploadedFile::fake()->createWithContent('bombe.png', $png)],
        ])->assertSessionHasErrors('images.0');

        $this->assertDatabaseCount('comments', 0);
    }

    public function test_at_most_three_images_and_ten_megabytes_each(): void
    {
        $this->publishedPost();

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Oma',
            'body' => 'Viele Bilder',
            'images' => array_map(fn ($i) => UploadedFile::fake()->image("b$i.jpg", 50, 50), range(1, 4)),
        ])->assertSessionHasErrors('images');

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Oma',
            'body' => 'Großes Bild',
            'images' => [UploadedFile::fake()->image('gross.jpg', 50, 50)->size(11000)],
        ])->assertSessionHasErrors('images.0');

        $this->assertDatabaseCount('comments', 0);
    }

    public function test_deleting_a_comment_removes_its_thread_and_every_photo(): void
    {
        $this->actingAs(User::factory()->create());
        $post = $this->publishedPost();

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Oma',
            'body' => 'Erster',
            'images' => [UploadedFile::fake()->image('a.jpg', 100, 100)],
        ]);
        $root = Comment::sole();

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Jonas',
            'body' => 'Antwort',
            'reply_to' => $root->id,
            'images' => [UploadedFile::fake()->image('b.jpg', 100, 100)],
        ]);

        $this->assertCount(4, Storage::disk('public')->allFiles());

        $this->delete('/admin/kommentare/'.$root->id)->assertRedirect();

        $this->assertDatabaseCount('comments', 0);
        $this->assertDatabaseCount('comment_images', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame(0, $post->comments()->count());
    }

    public function test_deleting_a_post_removes_the_photos_of_its_comments(): void
    {
        $post = $this->publishedPost();

        $this->post('/blog/eintrag/kommentare', [
            'author_name' => 'Oma',
            'body' => 'Hallo',
            'images' => [UploadedFile::fake()->image('a.jpg', 100, 100)],
        ])->assertSessionHasNoErrors();

        $this->assertNotEmpty(Storage::disk('public')->allFiles());

        $post->delete();

        $this->assertDatabaseCount('comment_images', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }
}
