<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Address;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddressController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        
        // Determinar qual user_id usar para filtrar
        if (in_array($user->type, ['admin', 'employee']) && $request->has('user_id')) {
            // Admin/Employee podem filtrar por user_id específico
            $userId = $request->user_id;
        } else {
            // Clientes sempre veem apenas seus próprios endereços (ignora user_id se enviado)
            $userId = $user->id;
        }
        
        $addresses = Address::where('user_id', $userId)
            ->where('is_active', true)
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($addresses);
    }

    public function store(Request $request)
    {
        $user = auth()->user();
        
        // Validação condicional: se for funcionário/admin, user_id é opcional; se for cliente, não aceita user_id
        $validationRules = [
            'name' => 'nullable|string|max:255',
            'street' => 'required|string|max:255',
            'number' => 'required|string|max:20',
            'complement' => 'nullable|string|max:255',
            'neighborhood' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'state' => 'required|string|max:2',
            'zipcode' => 'required|string|max:10',
            'notes' => 'nullable|string',
            'is_default' => 'boolean',
        ];
        
        // Se for funcionário/admin, permitir user_id; se for cliente, não aceitar
        if (in_array($user->type, ['employee', 'admin'])) {
            $validationRules['user_id'] = 'nullable|integer|exists:users,id';
        }
        
        $request->validate($validationRules);

        try {
            DB::beginTransaction();

            // Determinar user_id: se for funcionário/admin e enviou user_id, usar; senão usar auth()->id()
            $userId = $user->id;
            
            if ($request->has('user_id') && in_array($user->type, ['employee', 'admin'])) {
                // Funcionário/admin pode criar endereço para outro usuário
                $userId = $request->user_id;
            } elseif ($request->has('user_id') && !in_array($user->type, ['employee', 'admin'])) {
                // Cliente tentando criar endereço para outro usuário - negar
                DB::rollBack();
                return response()->json(['message' => 'Você não tem permissão para criar endereços para outros usuários'], 403);
            }

            // Se este endereço for marcado como padrão, remover o padrão dos outros
            if ($request->is_default) {
                Address::where('user_id', $userId)
                    ->update(['is_default' => false]);
            }

            $address = Address::create([
                'user_id' => $userId,
                'name' => $request->name,
                'street' => $request->street,
                'number' => $request->number,
                'complement' => $request->complement,
                'neighborhood' => $request->neighborhood,
                'city' => $request->city,
                'state' => $request->state,
                'zipcode' => $request->zipcode,
                'notes' => $request->notes,
                'is_default' => $request->is_default ?? false
            ]);

            DB::commit();

            return response()->json($address, 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar endereço: ' . $e->getMessage()], 422);
        }
    }

    public function show(Address $address)
    {
        $user = auth()->user();
        
        // Permitir acesso se:
        // 1. O endereço pertence ao usuário logado, OU
        // 2. O usuário é admin ou employee (funcionário pode ver endereços de clientes)
        if ($address->user_id !== $user->id && !in_array($user->type, ['admin', 'employee'])) {
            return response()->json(['message' => 'Endereço não encontrado'], 404);
        }

        return response()->json($address);
    }

    public function update(Request $request, Address $address)
    {
        // Verificar se o endereço pertence ao usuário
        if ($address->user_id !== auth()->id()) {
            return response()->json(['message' => 'Endereço não encontrado'], 404);
        }

        $request->validate([
            'name' => 'nullable|string|max:255',
            'street' => 'required|string|max:255',
            'number' => 'required|string|max:20',
            'complement' => 'nullable|string|max:255',
            'neighborhood' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'state' => 'required|string|max:2',
            'zipcode' => 'required|string|max:10',
            'notes' => 'nullable|string',
            'is_default' => 'boolean'
        ]);

        try {
            DB::beginTransaction();

            // Se este endereço for marcado como padrão, remover o padrão dos outros
            if ($request->is_default) {
                Address::where('user_id', auth()->id())
                    ->where('id', '!=', $address->id)
                    ->update(['is_default' => false]);
            }

            $address->update($request->all());

            DB::commit();

            return response()->json($address);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar endereço: ' . $e->getMessage()], 422);
        }
    }

    public function destroy(Address $address)
    {
        // Verificar se o endereço pertence ao usuário
        if ($address->user_id !== auth()->id()) {
            return response()->json(['message' => 'Endereço não encontrado'], 404);
        }

        // Verificar se o endereço está sendo usado em pedidos
        if ($address->orders()->exists()) {
            return response()->json(['message' => 'Não é possível excluir endereço que está sendo usado em pedidos'], 422);
        }

        $address->delete();

        return response()->json(['message' => 'Endereço excluído com sucesso']);
    }

    public function setDefault(Address $address)
    {
        // Verificar se o endereço pertence ao usuário
        if ($address->user_id !== auth()->id()) {
            return response()->json(['message' => 'Endereço não encontrado'], 404);
        }

        try {
            DB::beginTransaction();

            // Remover padrão dos outros endereços
            Address::where('user_id', auth()->id())
                ->where('id', '!=', $address->id)
                ->update(['is_default' => false]);

            // Definir este como padrão
            $address->update(['is_default' => true]);

            DB::commit();

            return response()->json(['message' => 'Endereço definido como padrão']);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao definir endereço padrão: ' . $e->getMessage()], 422);
        }
    }
}