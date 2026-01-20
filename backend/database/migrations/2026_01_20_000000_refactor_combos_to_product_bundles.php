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
        /**
         * 1) Remover relacionamento antigo de combos em order_items
         *    - solta FK de combo_id
         *    - remove colunas combo_id e is_combo
         */
        if (Schema::hasTable('order_items')) {
            Schema::table('order_items', function (Blueprint $table) {
                if (Schema::hasColumn('order_items', 'combo_id')) {
                    // Nome da FK pode variar, mas o dropForeign por coluna é seguro
                    try {
                        $table->dropForeign(['combo_id']);
                    } catch (\Throwable $e) {
                        // Ignorar caso a FK já tenha sido removida/manual
                    }
                }

                if (Schema::hasColumn('order_items', 'combo_id')) {
                    $table->dropColumn('combo_id');
                }
                if (Schema::hasColumn('order_items', 'is_combo')) {
                    $table->dropColumn('is_combo');
                }
            });
        }

        /**
         * 2) Dropar tabelas antigas de combos
         */
        if (Schema::hasTable('combo_products')) {
            Schema::drop('combo_products');
        }

        if (Schema::hasTable('combos')) {
            Schema::drop('combos');
        }

        /**
         * 3) Criar nova estrutura de Product Bundles
         */

        // Tabela principal de bundles (combos dinâmicos)
        Schema::create('product_bundles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();

            // Tipo de bundle (semântica para o frontend)
            $table->enum('bundle_type', ['combo', 'copao', 'custom'])->default('combo');

            // Estratégia de precificação
            $table->enum('pricing_type', ['fixed', 'calculated'])->default('fixed');
            $table->decimal('base_price', 10, 2)->nullable();       // Preço fixo/opcional
            $table->decimal('original_price', 10, 2)->nullable();   // Referência para desconto
            $table->decimal('discount_percentage', 5, 2)->nullable();

            // Metadados
            $table->string('barcode')->nullable()->unique();
            $table->boolean('is_active')->default(true);
            $table->boolean('featured')->default(false);
            $table->boolean('offers')->default(false);
            $table->boolean('popular')->default(false);
            $table->json('images')->nullable();

            $table->timestamps();
        });

        // Grupos de escolha dentro do bundle (ex: "Escolha o Gin")
        Schema::create('bundle_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_id')
                ->constrained('product_bundles')
                ->onDelete('cascade');

            $table->string('name');
            $table->text('description')->nullable();

            // Ordem de exibição (para wizards)
            $table->integer('order')->default(0);

            // Regras de seleção
            $table->boolean('is_required')->default(true);
            $table->integer('min_selections')->default(1);
            $table->integer('max_selections')->default(1);

            // single = escolha única, multiple = múltiplas escolhas
            $table->enum('selection_type', ['single', 'multiple'])->default('single');

            $table->timestamps();

            $table->index(['bundle_id', 'order']);
        });

        // Opções de produto em cada grupo
        Schema::create('bundle_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')
                ->constrained('bundle_groups')
                ->onDelete('cascade');

            $table->foreignId('product_id')
                ->constrained()
                ->onDelete('cascade');

            // Quantidade padrão e tipo de venda
            $table->integer('quantity')->default(1);
            $table->enum('sale_type', ['dose', 'garrafa'])->default('garrafa');

            // Ajuste de preço (positivo ou negativo)
            $table->decimal('price_adjustment', 10, 2)->default(0.00);

            // Ordem de exibição dentro do grupo
            $table->integer('order')->default(0);

            $table->timestamps();

            $table->unique(['group_id', 'product_id', 'sale_type'], 'bundle_options_unique');
            $table->index(['group_id', 'order']);
        });

        // Registro detalhado das escolhas de um bundle em um item de pedido
        Schema::create('order_item_selections', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_item_id')
                ->constrained('order_items')
                ->onDelete('cascade');

            $table->foreignId('bundle_group_id')
                ->constrained('bundle_groups')
                ->onDelete('cascade');

            $table->foreignId('product_id')
                ->constrained()
                ->onDelete('cascade');

            $table->integer('quantity')->default(1);
            $table->enum('sale_type', ['dose', 'garrafa'])->default('garrafa');
            $table->decimal('price', 10, 2); // preço efetivo aplicado na escolha

            $table->timestamps();

            $table->index(['order_item_id', 'bundle_group_id'], 'order_item_selections_idx');
        });

        /**
         * 4) Ajustar order_items para suportar bundles
         */
        if (Schema::hasTable('order_items')) {
            Schema::table('order_items', function (Blueprint $table) {
                // Coluna para associar um item de pedido a um bundle dinâmico
                if (!Schema::hasColumn('order_items', 'product_bundle_id')) {
                    $table->foreignId('product_bundle_id')
                        ->nullable()
                        ->after('product_id')
                        ->constrained('product_bundles')
                        ->onDelete('cascade');
                }

                // Flag para indicar se é um bundle dinâmico
                if (!Schema::hasColumn('order_items', 'is_bundle')) {
                    $table->boolean('is_bundle')
                        ->default(false)
                        ->after('product_bundle_id');
                }

                // Snapshot/json amigável para impressão/visualização
                if (!Schema::hasColumn('order_items', 'bundle_snapshot')) {
                    $table->json('bundle_snapshot')
                        ->nullable()
                        ->after('subtotal');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * Observação: o down() tenta restaurar a estrutura antiga de combos
     * de forma aproximada. Ajustes adicionais podem ser necessários
     * dependendo do uso futuro.
     */
    public function down(): void
    {
        // Remover novas colunas de order_items
        if (Schema::hasTable('order_items')) {
            Schema::table('order_items', function (Blueprint $table) {
                if (Schema::hasColumn('order_items', 'product_bundle_id')) {
                    try {
                        $table->dropForeign(['product_bundle_id']);
                    } catch (\Throwable $e) {
                        // Ignorar se já removido
                    }
                    $table->dropColumn('product_bundle_id');
                }
                if (Schema::hasColumn('order_items', 'is_bundle')) {
                    $table->dropColumn('is_bundle');
                }
                if (Schema::hasColumn('order_items', 'bundle_snapshot')) {
                    $table->dropColumn('bundle_snapshot');
                }

                // Restaurar colunas antigas básicas (sem recriar FKs aqui)
                if (!Schema::hasColumn('order_items', 'combo_id')) {
                    $table->unsignedBigInteger('combo_id')->nullable()->after('product_id');
                }
                if (!Schema::hasColumn('order_items', 'is_combo')) {
                    $table->boolean('is_combo')->default(false)->after('combo_id');
                }
            });
        }

        // Dropar novas tabelas
        if (Schema::hasTable('order_item_selections')) {
            Schema::drop('order_item_selections');
        }
        if (Schema::hasTable('bundle_options')) {
            Schema::drop('bundle_options');
        }
        if (Schema::hasTable('bundle_groups')) {
            Schema::drop('bundle_groups');
        }
        if (Schema::hasTable('product_bundles')) {
            Schema::drop('product_bundles');
        }

        // (Opcional) recriar estrutura antiga de combos de forma mínima
        if (!Schema::hasTable('combos')) {
            Schema::create('combos', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->decimal('price', 10, 2);
                $table->decimal('original_price', 10, 2)->nullable();
                $table->decimal('discount_percentage', 5, 2)->nullable();
                $table->string('barcode')->nullable()->unique();
                $table->boolean('is_active')->default(true);
                $table->boolean('featured')->default(false);
                $table->boolean('offers')->default(false);
                $table->boolean('popular')->default(false);
                $table->json('images')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('combo_products')) {
            Schema::create('combo_products', function (Blueprint $table) {
                $table->id();
                $table->foreignId('combo_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->integer('quantity')->default(1);
                $table->string('sale_type')->default('garrafa');
                $table->timestamps();

                $table->unique(['combo_id', 'product_id', 'sale_type']);
            });
        }
    }
};

