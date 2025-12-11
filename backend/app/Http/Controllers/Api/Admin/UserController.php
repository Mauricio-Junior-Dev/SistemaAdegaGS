<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        // Filtros
        if ($request->has('search') && $request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                  ->orWhere('email', 'like', '%' . $request->search . '%');
            });
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('is_active')) {
            $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_active', $isActive);
        }

        // Ordenação
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // Paginação
        $perPage = $request->get('per_page', 10);
        $users = $query->paginate($perPage);

        return response()->json([
            'data' => $users->items(),
            'total' => $users->total(),
            'current_page' => $users->currentPage(),
            'per_page' => $users->perPage(),
            'last_page' => $users->lastPage()
        ]);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    public function store(Request $request): JsonResponse
    {
        // Converter is_active de string para booleano antes da validação
        // (necessário porque FormData envia tudo como string)
        if ($request->has('is_active')) {
            $isActive = $request->input('is_active');
            if (!is_bool($isActive)) {
                // Converter strings comuns para booleano
                if (is_string($isActive)) {
                    $isActive = strtolower(trim($isActive));
                    $isActive = in_array($isActive, ['true', '1', 'on', 'yes', 'y'], true);
                } elseif (is_numeric($isActive)) {
                    $isActive = (bool) $isActive;
                } else {
                    $isActive = filter_var($isActive, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;
                }
                $request->merge(['is_active' => $isActive]);
            }
        } else {
            // Se não foi enviado, definir como true (padrão)
            $request->merge(['is_active' => true]);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Password::defaults()],
            'type' => 'required|in:admin,employee,customer',
            'phone' => 'nullable|string|max:20',
            'avatar' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'is_active' => 'boolean',
            'address' => 'nullable|array',
            'address.street' => 'nullable|string|max:255',
            'address.number' => 'nullable|string|max:10',
            'address.complement' => 'nullable|string|max:255',
            'address.neighborhood' => 'nullable|string|max:255',
            'address.city' => 'nullable|string|max:255',
            'address.state' => 'nullable|string|max:2',
            'address.zipcode' => 'nullable|string|max:10'
        ]);

        $user = new User();
        $user->name = $request->name;
        $user->email = $request->email;
        $user->password = Hash::make($request->password);
        $user->type = $request->type;
        $user->phone = $request->phone;
        $user->is_active = $request->boolean('is_active', true);

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('avatars', 'public');
            $user->avatar_url = Storage::url($path);
        }

        $user->save();

        // Criar endereço se fornecido
        if ($request->has('address') && !empty(array_filter($request->address))) {
            $user->address()->create($request->address);
        }

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        try {
            \Log::info('Updating user: ' . $user->id);
            \Log::info('Request data: ' . json_encode($request->all()));

            $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
                'password' => 'nullable|confirmed|min:8',
                'type' => 'required|in:admin,employee,customer',
                'phone' => 'nullable|string|max:20',
                'avatar' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
                'is_active' => 'nullable',
                'address' => 'nullable|array',
                'address.street' => 'nullable|string|max:255',
                'address.number' => 'nullable|string|max:10',
                'address.complement' => 'nullable|string|max:255',
                'address.neighborhood' => 'nullable|string|max:255',
                'address.city' => 'nullable|string|max:255',
                'address.state' => 'nullable|string|max:2',
                'address.zipcode' => 'nullable|string|max:10'
            ]);

            $user->name = $request->name;
            $user->email = $request->email;
            $user->type = $request->type;
            $user->phone = $request->phone;
            $user->is_active = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;

            if ($request->filled('password')) {
                $user->password = Hash::make($request->password);
            }

        if ($request->hasFile('avatar')) {
            // Deletar avatar anterior se existir
            if ($user->avatar_url) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $user->avatar_url));
            }

            $path = $request->file('avatar')->store('avatars', 'public');
            $user->avatar_url = Storage::url($path);
        }

        $user->save();

        // Atualizar endereço
        if ($request->has('address')) {
            if ($user->address) {
                $user->address()->update($request->address);
            } elseif (!empty(array_filter($request->address))) {
                $user->address()->create($request->address);
            }
        }

        $user->save();
        \Log::info('User updated successfully: ' . $user->id);

        return response()->json($user);
        } catch (\Exception $e) {
            \Log::error('Error updating user: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json(['error' => 'Erro ao salvar usuário: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(User $user): JsonResponse
    {
        // Não permitir que o usuário delete a si mesmo
        if ($user->id === auth()->id()) {
            return response()->json(['error' => 'Não é possível excluir seu próprio usuário'], 400);
        }

        // Verificar se o usuário tem pedidos
        if ($user->orders()->count() > 0) {
            return response()->json(['error' => 'Não é possível excluir usuário com pedidos'], 400);
        }

        // Deletar avatar se existir
        if ($user->avatar_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $user->avatar_url));
        }

        // Deletar endereço
        if ($user->address) {
            $user->address()->delete();
        }

        $user->delete();

        return response()->json(null, 204);
    }

    public function toggleStatus(User $user): JsonResponse
    {
        // Não permitir que o usuário desative a si mesmo
        if ($user->id === auth()->id()) {
            return response()->json(['error' => 'Não é possível alterar seu próprio status'], 400);
        }

        $user->is_active = !$user->is_active;
        $user->save();

        return response()->json($user);
    }

    public function uploadAvatar(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        // Deletar avatar anterior se existir
        if ($user->avatar_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $user->avatar_url));
        }

        $path = $request->file('avatar')->store('avatars', 'public');
        $user->avatar_url = Storage::url($path);
        $user->save();

        return response()->json($user);
    }

    public function deleteAvatar(User $user): JsonResponse
    {
        if ($user->avatar_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $user->avatar_url));
            $user->avatar_url = null;
            $user->save();
        }

        return response()->json($user);
    }

    public function validateEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|string|email',
            'exclude_id' => 'nullable|integer'
        ]);

        $query = User::where('email', $request->email);
        
        if ($request->has('exclude_id')) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $exists = $query->exists();

        return response()->json(['valid' => !$exists]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,xlsx,xls'
        ]);

        // Implementar lógica de importação
        return response()->json([
            'imported' => 0,
            'errors' => ['Funcionalidade de importação será implementada']
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        $request->validate([
            'format' => 'required|in:csv,xlsx'
        ]);

        // Implementar lógica de exportação
        return response()->json(['error' => 'Funcionalidade de exportação será implementada'], 501);
    }
}
