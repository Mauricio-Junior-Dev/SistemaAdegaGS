<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('opened_by');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->decimal('initial_amount', 10, 2);
            $table->decimal('closing_amount', 10, 2)->nullable();
            $table->boolean('is_open')->default(true);
            $table->timestamps();

            $table->foreign('opened_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
    }
};


