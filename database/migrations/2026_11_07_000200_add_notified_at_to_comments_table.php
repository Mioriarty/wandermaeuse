<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            // When the admins were mailed about this comment. Null means the
            // next scheduler tick still owes them a note.
            $table->timestamp('notified_at')->nullable()->index();
        });

        // Everything written before this existed has long been read in the
        // admin; the first tick after the deploy must not mail all of it.
        DB::table('comments')->update(['notified_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex(['notified_at']);
            $table->dropColumn('notified_at');
        });
    }
};
