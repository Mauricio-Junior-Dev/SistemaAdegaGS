<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StoreConfigController extends Controller
{
    /**
     * Retorna o status da loja (público)
     */
    public function getStoreStatus()
    {
        try {
            $setting = Setting::where('key', 'is_store_open')->first();
            
            // Se não existir, retorna true (loja aberta por padrão)
            if (!$setting) {
                return response()->json(['isOpen' => true]);
            }
            
            // O Setting model tem cast 'array', então o valor já vem como array
            $value = $setting->value;
            if (is_array($value) && isset($value['is_open'])) {
                $isOpen = (bool) $value['is_open'];
            } elseif (is_array($value) && !empty($value)) {
                // Fallback: se for array mas sem a chave, usar o primeiro valor
                $isOpen = (bool) reset($value);
            } else {
                // Fallback: se não for array, converter diretamente
                $isOpen = (bool) $value;
            }
            
            return response()->json([
                'isOpen' => $isOpen
            ]);
        } catch (\Exception $e) {
            Log::error('Erro ao buscar status da loja: ' . $e->getMessage());
            // Em caso de erro, retorna true (loja aberta) para não bloquear pedidos
            return response()->json([
                'isOpen' => true
            ]);
        }
    }

    /**
     * Atualiza o status da loja (apenas admin/funcionário)
     */
    public function updateStoreStatus(Request $request)
    {
        $request->validate([
            'isOpen' => 'required|boolean'
        ]);

        try {
            // O Setting model tem cast 'array', então precisamos passar como array
            // Mas como é um valor simples, vamos usar um array com o valor
            Setting::updateOrCreate(
                ['key' => 'is_store_open'],
                ['value' => $request->isOpen ? ['is_open' => true] : ['is_open' => false]]
            );

            return response()->json([
                'message' => 'Status da loja atualizado com sucesso',
                'isOpen' => $request->isOpen
            ]);
        } catch (\Exception $e) {
            Log::error('Erro ao atualizar status da loja: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao atualizar status da loja',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}

