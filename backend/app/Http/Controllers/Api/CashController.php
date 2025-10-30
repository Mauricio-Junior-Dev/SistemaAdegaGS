<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\CashTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CashController extends Controller
{
    public function status()
    {
        $session = CashSession::where('is_open', true)->latest('opened_at')->first();
        if (!$session) {
            return response()->json([
                'is_open' => false,
                'opened_at' => null,
                'opened_by' => null,
                'initial_amount' => 0,
                'current_amount' => 0,
            ]);
        }

        return response()->json([
            'is_open' => true,
            'opened_at' => $session->opened_at,
            'opened_by' => optional($session->openedBy)->name,
            'initial_amount' => $session->initial_amount,
            'current_amount' => $session->current_amount,
        ]);
    }

    public function open(Request $request)
    {
        $request->validate([
            'initial_amount' => 'required|numeric|min:0',
        ]);

        if (CashSession::where('is_open', true)->exists()) {
            return response()->json(['message' => 'Já existe um caixa aberto'], 422);
        }

        $session = CashSession::create([
            'opened_by' => Auth::id(),
            'opened_at' => now(),
            'initial_amount' => $request->initial_amount,
            'is_open' => true,
        ]);

        return response()->json([
            'is_open' => true,
            'opened_at' => $session->opened_at,
            'opened_by' => optional($session->openedBy)->name,
            'initial_amount' => $session->initial_amount,
            'current_amount' => $session->current_amount,
        ], 201);
    }

    public function close()
    {
        $session = CashSession::where('is_open', true)->latest('opened_at')->first();
        if (!$session) {
            return response()->json(['message' => 'Não há caixa aberto'], 422);
        }

        $session->update([
            'is_open' => false,
            'closed_at' => now(),
            'closing_amount' => $session->current_amount,
        ]);

        return response()->json([
            'date' => now(),
            'opening_balance' => $session->initial_amount,
            'closing_balance' => $session->closing_amount,
            'total_income' => $session->transactions()->where('type', 'entrada')->sum('amount'),
            'total_outcome' => $session->transactions()->where('type', 'saida')->sum('amount'),
            'transactions' => $session->transactions()->orderBy('created_at')->get(),
        ]);
    }

    public function today()
    {
        $session = CashSession::where('is_open', true)->latest('opened_at')->first();
        if (!$session) {
            return response()->json([]);
        }
        return response()->json($session->transactions()->orderByDesc('created_at')->get());
    }

    public function transaction(Request $request)
    {
        $request->validate([
            'type' => 'required|in:entrada,saida',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
        ]);

        $session = CashSession::where('is_open', true)->latest('opened_at')->first();
        if (!$session) {
            return response()->json(['message' => 'Não há caixa aberto'], 422);
        }

        if ($request->type === 'saida' && $request->amount > $session->current_amount) {
            return response()->json(['message' => 'Valor maior que o saldo disponível'], 422);
        }

        $tx = CashTransaction::create([
            'cash_session_id' => $session->id,
            'type' => $request->type,
            'amount' => $request->amount,
            'description' => $request->description,
            'created_by' => Auth::id(),
        ]);

        return response()->json($tx, 201);
    }

    public function report(Request $request)
    {
        $date = $request->get('date');
        $query = CashSession::query();
        if ($date) {
            $query->whereDate('opened_at', date('Y-m-d', strtotime($date)));
        }
        $session = $query->latest('opened_at')->first();
        if (!$session) {
            return response()->json([
                'date' => $date ? date('c', strtotime($date)) : now(),
                'opening_balance' => 0,
                'closing_balance' => 0,
                'total_income' => 0,
                'total_outcome' => 0,
                'transactions' => [],
            ]);
        }

        return response()->json([
            'date' => $session->opened_at,
            'opening_balance' => $session->initial_amount,
            'closing_balance' => $session->is_open ? $session->current_amount : ($session->closing_amount ?? $session->current_amount),
            'total_income' => $session->transactions()->where('type', 'entrada')->sum('amount'),
            'total_outcome' => $session->transactions()->where('type', 'saida')->sum('amount'),
            'transactions' => $session->transactions()->orderBy('created_at')->get(),
        ]);
    }

    // Admin: listar sessões de caixa
    public function sessions(Request $request)
    {
        $query = CashSession::query();
        if ($request->filled('date')) {
            $query->whereDate('opened_at', $request->get('date'));
        }
        if ($request->filled('is_open')) {
            $isOpen = filter_var($request->get('is_open'), FILTER_VALIDATE_BOOLEAN);
            $query->where('is_open', $isOpen);
        }
        $sessions = $query->orderByDesc('opened_at')->paginate($request->get('per_page', 15));

        $data = $sessions->getCollection()->map(function (CashSession $s) {
            return [
                'id' => $s->id,
                'opened_at' => $s->opened_at,
                'closed_at' => $s->closed_at,
                'opened_by' => optional($s->openedBy)->name,
                'initial_amount' => $s->initial_amount,
                'closing_amount' => $s->closing_amount,
                'is_open' => $s->is_open,
                'current_amount' => $s->current_amount,
                'total_income' => (float) $s->transactions()->where('type', 'entrada')->sum('amount'),
                'total_outcome' => (float) $s->transactions()->where('type', 'saida')->sum('amount'),
            ];
        });

        return response()->json([
            'data' => $data,
            'total' => $sessions->total(),
            'current_page' => $sessions->currentPage(),
            'per_page' => $sessions->perPage(),
            'last_page' => $sessions->lastPage(),
        ]);
    }

    // Admin: detalhes de uma sessão com transações
    public function sessionDetail(CashSession $session)
    {
        return response()->json([
            'session' => [
                'id' => $session->id,
                'opened_at' => $session->opened_at,
                'closed_at' => $session->closed_at,
                'opened_by' => optional($session->openedBy)->name,
                'initial_amount' => $session->initial_amount,
                'closing_amount' => $session->closing_amount,
                'is_open' => $session->is_open,
                'current_amount' => $session->current_amount,
            ],
            'transactions' => $session->transactions()->orderByDesc('created_at')->get(),
        ]);
    }

    // Admin: transações por período
    public function transactions(Request $request)
    {
        $query = CashTransaction::query()->with(['session', 'createdBy']);
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->get('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->get('to'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->get('type'));
        }
        $transactions = $query->orderByDesc('created_at')->paginate($request->get('per_page', 20));

        return response()->json($transactions);
    }
}


