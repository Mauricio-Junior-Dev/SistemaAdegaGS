<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StockController extends Controller
{
    public function __construct(private StockService $stockService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $filters = $request->only(['search', 'low_stock', 'per_page', 'category', 'stock_filter']);
            $products = $this->stockService->getAllStock($filters);
            return response()->json($products);
        } catch (\Exception $e) {
            Log::error('Erro ao listar estoque: ' . $e->getMessage());
            return response()->json(['message' => 'Erro ao listar estoque'], 500);
        }
    }

    public function show(int $productId): JsonResponse
    {
        try {
            $product = $this->stockService->getProductStock($productId);
            return response()->json($product);
        } catch (\Exception $e) {
            Log::error('Erro ao buscar produto: ' . $e->getMessage());
            return response()->json(['message' => 'Erro ao buscar produto'], 500);
        }
    }

    public function update(Request $request, int $productId): JsonResponse
    {
        try {
            $validated = $request->validate([
                'quantity' => 'required|integer',
                'type' => 'required|in:entrada,saida,ajuste',
                'description' => 'nullable|string',
                'unit_cost' => 'nullable|numeric|min:0'
            ]);

            $product = $this->stockService->updateStock(
                $productId,
                $validated['quantity'],
                $validated['type'],
                $validated['description'] ?? null,
                $validated['unit_cost'] ?? null
            );

            return response()->json([
                'message' => 'Estoque atualizado com sucesso',
                'product' => $product
            ]);
        } catch (\Exception $e) {
            Log::error('Erro ao atualizar estoque: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function movements(int $productId): JsonResponse
    {
        try {
            $movements = $this->stockService->getStockMovements($productId);
            return response()->json($movements);
        } catch (\Exception $e) {
            Log::error('Erro ao buscar movimentações: ' . $e->getMessage());
            return response()->json(['message' => 'Erro ao buscar movimentações'], 500);
        }
    }

    public function lowStock(): JsonResponse
    {
        try {
            $products = $this->stockService->getLowStockProducts();
            return response()->json($products);
        } catch (\Exception $e) {
            Log::error('Erro ao buscar produtos com estoque baixo: ' . $e->getMessage());
            return response()->json(['message' => 'Erro ao buscar produtos com estoque baixo'], 500);
        }
    }

    public function summary(): JsonResponse
    {
        try {
            $summary = $this->stockService->getStockSummary();
            return response()->json($summary);
        } catch (\Exception $e) {
            Log::error('Erro no Stock Summary: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Erro ao calcular resumo do estoque'], 500);
        }
    }
}