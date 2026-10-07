<?php

namespace App\Enums;

/**
 * The fixed set of layout patterns a blog entry is built from.
 *
 * The set is deliberately closed: every pattern has one defined mobile
 * behaviour, so a post can never be arranged into something that breaks on a
 * phone. Adding a ninth pattern means adding a case here, a React component in
 * resources/js/Components/Blocks, and an editor form - nothing else.
 */
enum BlockType: string
{
    case Text = 'text';
    case Heading = 'heading';
    case ImageFull = 'image_full';
    case ImageText = 'image_text';
    case ImagePair = 'image_pair';
    case Gallery = 'gallery';
    case Quote = 'quote';
    case Divider = 'divider';

    public function label(): string
    {
        return match ($this) {
            self::Text => 'Text',
            self::Heading => 'Überschrift',
            self::ImageFull => 'Bild, volle Breite',
            self::ImageText => 'Bild neben Text',
            self::ImagePair => 'Bildpaar',
            self::Gallery => 'Galerie',
            self::Quote => 'Zitat',
            self::Divider => 'Trenner',
        };
    }

    /**
     * The media ids referenced by a block of this type, in render order.
     *
     * @param  array<string, mixed>  $data
     * @return list<int>
     */
    public function mediaIds(array $data): array
    {
        $ids = match ($this) {
            self::ImageFull => [$data['media_id'] ?? null],
            self::ImageText => [$data['media_id'] ?? null],
            self::ImagePair => [$data['left_media_id'] ?? null, $data['right_media_id'] ?? null],
            self::Gallery => $data['media_ids'] ?? [],
            default => [],
        };

        return array_values(array_map('intval', array_filter($ids, fn ($id) => is_numeric($id))));
    }

    /**
     * The shape a freshly added block of this type starts out with.
     *
     * @return array<string, mixed>
     */
    public function blankData(): array
    {
        return match ($this) {
            self::Text => ['html' => ''],
            self::Heading => ['text' => '', 'label' => ''],
            self::ImageFull => ['media_id' => null, 'caption' => '', 'bleed' => true],
            self::ImageText => ['media_id' => null, 'html' => '', 'variant' => 'left', 'size' => 'medium', 'caption' => ''],
            self::ImagePair => ['left_media_id' => null, 'right_media_id' => null, 'caption' => ''],
            self::Gallery => ['media_ids' => [], 'caption' => ''],
            self::Quote => ['text' => '', 'attribution' => ''],
            self::Divider => ['glyph' => ''],
        };
    }
}
