<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class ResetPasswordController extends Controller
{
    private const RATE_LIMIT_ATTEMPTS = 5;
    private const RATE_LIMIT_DECAY_MINUTES = 60;
    private const RESET_TOKEN_TTL_SECONDS = 600; // 10 min
    private const CACHE_PREFIX = 'password_reset:';
    private const RATE_LIMIT_PREFIX = 'password_validate_attempts:';

    /**
     * POST /api/password/validate-reset
     * Valida CPF + últimos 4 dígitos do celular. Retorna reset_token temporário.
     */
    public function validateReset(Request $request): JsonResponse
    {
        $request->validate([
            'document_number' => ['required', 'string'],
            'phone_last_4' => ['required', 'string', 'size:4'],
        ]);

        $documentNumber = preg_replace('/\D/', '', $request->document_number);
        $phoneLast4 = preg_replace('/\D/', '', $request->phone_last_4);

        if (strlen($documentNumber) !== 11 || strlen($phoneLast4) !== 4) {
            $this->logFailedAttempt($request, $documentNumber);
            return response()->json([
                'message' => 'Dados não conferem.',
                'error' => 'validation_failed',
            ], 400);
        }

        $rateLimitKeyByIp = self::RATE_LIMIT_PREFIX . 'ip:' . $request->ip();
        $rateLimitKeyByCpf = self::RATE_LIMIT_PREFIX . 'cpf:' . $documentNumber;

        $attemptsByIp = (int) Cache::get($rateLimitKeyByIp, 0);
        $attemptsByCpf = (int) Cache::get($rateLimitKeyByCpf, 0);

        if ($attemptsByIp >= self::RATE_LIMIT_ATTEMPTS || $attemptsByCpf >= self::RATE_LIMIT_ATTEMPTS) {
            Log::warning('Password validate-reset: rate limit exceeded', [
                'ip' => $request->ip(),
                'document_number_hash' => hash('sha256', $documentNumber),
            ]);
            return response()->json([
                'message' => 'Muitas tentativas. Tente novamente em 1 hora.',
                'error' => 'rate_limit_exceeded',
            ], 429);
        }

        $user = User::where('document_number', $documentNumber)->first();

        if (!$user || !$user->phone) {
            $this->incrementAttempts($rateLimitKeyByIp, $rateLimitKeyByCpf);
            $this->logFailedAttempt($request, $documentNumber);
            return response()->json([
                'message' => 'Dados não conferem.',
                'error' => 'validation_failed',
            ], 400);
        }

        $phoneClean = preg_replace('/\D/', '', $user->phone);
        $last4FromDb = strlen($phoneClean) >= 4 ? substr($phoneClean, -4) : $phoneClean;

        if ($last4FromDb !== $phoneLast4) {
            $this->incrementAttempts($rateLimitKeyByIp, $rateLimitKeyByCpf);
            $this->logFailedAttempt($request, $documentNumber);
            return response()->json([
                'message' => 'Dados não conferem.',
                'error' => 'validation_failed',
            ], 400);
        }

        Cache::forget($rateLimitKeyByIp);
        Cache::forget($rateLimitKeyByCpf);

        $resetToken = Str::random(64);
        $cacheKey = self::CACHE_PREFIX . $resetToken;
        Cache::put($cacheKey, $user->id, self::RESET_TOKEN_TTL_SECONDS);

        Log::info('Password validate-reset: success', [
            'user_id' => $user->id,
            'document_number_hash' => hash('sha256', $documentNumber),
        ]);

        return response()->json([
            'message' => 'Dados validados. Defina sua nova senha.',
            'reset_token' => $resetToken,
            'expires_in' => self::RESET_TOKEN_TTL_SECONDS,
        ]);
    }

    /**
     * POST /api/password/reset-confirm
     * Atualiza a senha usando o reset_token.
     */
    public function resetConfirm(Request $request): JsonResponse
    {
        $request->validate([
            'reset_token' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $cacheKey = self::CACHE_PREFIX . $request->reset_token;
        $userId = Cache::get($cacheKey);

        if (!$userId) {
            return response()->json([
                'message' => 'Link expirado ou inválido. Solicite novamente a redefinição.',
                'error' => 'invalid_or_expired_token',
            ], 400);
        }

        $user = User::find($userId);
        if (!$user) {
            Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Link expirado ou inválido. Solicite novamente a redefinição.',
                'error' => 'invalid_or_expired_token',
            ], 400);
        }

        $user->password = Hash::make($request->password);
        $user->save();
        Cache::forget($cacheKey);

        Log::info('Password reset-confirm: success', ['user_id' => $user->id]);

        return response()->json([
            'message' => 'Senha alterada com sucesso. Faça login.',
        ]);
    }

    private function incrementAttempts(string $keyByIp, string $keyByCpf): void
    {
        $ttl = self::RATE_LIMIT_DECAY_MINUTES * 60;
        $attemptsIp = (int) Cache::get($keyByIp, 0);
        $attemptsCpf = (int) Cache::get($keyByCpf, 0);
        Cache::put($keyByIp, $attemptsIp + 1, $ttl);
        Cache::put($keyByCpf, $attemptsCpf + 1, $ttl);
    }

    private function logFailedAttempt(Request $request, string $documentNumber): void
    {
        Log::warning('Password validate-reset: failed attempt', [
            'ip' => $request->ip(),
            'document_number_hash' => hash('sha256', $documentNumber),
        ]);
    }
}
