<?php

namespace App\Http\Controllers;

use App\Models\BlockedZipCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlockedZipCodeController extends Controller
{
    /**
     * Lista todos os CEPs bloqueados (admin).
     */
    public function index(): JsonResponse
    {
        $blocked = BlockedZipCode::orderBy('zip_code')->get();

        return response()->json($blocked);
    }

    /**
     * Cria um novo CEP bloqueado.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'zip_code' => ['required', 'string', 'regex:/^\d{5}-?\d{3}$/'],
            'reason' => ['nullable', 'string', 'max:255'],
            'active' => ['boolean'],
        ]);

        $blocked = BlockedZipCode::create($validated);

        return response()->json($blocked, 201);
    }

    /**
     * Atualiza um CEP bloqueado (motivo ou ativo/inativo).
     */
    public function update(Request $request, BlockedZipCode $blockedZipCode): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
            'active' => ['boolean'],
        ]);

        $blockedZipCode->update($validated);

        return response()->json($blockedZipCode);
    }

    /**
     * Remove um CEP bloqueado.
     */
    public function destroy(BlockedZipCode $blockedZipCode): JsonResponse
    {
        $blockedZipCode->delete();

        return response()->json(['message' => 'CEP bloqueado removido com sucesso.']);
    }
}

