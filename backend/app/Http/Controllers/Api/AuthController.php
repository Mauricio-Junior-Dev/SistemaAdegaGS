<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Rules\DocumentNumber;
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
            // Validação robusta de CPF/CNPJ com dígitos verificadores
            'document_number' => [
                'required', 
                'string',
                new DocumentNumber(),
                'unique:users,document_number'
            ],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Remove formatação do document_number antes de salvar (mantém apenas números)
        $documentNumber = preg_replace('/\D/', '', $request->document_number);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'document_number' => $documentNumber,
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
            // Validação robusta de CPF/CNPJ com dígitos verificadores
            'document_number' => [
                'sometimes',
                'string',
                new DocumentNumber(),
                'unique:users,document_number,' . $request->user()->id
            ],
            'current_password' => ['required_with:new_password', 'string'],
            'new_password' => ['sometimes', 'string', Password::defaults(), 'confirmed'],
        ], [
            // Mensagens personalizadas e amigáveis
            'name.required' => 'O nome é obrigatório.',
            'name.string' => 'O nome deve ser um texto.',
            'name.max' => 'O nome não pode ter mais de 255 caracteres.',
            'email.required' => 'O e-mail é obrigatório.',
            'email.email' => 'Por favor, informe um e-mail válido.',
            'email.unique' => 'Este e-mail já pertence a outra conta.',
            'email.max' => 'O e-mail não pode ter mais de 255 caracteres.',
            'phone.required' => 'O telefone é obrigatório.',
            'phone.string' => 'O telefone deve ser um texto.',
            'phone.max' => 'O telefone não pode ter mais de 20 caracteres.',
            'document_number.required' => 'O CPF/CNPJ é obrigatório.',
            'document_number.string' => 'O CPF/CNPJ deve ser um texto.',
            'document_number.unique' => 'O CPF/CNPJ informado já está cadastrado.',
            'current_password.required_with' => 'A senha atual é obrigatória para alterar a senha.',
            'current_password.string' => 'A senha atual deve ser um texto.',
            'new_password.string' => 'A nova senha deve ser um texto.',
            'new_password.min' => 'A nova senha deve ter no mínimo 8 caracteres.',
            'new_password.confirmed' => 'A confirmação da nova senha não confere.',
        ], [
            // Atributos personalizados (nomes amigáveis para os campos)
            'name' => 'nome',
            'email' => 'e-mail',
            'phone' => 'telefone',
            'document_number' => 'CPF/CNPJ',
            'current_password' => 'senha atual',
            'new_password' => 'nova senha',
            'new_password_confirmation' => 'confirmação da nova senha',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        if ($request->has('current_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'errors' => [
                        'current_password' => ['A senha atual informada está incorreta.']
                    ]
                ], 422);
            }

            $user->password = Hash::make($request->new_password);
        }

        // Preparar dados para atualização
        $updateData = $request->only(['name', 'email', 'phone']);
        
        // Se document_number foi fornecido, remove formatação (mantém apenas números)
        if ($request->has('document_number')) {
            $updateData['document_number'] = preg_replace('/\D/', '', $request->document_number);
        }

        $user->fill($updateData);
        $user->save();

        return response()->json([
            'message' => 'Perfil atualizado com sucesso',
            'user' => $user
        ]);
    }
}
