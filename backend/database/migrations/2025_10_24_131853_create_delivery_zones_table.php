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
        Schema::create('delivery_zones', function (Blueprint $table) {
            $table->id();
            $table->string('nome_bairro')->nullable();
            $table->string('cep_inicio', 9)->nullable();
            $table->string('cep_fim', 9)->nullable();
            $table->decimal('valor_frete', 8, 2);
            $table->string('tempo_estimado')->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamps();

            $table->index(['cep_inicio', 'cep_fim']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_zones');
    }
};
