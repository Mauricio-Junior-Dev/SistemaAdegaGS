<?php

namespace App\Http\Controllers;

use App\Models\DeliveryZone;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class DeliveryZoneController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $deliveryZones = DeliveryZone::ativo()->orderBy('nome_bairro')->get();
        
        return response()->json($deliveryZones);
    }

    /**
     * Display a listing of all delivery zones for admin (including inactive)
     */
    public function adminIndex(): JsonResponse
    {
        $deliveryZones = DeliveryZone::orderBy('nome_bairro')->get();
        
        return response()->json($deliveryZones);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nome_bairro' => 'required|string|max:255', // Rótulo
            'cep_inicio' => 'required|string|regex:/^\d{5}-?\d{3}$/', // 00000-000 ou 00000000
            'cep_fim' => 'required|string|regex:/^\d{5}-?\d{3}$/',
            'valor_frete' => 'required|numeric|min:0',
            'tempo_estimado' => 'nullable|string|max:255',
            'ativo' => 'boolean'
        ]);

        $deliveryZone = DeliveryZone::create($validated);

        return response()->json($deliveryZone, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $deliveryZone = DeliveryZone::findOrFail($id);
        
        return response()->json($deliveryZone);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $deliveryZone = DeliveryZone::findOrFail($id);
        
        $validated = $request->validate([
            'nome_bairro' => 'required|string|max:255',
            'cep_inicio' => 'required|string|regex:/^\d{5}-?\d{3}$/',
            'cep_fim' => 'required|string|regex:/^\d{5}-?\d{3}$/',
            'valor_frete' => 'required|numeric|min:0',
            'tempo_estimado' => 'nullable|string|max:255',
            'ativo' => 'boolean'
        ]);

        $deliveryZone->update($validated);

        return response()->json($deliveryZone);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $deliveryZone = DeliveryZone::findOrFail($id);
        $deliveryZone->delete();

        return response()->json(['message' => 'Delivery zone deleted successfully']);
    }

    /**
     * Calcula o frete com base no CEP do cliente
     */
    public function calculateFrete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // Agora esperamos 'cep' em vez de 'bairro'
            'cep' => 'required|string|regex:/^\d{5}-?\d{3}$/'
        ]);

        // Limpa o hífen/formatação do CEP do cliente para comparar com o banco
        // (O Model DeliveryZone já faz isso ao salvar, então os dados no DB estão limpos)
        $clientCep = preg_replace('/[^0-9]/', '', $validated['cep']);

        // Procura por uma zona ativa onde o CEP do cliente está DENTRO da faixa
        $deliveryZone = DeliveryZone::ativo()
            ->where('cep_inicio', '<=', $clientCep)
            ->where('cep_fim', '>=', $clientCep)
            ->first();

        if (!$deliveryZone) {
            return response()->json([
                'error' => 'CEP não atendido',
                'message' => 'Não encontramos uma taxa de entrega para este CEP.',
                'valor_frete' => null,
                'tempo_estimado' => null
            ], 404);
        }

        return response()->json([
            'valor_frete' => $deliveryZone->valor_frete,
            'tempo_estimado' => $deliveryZone->tempo_estimado,
            'nome_bairro' => $deliveryZone->nome_bairro // Rótulo da zona
        ]);
    }
}
