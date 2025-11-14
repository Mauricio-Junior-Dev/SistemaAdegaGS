<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'phone' => ['required', 'string', 'max:20'],
            // Valida CPF (11 dígitos) ou CNPJ (14 dígitos) - apenas números
            'document_number' => [
                'required', 
                'string', 
                'regex:/^[0-9]{11,14}$/', // Aceita 11 (CPF) ou 14 (CNPJ) dígitos numéricos
                'unique:users,document_number'
            ],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'document_number' => $request->document_number,
            'type' => 'customer',
            'is_active' => true
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user
        ]);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'message' => 'Credenciais inválidas'
            ], 401);
        }

        $user = User::where('email', $request->email)->firstOrFail();

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Conta desativada'
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function logout(Request $request)
    {
        // Correção: Para SPA (Sanctum via Cookie), usamos o Auth::guard('web')
        // e invalidamos a sessão, em vez de deletar um token de API.
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logout realizado com sucesso'
        ]);
    }

    public function updateProfile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:users,email,' . $request->user()->id],
            'phone' => ['sometimes', 'string', 'max:20'],
            'current_password' => ['required_with:new_password', 'string'],
            'new_password' => ['sometimes', 'string', Password::defaults(), 'confirmed'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        if ($request->has('current_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'message' => 'Senha atual incorreta'
                ], 422);
            }

            $user->password = Hash::make($request->new_password);
        }

        $user->fill($request->only(['name', 'email', 'phone']));
        $user->save();

        return response()->json([
            'message' => 'Perfil atualizado com sucesso',
            'user' => $user
        ]);
    }
}
