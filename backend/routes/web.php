<?php

use Illuminate\Support\Facades\Route;


Route::get('/{any}', function () {
    // Caminho para o index.html que você acabou de subir
    return File::get(public_path() . '/index.html');
})->where('any', '^(?!api).*$');
