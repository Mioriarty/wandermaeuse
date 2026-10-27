<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * "Bild neben Text" kept one picture under media_id; it now keeps a list
 * under media_ids, like the gallery. Existing blocks carry their picture over.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->rewrite(function (array $data): array {
            $id = $data['media_id'] ?? null;
            unset($data['media_id']);

            return ['media_ids' => is_numeric($id) ? [(int) $id] : [], ...$data];
        });
    }

    public function down(): void
    {
        // Only one picture fits the old shape; the rest are dropped.
        $this->rewrite(function (array $data): array {
            $ids = $data['media_ids'] ?? [];
            unset($data['media_ids']);

            return ['media_id' => $ids[0] ?? null, ...$data];
        });
    }

    /**
     * @param  callable(array<string, mixed>): array<string, mixed>  $change
     */
    private function rewrite(callable $change): void
    {
        DB::table('post_blocks')->where('type', 'image_text')->orderBy('id')->each(function (object $block) use ($change) {
            $data = json_decode($block->data ?? '[]', true) ?: [];

            DB::table('post_blocks')->where('id', $block->id)->update(['data' => json_encode($change($data))]);
        });
    }
};
