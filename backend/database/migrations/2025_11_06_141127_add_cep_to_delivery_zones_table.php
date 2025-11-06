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
        Schema::table('delivery_zones', function (Blueprint $table) {
            // Adiciona as colunas de faixa de CEP (após 'nome_bairro')
            $table->string('cep_inicio', 9)->nullable()->after('nome_bairro');
            $table->string('cep_fim', 9)->nullable()->after('cep_inicio');

            // Adiciona um índice para otimizar a busca
            $table->index(['cep_inicio', 'cep_fim']);

            // Torna o nome do bairro opcional, já que o CEP é a chave
            $table->string('nome_bairro')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('delivery_zones', function (Blueprint $table) {
            $table->dropIndex(['cep_inicio', 'cep_fim']);
            $table->dropColumn(['cep_inicio', 'cep_fim']);
            $table->string('nome_bairro')->nullable(false)->change();
        });
    }
};
