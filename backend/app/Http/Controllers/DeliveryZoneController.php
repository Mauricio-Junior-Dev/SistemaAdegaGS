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
            'nome_bairro' => 'required|string|max:255|unique:delivery_zones,nome_bairro',
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
            'nome_bairro' => 'required|string|max:255|unique:delivery_zones,nome_bairro,' . $id,
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
     * Calculate delivery fee for a specific neighborhood
     */
    public function calculateFrete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bairro' => 'required|string'
        ]);

        $deliveryZone = DeliveryZone::ativo()
            ->where('nome_bairro', 'LIKE', '%' . $validated['bairro'] . '%')
            ->first();

        if (!$deliveryZone) {
            return response()->json([
                'error' => 'Bairro não encontrado',
                'message' => 'Entre em contato para verificar disponibilidade',
                'valor_frete' => null,
                'tempo_estimado' => null
            ], 404);
        }

        return response()->json([
            'valor_frete' => $deliveryZone->valor_frete,
            'tempo_estimado' => $deliveryZone->tempo_estimado,
            'nome_bairro' => $deliveryZone->nome_bairro
        ]);
    }
}
