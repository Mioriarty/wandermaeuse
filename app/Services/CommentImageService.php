<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

/**
 * Photos that readers attach to a comment.
 *
 * Anyone can upload here, so nothing from the upload is kept as it arrived:
 * the file is decoded into pixels and written out fresh as WebP. That drops
 * EXIF data (a phone photo carries the GPS position of whoever took it) and
 * anything else that rode along in the file, such as a script appended to
 * an otherwise valid image. The name and extension are always ours.
 */
class CommentImageService
{
    /**
     * Decoding unpacks the whole bitmap at 4 bytes per pixel before anything
     * can be scaled down. 40 megapixels is about 160 MB, which still fits the
     * 512M memory_limit from public/.user.ini. The cap is checked from the
     * file header before decoding, so a tiny file claiming to be 50000 x 50000
     * pixels never gets that far.
     */
    public const MAX_PIXELS = 40_000_000;

    public const MAX_EDGE = 1600;

    public const THUMB_EDGE = 480;

    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver());
    }

    /**
     * Whether the header of an upload claims a size we are willing to decode.
     */
    public static function withinPixelLimit(UploadedFile $file): bool
    {
        $size = @getimagesize($file->getRealPath());

        return is_array($size)
            && $size[0] > 0
            && $size[1] > 0
            && $size[0] * $size[1] <= self::MAX_PIXELS;
    }

    /**
     * Re-encode one upload and return the columns for a CommentImage.
     *
     * @return array{path: string, thumb_path: string, width: int, height: int}
     */
    public function store(UploadedFile $file): array
    {
        $disk = Storage::disk('public');
        $stem = 'comments/'.date('Y/m').'/'.Str::random(32);

        $image = $this->manager->decodePath($file->getRealPath());
        // Phones write orientation into EXIF rather than rotating pixels; the
        // EXIF is about to go, so the rotation has to be applied now.
        $image->orient();
        $image->scaleDown(width: self::MAX_EDGE, height: self::MAX_EDGE);

        $path = $stem.'.webp';
        $disk->put($path, (string) $image->encode(new WebpEncoder(quality: 80)));

        $thumb = (clone $image)->scaleDown(width: self::THUMB_EDGE, height: self::THUMB_EDGE);
        $thumbPath = $stem.'-thumb.webp';
        $disk->put($thumbPath, (string) $thumb->encode(new WebpEncoder(quality: 75)));

        return [
            'path' => $path,
            'thumb_path' => $thumbPath,
            'width' => $image->width(),
            'height' => $image->height(),
        ];
    }

    /**
     * Remove files written by store() whose comment never got saved.
     *
     * @param  list<array{path: string, thumb_path: string}>  $stored
     */
    public function discard(array $stored): void
    {
        foreach ($stored as $image) {
            Storage::disk('public')->delete([$image['path'], $image['thumb_path']]);
        }
    }
}
