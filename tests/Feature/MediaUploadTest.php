<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use App\Services\MediaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_an_upload_produces_every_width_in_both_formats(): void
    {
        $file = UploadedFile::fake()->image('strand.jpg', 1800, 1200);

        $media = app(MediaService::class)->store($file);

        $this->assertSame(1800, $media->width);
        $this->assertSame(1200, $media->height);
        $this->assertSame(1.5, $media->aspect_ratio);

        // 2400 is wider than the original, so it is skipped rather than upscaled.
        $this->assertSame([480, 960, 1600], array_keys($media->variants['webp']));
        $this->assertSame([480, 960, 1600], array_keys($media->variants['jpeg']));

        Storage::disk('public')->assertExists($media->path);
        foreach ($media->variants as $paths) {
            foreach ($paths as $path) {
                Storage::disk('public')->assertExists($path);
            }
        }
    }

    public function test_a_small_image_still_gets_one_variant(): void
    {
        $file = UploadedFile::fake()->image('klein.jpg', 300, 300);

        $media = app(MediaService::class)->store($file);

        $this->assertNotEmpty($media->variants['webp']);
        $this->assertNotEmpty($media->variants['jpeg']);
        Storage::disk('public')->assertExists(array_values($media->variants['webp'])[0]);
    }

    public function test_the_srcset_lists_every_generated_width(): void
    {
        $media = app(MediaService::class)->store(UploadedFile::fake()->image('a.jpg', 1000, 500));

        $srcset = $media->srcset();

        $this->assertStringContainsString('480w', $srcset);
        $this->assertStringContainsString('960w', $srcset);
        $this->assertStringNotContainsString('1600w', $srcset);
    }

    public function test_a_dominant_colour_is_stored_for_the_placeholder(): void
    {
        $media = app(MediaService::class)->store(UploadedFile::fake()->image('a.jpg', 600, 400));

        $this->assertMatchesRegularExpression('/^#[0-9a-f]{6}$/i', $media->dominant_color);
    }

    /**
     * Die Farbe muss aus dem Bild kommen. Das Format allein reicht als Probe
     * nicht: die Ausweichfarbe sieht genauso aus, und genau daran ist ein
     * kaputter Analyzer einmal unbemerkt vorbeigekommen.
     */
    public function test_the_dominant_colour_comes_from_the_image(): void
    {
        $media = app(MediaService::class)->store($this->solidImage(0xC0, 0x39, 0x2B));

        $this->assertNotSame('#e6e4de', strtolower($media->dominant_color));

        [$red, $green, $blue] = sscanf($media->dominant_color, '#%02x%02x%02x');

        // JPEG verschiebt die Farbe ein wenig, die Rangfolge bleibt aber.
        $this->assertGreaterThan($green, $red);
        $this->assertGreaterThan($blue, $red);
        $this->assertGreaterThan(0x90, $red);
    }

    /**
     * Ein einfarbiges JPEG mit bekannter Farbe.
     */
    private function solidImage(int $red, int $green, int $blue): UploadedFile
    {
        $gd = imagecreatetruecolor(600, 400);
        imagefill($gd, 0, 0, imagecolorallocate($gd, $red, $green, $blue));

        $path = tempnam(sys_get_temp_dir(), 'seed').'.jpg';
        imagejpeg($gd, $path, 100);
        imagedestroy($gd);

        return new UploadedFile($path, 'einfarbig.jpg', 'image/jpeg', null, true);
    }

    public function test_deleting_removes_the_record_and_every_file(): void
    {
        $service = app(MediaService::class);
        $media = $service->store(UploadedFile::fake()->image('weg.jpg', 1000, 800));

        $paths = [$media->path];
        foreach ($media->variants as $group) {
            $paths = [...$paths, ...array_values($group)];
        }

        $service->delete($media);

        $this->assertDatabaseCount('media', 0);
        foreach ($paths as $path) {
            Storage::disk('public')->assertMissing($path);
        }
    }

    public function test_the_upload_endpoint_rejects_a_non_image(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/bilder', ['files' => [UploadedFile::fake()->create('lied.mp3', 100)]])
            ->assertSessionHasErrors('files.0');

        $this->assertDatabaseCount('media', 0);
    }

    public function test_a_guest_cannot_upload(): void
    {
        $this->post('/admin/bilder', ['files' => [UploadedFile::fake()->image('x.jpg')]])
            ->assertRedirect('/admin/login');

        $this->assertSame(0, Media::count());
    }

    public function test_the_picker_uploads_without_leaving_the_editor(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/admin/bilder', ['files' => [UploadedFile::fake()->image('vulkan.jpg', 800, 1200)]])
            ->assertCreated()
            ->assertJsonPath('media.0.originalName', 'vulkan.jpg')
            ->assertJsonPath('media.0.width', 800)
            ->assertJsonPath('media.0.height', 1200);

        $this->assertSame(1, Media::count());
    }

    public function test_a_rejected_picker_upload_says_why_in_german(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/admin/bilder', ['files' => [UploadedFile::fake()->create('notizen.pdf', 10, 'application/pdf')]])
            ->assertJsonValidationErrors(['files.0' => 'Das ist kein Bild.']);
    }
}
