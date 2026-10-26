<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // Which days the entry tells of - not when it went online. Both
            // optional; a start without an end is a single day.
            $table->date('period_starts_on')->nullable()->after('stop_id');
            $table->date('period_ends_on')->nullable()->after('period_starts_on');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['period_starts_on', 'period_ends_on']);
        });
    }
};
