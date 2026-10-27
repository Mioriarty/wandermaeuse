<?php

namespace Tests\Unit;

use App\Enums\BlockType;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Pure logic around the eight layout patterns - no database, no HTTP.
 */
class BlockTypeTest extends TestCase
{
    public static function everyType(): array
    {
        return array_map(fn (BlockType $type) => [$type], BlockType::cases());
    }

    #[DataProvider('everyType')]
    public function test_every_type_has_a_german_label(BlockType $type): void
    {
        $this->assertNotSame('', trim($type->label()));
    }

    #[DataProvider('everyType')]
    public function test_blank_data_survives_being_read_back(BlockType $type): void
    {
        // The editor starts a new block from blankData() and the renderer reads
        // it straight away, so it must never blow up on a freshly added block.
        $this->assertSame([], $type->mediaIds($type->blankData()));
    }

    public function test_media_ids_are_returned_in_render_order(): void
    {
        $this->assertSame(
            [7, 3],
            BlockType::ImagePair->mediaIds(['left_media_id' => 7, 'right_media_id' => 3]),
        );

        $this->assertSame(
            [9, 4, 6],
            BlockType::Gallery->mediaIds(['media_ids' => [9, 4, 6]]),
        );

        $this->assertSame(
            [8, 2],
            BlockType::ImageText->mediaIds(['media_ids' => [8, 2]]),
        );
    }

    public function test_missing_and_junk_ids_are_dropped_rather_than_crashing(): void
    {
        // A half-filled block is a normal state in the editor.
        $this->assertSame([], BlockType::ImageFull->mediaIds([]));
        $this->assertSame([], BlockType::ImageFull->mediaIds(['media_id' => null]));
        $this->assertSame([5], BlockType::ImagePair->mediaIds(['left_media_id' => 5]));
        $this->assertSame([], BlockType::Gallery->mediaIds(['media_ids' => [null, 'abc']]));
    }

    public function test_numeric_strings_from_the_form_become_integers(): void
    {
        $ids = BlockType::ImageFull->mediaIds(['media_id' => '12']);

        $this->assertSame([12], $ids);
    }

    public function test_text_patterns_reference_no_media(): void
    {
        foreach ([BlockType::Text, BlockType::Heading, BlockType::Quote, BlockType::Divider] as $type) {
            $this->assertSame([], $type->mediaIds(['media_id' => 1, 'media_ids' => [2, 3]]));
        }
    }
}
