<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wo wir jede Nacht schlafen: Unterkuenfte, Workaways und Nachtfahrten. Nur
 * fuer die Verwaltung - die Seite zeigt davon nichts oeffentlich.
 *
 * Eine Buchung deckt die Naechte von check_in bis zum Tag vor check_out ab,
 * wie bei jedem Hotel. Der Preis steht zweimal da: so, wie er bezahlt wurde
 * (Betrag und Waehrung), und in Euro fuer die Summen. Umgerechnet wird von
 * Hand, nicht ueber einen Kursdienst - die Seite kontaktiert keine fremden
 * Server.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20);
            $table->string('title');
            $table->string('location')->nullable();
            $table->foreignId('stop_id')->nullable()->constrained()->nullOnDelete();
            $table->string('url', 2048)->nullable();
            $table->date('check_in');
            $table->date('check_out');
            $table->string('status', 20);
            $table->boolean('paid')->default(false);
            // Pesos, Guaraníes und Co. haben grosse Betraege - daher reichlich Stellen.
            $table->decimal('price_amount', 14, 2)->nullable();
            $table->char('currency', 3)->nullable();
            $table->unsignedInteger('price_eur_cents')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['check_in', 'check_out']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
