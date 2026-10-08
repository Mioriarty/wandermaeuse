<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            // Threads are one level deep: every reply hangs off the comment
            // that opened the thread, however deep the answer it responds to.
            // Deleting that comment takes the whole thread with it.
            $table->foreignId('parent_id')->nullable()->after('post_id')
                ->constrained('comments')->cascadeOnDelete();
            // The comment actually answered, only for the "an Oma" line. If it
            // is deleted the reply stays and simply loses that line.
            $table->foreignId('reply_to_id')->nullable()->after('parent_id')
                ->constrained('comments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reply_to_id');
            $table->dropConstrainedForeignId('parent_id');
        });
    }
};
