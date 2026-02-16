<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('blocked_zip_codes', function (Blueprint $table) {
            $table->id();
            $table->string('zip_code', 9);
            $table->string('reason')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index('zip_code');
            $table->index('active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('blocked_zip_codes');
    }
};

