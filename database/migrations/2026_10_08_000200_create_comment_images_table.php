<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Kept apart from `media`: readers' photos must never show up in the
        // admin's media library or be pickable for a post.
        Schema::create('comment_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained()->cascadeOnDelete();
            // Both re-encoded WebP files with random names. The upload itself
            // and its original file name are never kept. See CommentImageService.
            $table->string('path');
            $table->string('thumb_path');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_images');
    }
};
