<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use MercadoPago\SDK;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Configurar SDK do Mercado Pago (apenas se a classe estiver disponível)
        if (class_exists(\MercadoPago\SDK::class)) {
            SDK::setAccessToken(config('services.mercadopago.access_token'));
        }
    }
}
