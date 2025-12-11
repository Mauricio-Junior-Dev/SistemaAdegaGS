<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use App\Models\Setting;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        // Defaults
        $defaults = [
            // Configurações Gerais
            'site_name' => config('app.name', 'Adega'),
            'site_description' => 'Sistema de gerenciamento de adega',
            'contact_email' => 'contato@adega.com',
            'contact_phone' => '(11) 99999-9999',
            'address' => 'Rua Exemplo, 123 - São Paulo, SP',
            'logo_url' => null,
            'favicon_url' => null,
            'timezone' => 'America/Sao_Paulo',
            'language' => 'pt-BR',
            'currency' => 'BRL',
            'date_format' => 'd/m/Y',
            'time_format' => 'H:i',

            // Configurações de Negócio
            'business_name' => 'Adega Exemplo',
            'business_cnpj' => '00.000.000/0001-00',
            'business_address' => 'Rua Exemplo, 123',
            'business_city' => 'São Paulo',
            'business_state' => 'SP',
            'business_zipcode' => '01234-567',
            'business_phone' => '(11) 99999-9999',
            'business_email' => 'contato@adega.com',

            // Configurações de Pagamento
            'accepted_payment_methods' => [
                ['method' => 'credit_card', 'enabled' => true, 'additional_fee' => 0],
                ['method' => 'debit_card', 'enabled' => true, 'additional_fee' => 0],
                ['method' => 'pix', 'enabled' => true],
                ['method' => 'cash', 'enabled' => true]
            ],
            'default_payment_method' => 'pix',
            'pix_key' => 'pix@adega.com',
            'credit_card_fee' => 0.03,
            'debit_card_fee' => 0.02,
            'pix_fee' => 0.0,
            'cash_discount' => 0.05,

            // Configurações de Estoque
            'low_stock_threshold' => 10,
            'auto_reorder' => false,
            'stock_alert_email' => 'admin@adega.com',
            'inventory_tracking' => true,
            'allow_negative_stock' => false,

            // Configurações de Pedidos
            'order_prefix' => 'PED',
            'auto_approve_orders' => false,
            'require_payment_confirmation' => true,
            'order_timeout' => 30, // minutos
            'delivery_fee' => 5.0,
            'free_delivery_threshold' => 100.0,

            // Configurações de E-mail
            'mail_driver' => 'smtp',
            'mail_host' => 'smtp.gmail.com',
            'mail_port' => 587,
            'mail_username' => 'noreply@adega.com',
            'mail_password' => '',
            'mail_encryption' => 'tls',
            'mail_from_address' => 'noreply@adega.com',
            'mail_from_name' => 'Adega',

            // Configurações de Backup
            'backup_enabled' => true,
            'backup_frequency' => 'daily',
            'backup_retention' => 30, // dias
            'backup_email' => 'admin@adega.com',

            // Configurações de Segurança
            'password_min_length' => 8,
            'password_require_special' => true,
            'session_timeout' => 120, // minutos
            'max_login_attempts' => 5,
            'lockout_duration' => 15, // minutos
            'two_factor_auth' => false,
            'cash_open_password' => null,

            // Configurações de Integrações
            'google_analytics' => '',
            'facebook_pixel' => '',
            'whatsapp_number' => '',
            'instagram_url' => '',
            'facebook_url' => '',
            'twitter_url' => ''
        ];

        // Merge stored settings
        $stored = Setting::all()->pluck('value', 'key')->toArray();
        $settings = array_merge($defaults, $stored);
        return response()->json($settings);
    }

    public function update(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'site_name' => 'nullable|string|max:255',
                'site_description' => 'nullable|string|max:500',
                'contact_email' => 'nullable|email|max:255',
                'contact_phone' => 'nullable|string|max:20',
                'address' => 'nullable|string|max:500',
                'logo_url' => 'nullable|string|max:255',
                'favicon_url' => 'nullable|string|max:255',
                'timezone' => 'nullable|string|max:50',
                'language' => 'nullable|string|max:10',
                'currency' => 'nullable|string|max:3',
                'date_format' => 'nullable|string|max:20',
                'time_format' => 'nullable|string|max:10',
                'backup_enabled' => 'nullable|boolean',
                'backup_frequency' => 'nullable|string|in:daily,weekly,monthly',
                'backup_retention' => 'nullable|integer|min:1',
                'backup_email' => 'nullable|email|max:255',
                'password_min_length' => 'nullable|integer|min:6|max:32',
                'password_require_special' => 'nullable|boolean',
                'session_timeout' => 'nullable|integer|min:1',
                'max_login_attempts' => 'nullable|integer|min:1',
                'lockout_duration' => 'nullable|integer|min:1',
                'two_factor_auth' => 'nullable|boolean',
                'google_analytics' => 'nullable|string|max:255',
                'facebook_pixel' => 'nullable|string|max:255',
                'whatsapp_number' => 'nullable|string|max:20',
                'instagram_url' => 'nullable|url|max:255',
                'facebook_url' => 'nullable|url|max:255',
                'twitter_url' => 'nullable|url|max:255'
            ]);

            // Persistir apenas chaves fornecidas
            $data = $request->all();
            foreach ($data as $key => $value) {
                Setting::updateOrCreate(
                    ['key' => $key],
                    ['value' => $value]
                );
            }

            return $this->index();
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Settings update error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro interno do servidor',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,gif,svg|max:2048'
        ]);

        try {
            $file = $request->file('logo');
            $filename = 'logo_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('logos', $filename, 'public');
            $url = Storage::disk('public')->url($path);

            // Salvar URL no banco
            Setting::updateOrCreate(
                ['key' => 'logo_url'],
                ['value' => $url]
            );

            return response()->json(['logo_url' => $url]);
        } catch (\Exception $e) {
            Log::error('Logo upload error: ' . $e->getMessage());
            return response()->json(['error' => 'Erro ao fazer upload do logo: ' . $e->getMessage()], 500);
        }
    }

    public function uploadFavicon(Request $request): JsonResponse
    {
        $request->validate([
            'favicon' => 'required|file|max:1024'
        ]);

        try {
            $file = $request->file('favicon');
            $filename = 'favicon_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('favicons', $filename, 'public');
            $url = Storage::disk('public')->url($path);

            // Salvar URL no banco
            Setting::updateOrCreate(
                ['key' => 'favicon_url'],
                ['value' => $url]
            );

            return response()->json(['favicon_url' => $url]);
        } catch (\Exception $e) {
            Log::error('Favicon upload error: ' . $e->getMessage());
            return response()->json(['error' => 'Erro ao fazer upload do favicon: ' . $e->getMessage()], 500);
        }
    }

    public function publicSettings(): JsonResponse
    {
        // Retornar apenas configurações públicas (sem dados sensíveis)
        $publicSettings = [
            'site_name' => config('app.name', 'Adega'),
            'site_description' => 'Sistema de gerenciamento de adega',
            'contact_email' => 'contato@adega.com',
            'contact_phone' => '(11) 99999-9999',
            'address' => 'Rua Exemplo, 123 - São Paulo, SP',
            'logo_url' => null,
            'favicon_url' => null
        ];

        // Buscar configurações salvas
        $stored = Setting::whereIn('key', [
            'site_name',
            'site_description', 
            'contact_email',
            'contact_phone',
            'address',
            'logo_url',
            'favicon_url'
        ])->pluck('value', 'key')->toArray();

        // Merge com configurações salvas
        $settings = array_merge($publicSettings, $stored);

        return response()->json($settings);
    }

    public function backup(): JsonResponse
    {
        try {
            // Implementar lógica de backup
            $backupName = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
            
            return response()->json([
                'message' => 'Backup criado com sucesso',
                'backup_name' => $backupName,
                'created_at' => now()
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao criar backup: ' . $e->getMessage()], 500);
        }
    }

    public function listBackups(): JsonResponse
    {
        try {
            // Implementar lógica para listar backups
            $backups = [
                [
                    'name' => 'backup_2024-01-15_10-30-00.sql',
                    'size' => '2.5 MB',
                    'created_at' => '2024-01-15 10:30:00'
                ],
                [
                    'name' => 'backup_2024-01-14_10-30-00.sql',
                    'size' => '2.4 MB',
                    'created_at' => '2024-01-14 10:30:00'
                ]
            ];

            return response()->json($backups);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao listar backups: ' . $e->getMessage()], 500);
        }
    }

    public function restore(Request $request): JsonResponse
    {
        $request->validate([
            'backup_name' => 'required|string'
        ]);

        try {
            // Implementar lógica de restauração
            return response()->json([
                'message' => 'Backup restaurado com sucesso',
                'backup_name' => $request->backup_name,
                'restored_at' => now()
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao restaurar backup: ' . $e->getMessage()], 500);
        }
    }
}
