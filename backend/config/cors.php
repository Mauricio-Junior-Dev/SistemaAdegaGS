<?php

// Obter domínios do .env e garantir que sejam um array válido
$statefulDomains = env('SANCTUM_STATEFUL_DOMAINS', 'http://localhost:4200');
$allowedOrigins = array_filter(
    array_map('trim', explode(',', $statefulDomains)),
    fn($domain) => !empty($domain)
);

// Se não houver domínios configurados, usar padrão
if (empty($allowedOrigins)) {
    $allowedOrigins = ['http://localhost:4200'];
}

return [
    'paths' => ['*', 'api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $allowedOrigins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];