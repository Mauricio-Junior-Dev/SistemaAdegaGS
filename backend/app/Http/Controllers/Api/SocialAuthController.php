<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SocialAuthController extends Controller
{
    public function socialAuth(Request $request)
    {
        $request->validate([
            'provider' => 'required|string|in:google,facebook',
            'token' => 'required|string',
            'email' => 'required|email',
            'name' => 'required|string',
            'picture' => 'nullable|string'
        ]);

        $provider = $request->provider;
        $email = $request->email;
        $name = $request->name;
        $picture = $request->picture;

        // Verificar se o usuário já existe
        $user = User::where('email', $email)->first();

        if (!$user) {
            // Criar novo usuário
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(Str::random(32)), // Senha aleatória
                'type' => 'customer',
                'is_active' => true,
                'phone' => null,
                'document_number' => null,
                'avatar' => $picture
            ]);
        } else {
            // Atualizar dados do usuário se necessário
            if (!$user->avatar && $picture) {
                $user->avatar = $picture;
                $user->save();
            }
        }

        // Verificar se a conta está ativa
        if (!$user->is_active) {
            return response()->json([
                'message' => 'Conta desativada'
            ], 403);
        }

        // Criar token de autenticação
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user
        ]);
    }
}
