<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StockMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = StockMovement::with(['product', 'user']);

        // Filtros
        if ($request->has('product_id') && $request->product_id) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->has('user_id') && $request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        if ($request->has('date_from') && $request->date_from) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to') && $request->date_to) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Ordenação
        $query->orderBy('created_at', 'desc');

        // Paginação
        $perPage = $request->get('per_page', 15);
        $movements = $query->paginate($perPage);


        return response()->json([
            'data' => $movements->items(),
            'total' => $movements->total(),
            'current_page' => $movements->currentPage(),
            'per_page' => $movements->perPage(),
            'last_page' => $movements->lastPage()
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = StockMovement::query();

        // Aplicar filtros de data se fornecidos
        if ($request->has('date_from') && $request->date_from) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to') && $request->date_to) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Resumo por tipo de movimentação
        $summary = $query->select('type', DB::raw('COUNT(*) as count'), DB::raw('SUM(quantity) as total_quantity'))
            ->groupBy('type')
            ->get()
            ->keyBy('type');

        // Resumo por usuário
        $userSummary = $query->with('user')
            ->select('user_id', DB::raw('COUNT(*) as movements_count'))
            ->groupBy('user_id')
            ->get()
            ->map(function ($item) {
                return [
                    'user_id' => $item->user_id,
                    'user_name' => $item->user->name ?? 'Usuário removido',
                    'movements_count' => $item->movements_count
                ];
            });

        // Resumo por produto
        $productSummary = $query->with('product')
            ->select('product_id', DB::raw('COUNT(*) as movements_count'))
            ->groupBy('product_id')
            ->get()
            ->map(function ($item) {
                return [
                    'product_id' => $item->product_id,
                    'product_name' => $item->product->name ?? 'Produto removido',
                    'movements_count' => $item->movements_count
                ];
            });

        return response()->json([
            'summary' => $summary,
            'user_summary' => $userSummary,
            'product_summary' => $productSummary,
            'total_movements' => $query->count()
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        $query = StockMovement::with(['product', 'user']);

        // Aplicar os mesmos filtros do index
        if ($request->has('product_id') && $request->product_id) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->has('user_id') && $request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        if ($request->has('date_from') && $request->date_from) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to') && $request->date_to) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $movements = $query->orderBy('created_at', 'desc')->get();

        // Formatar dados para exportação
        $exportData = $movements->map(function ($movement) {
            return [
                'Data' => $movement->created_at->format('d/m/Y H:i'),
                'Produto' => $movement->product->name ?? 'Produto removido',
                'Usuário' => $movement->user->name ?? 'Usuário removido',
                'Tipo' => $movement->type === 'entrada' ? 'Entrada' : 'Saída',
                'Quantidade' => $movement->quantity,
                'Descrição' => $movement->description ?? '',
                'Custo Unitário' => $movement->unit_cost ? 'R$ ' . number_format($movement->unit_cost, 2, ',', '.') : ''
            ];
        });

        return response()->json([
            'data' => $exportData,
            'total' => $exportData->count()
        ]);
    }
}
