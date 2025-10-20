# ADEGA GS - Sistema Completo de Gestão e E-commerce

Sistema completo para gerenciamento de adega com:
- 🛒 **E-commerce** moderno (interface inspirada no Zé Delivery)
- 👨‍💼 **Painel Administrativo** completo com relatórios em tempo real
- 👷‍♂️ **Painel do Funcionário** (POS - Ponto de Venda)
- 📊 **Dashboard** com métricas e gráficos integrados
- 💰 **Controle de Caixa** integrado
- 📦 **Gestão de Estoque** em tempo real
- 📋 **Sistema de Pedidos** completo

## 🚀 Deploy em Servidor de Produção

## 🐳 Deploy com Docker (Recomendado)

### Docker Compose para Produção

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Backend Laravel
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: adega-backend
    restart: unless-stopped
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
      - DB_HOST=mysql
      - DB_DATABASE=adega_gs_prod
      - DB_USERNAME=adega_user
      - DB_PASSWORD=senha_super_segura_aqui
      - REDIS_HOST=redis
    volumes:
      - ./backend:/var/www/html
      - backend_storage:/var/www/html/storage
    depends_on:
      - mysql
      - redis
    networks:
      - adega-network

  # Frontend Angular
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: adega-frontend
    restart: unless-stopped
    environment:
      - API_URL=https://seudominio.com/api
      - GOOGLE_CLIENT_ID=SEU_GOOGLE_CLIENT_ID_AQUI
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - adega-network

  # Nginx
  nginx:
    image: nginx:alpine
    container_name: adega-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./frontend/dist:/var/www/html
      - ./backend/public:/var/www/html/api
    depends_on:
      - frontend
      - backend
    networks:
      - adega-network

  # MySQL
  mysql:
    image: mysql:8.0
    container_name: adega-mysql
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=root_password_super_segura
      - MYSQL_DATABASE=adega_gs_prod
      - MYSQL_USER=adega_user
      - MYSQL_PASSWORD=senha_super_segura_aqui
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - adega-network

  # Redis
  redis:
    image: redis:alpine
    container_name: adega-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - adega-network

volumes:
  mysql_data:
  redis_data:
  backend_storage:

networks:
  adega-network:
    driver: bridge
```

### Dockerfile do Backend

```dockerfile
# backend/Dockerfile
FROM php:8.1-fpm-alpine

# Instalar dependências
RUN apk add --no-cache \
    nginx \
    mysql-client \
    nodejs \
    npm \
    git \
    unzip

# Instalar extensões PHP
RUN docker-php-ext-install pdo pdo_mysql

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Configurar diretório de trabalho
WORKDIR /var/www/html

# Copiar arquivos
COPY . .

# Instalar dependências
RUN composer install --no-dev --optimize-autoloader

# Configurar permissões
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

EXPOSE 9000
CMD ["php-fpm"]
```

### Dockerfile do Frontend

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código
COPY . .

# Build para produção
RUN npm run build --configuration=production

# Servir arquivos estáticos
FROM nginx:alpine
COPY --from=0 /app/dist/adega /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Comandos para Deploy com Docker

```bash
# 1. Clonar repositório
git clone https://github.com/seu-usuario/adega.git
cd adega

# 2. Configurar variáveis de ambiente
cp .env.example .env
nano .env

# 3. Configurar Google OAuth
# Editar frontend/src/environments/environment.prod.ts
# Adicionar seu Google Client ID

# 4. Build e deploy
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Executar migrações
docker-compose -f docker-compose.prod.yml exec backend php artisan migrate --force

# 6. Configurar permissões
docker-compose -f docker-compose.prod.yml exec backend chown -R www-data:www-data storage
docker-compose -f docker-compose.prod.yml exec backend chmod -R 775 storage

# 7. Verificar status
docker-compose -f docker-compose.prod.yml ps
```

### Configuração do Nginx para Docker

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Frontend (Angular)
    server {
        listen 80;
        server_name seudominio.com www.seudominio.com;
        root /var/www/html;
        index index.html;

        # Frontend
        location / {
            try_files $uri $uri/ /index.html;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Backend API
        location /api {
            proxy_pass http://backend:9000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Storage
        location /storage {
            alias /var/www/html/api/storage;
            expires 1y;
            add_header Cache-Control "public";
        }
    }
}
```

## 🚀 Deploy Tradicional (Sem Docker)

### Requisitos do Servidor

- **PHP**: 8.1+ com extensões: OpenSSL, PDO, Mbstring, Tokenizer, XML, Ctype, JSON, BCMath, Fileinfo, GD
- **MySQL**: 8.0+ ou MariaDB 10.3+
- **Node.js**: 18+ (para build do frontend)
- **Nginx/Apache**: Para servir os arquivos
- **SSL**: Certificado HTTPS obrigatório
- **Composer**: 2.x
- **Git**: Para clonar o repositório

### 1. Preparação do Servidor

```bash
# Atualizar sistema (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install nginx mysql-server php8.1-fpm php8.1-mysql php8.1-xml php8.1-gd php8.1-curl php8.1-mbstring php8.1-zip php8.1-bcmath php8.1-intl composer git nodejs npm -y

# Configurar MySQL
sudo mysql_secure_installation
```

### 2. Configuração do Banco de Dados

```sql
-- Conectar ao MySQL
mysql -u root -p

-- Criar banco de dados
CREATE DATABASE adega_gs_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário específico (recomendado)
CREATE USER 'adega_user'@'localhost' IDENTIFIED BY 'senha_super_segura_aqui';
GRANT ALL PRIVILEGES ON adega_gs_prod.* TO 'adega_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Deploy do Backend (Laravel)

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/adega.git
cd adega/backend

# 2. Instalar dependências de produção
composer install --no-dev --optimize-autoloader

# 3. Configurar ambiente
cp .env.example .env
nano .env
```

**Configuração do .env para produção:**

```env
APP_NAME="ADEGA GS"
APP_ENV=production
APP_KEY=base64:... (gerado automaticamente)
APP_DEBUG=false
APP_URL=https://seudominio.com

# Banco de dados de produção
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=adega_gs_prod
DB_USERNAME=adega_user
DB_PASSWORD=senha_super_segura_aqui

# CORS (domínio de produção)
SANCTUM_STATEFUL_DOMAINS=seudominio.com
SESSION_DOMAIN=seudominio.com

# Cache e sessão (Redis recomendado)
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

# Redis (se disponível)
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Mail (configurar SMTP)
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=seu-email@gmail.com
MAIL_PASSWORD=sua-senha-app
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@seudominio.com
MAIL_FROM_NAME="${APP_NAME}"
```

```bash
# 4. Configurar aplicação
php artisan key:generate
php artisan migrate --force
php artisan db:seed
php artisan storage:link

# 5. Otimizar para produção
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize

# 6. Configurar permissões
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

### 4. Deploy do Frontend (Angular)

```bash
# 1. Entrar na pasta frontend
cd ../frontend

# 2. Instalar dependências
npm ci --only=production

# 3. Configurar environment de produção
nano src/environments/environment.prod.ts
```

**Configuração do environment.prod.ts:**

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://seudominio.com/api',
  sanctumUrl: 'https://seudominio.com/sanctum',
  googleClientId: 'SEU_GOOGLE_CLIENT_ID_AQUI' // Substitua pelo seu Client ID do Google
};
```

```bash
# 4. Build para produção
ng build --configuration=production

# 5. Os arquivos estarão em dist/adega/
# Copiar para diretório web
sudo cp -r dist/adega/* /var/www/adega/frontend/
```

### 5. Configuração do Google OAuth para Produção

**IMPORTANTE**: Antes de fazer o deploy, configure o Google OAuth:

#### 5.1. Configurar Google Cloud Console

1. **Acesse** [Google Cloud Console](https://console.cloud.google.com/)
2. **Vá em** "APIs & Services" → "Credentials"
3. **Clique** no seu OAuth 2.0 Client ID existente
4. **Adicione** as seguintes origens autorizadas:

```
Origens JavaScript autorizadas:
- https://seudominio.com
- https://www.seudominio.com

URIs de redirecionamento autorizados:
- https://seudominio.com/login
- https://www.seudominio.com/login
```

#### 5.2. Ativar APIs Necessárias

No Google Cloud Console, ative as seguintes APIs:
- ✅ **Identity Toolkit API**
- ✅ **Identity and Access Management (IAM) API**
- ✅ **Google+ API** (se disponível)

#### 5.3. Configurar Environment de Produção

```bash
# No arquivo frontend/src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://seudominio.com/api',
  sanctumUrl: 'https://seudominio.com/sanctum',
  googleClientId: 'SEU_GOOGLE_CLIENT_ID_AQUI' // Substitua pelo seu Client ID
};
```

### 6. Configuração do Nginx

```bash
# Criar configuração do site
sudo nano /etc/nginx/sites-available/adega
```

**Configuração do Nginx:**

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;
    root /var/www/adega/backend/public;
    index index.php;

    # SSL (configurar certificado)
    ssl_certificate /etc/ssl/certs/seudominio.com.crt;
    ssl_certificate_key /etc/ssl/private/seudominio.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Frontend (Angular) - servir arquivos estáticos
    location / {
        try_files $uri $uri/ /index.html;
        root /var/www/adega/frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API
    location /api {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location /sanctum {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Storage (imagens)
    location /storage {
        alias /var/www/adega/backend/storage/app/public;
        expires 1y;
        add_header Cache-Control "public";
    }

    # PHP
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/adega /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Configuração de SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obter certificado SSL
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Renovação automática
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 8. Configuração de Backup

```bash
# Script de backup automático
sudo nano /usr/local/bin/backup-adega.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/adega"
DB_NAME="adega_gs_prod"
DB_USER="adega_user"
DB_PASS="senha_super_segura_aqui"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup do banco de dados
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/database_$DATE.sql

# Backup dos arquivos
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/adega

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
```

```bash
# Tornar executável
sudo chmod +x /usr/local/bin/backup-adega.sh

# Agendar backup diário
sudo crontab -e
# Adicionar: 0 2 * * * /usr/local/bin/backup-adega.sh
```

### 9. Monitoramento e Logs

```bash
# Verificar status dos serviços
sudo systemctl status nginx
sudo systemctl status mysql
sudo systemctl status php8.1-fpm

# Monitorar logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/www/adega/backend/storage/logs/laravel.log

# Verificar uso de recursos
htop
df -h
free -h
```

### 10. Configurações de Segurança

```bash
# Firewall
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw deny 3306   # MySQL (apenas local)

# Configurar fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Configurar rate limiting no Nginx
sudo nano /etc/nginx/conf.d/rate-limit.conf
```

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

# Aplicar nos locais apropriados
location /api/login {
    limit_req zone=login burst=3 nodelay;
    # ... resto da configuração
}

location /api {
    limit_req zone=api burst=20 nodelay;
    # ... resto da configuração
}
```

## 🔧 Comandos de Manutenção

### Atualização do Sistema

```bash
# 1. Backup antes de atualizar
sudo /usr/local/bin/backup-adega.sh

# 2. Atualizar código
cd /var/www/adega
git pull origin main

# 3. Atualizar backend
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 4. Atualizar frontend
cd ../frontend
npm ci --only=production
ng build --configuration=production
sudo cp -r dist/adega/* /var/www/adega/frontend/

# 5. Reiniciar serviços
sudo systemctl reload nginx
sudo systemctl restart php8.1-fpm
```

### Limpeza de Cache

```bash
cd /var/www/adega/backend
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan optimize
```

## 🔐 Configuração do Login com Google em Produção

### Passo a Passo Completo

#### 1. Configurar Google Cloud Console

```bash
# 1. Acesse https://console.cloud.google.com/
# 2. Vá em "APIs & Services" → "Credentials"
# 3. Clique no seu OAuth 2.0 Client ID
# 4. Configure as seguintes URLs:

Origens JavaScript autorizadas:
- https://seudominio.com
- https://www.seudominio.com

URIs de redirecionamento autorizados:
- https://seudominio.com/login
- https://www.seudominio.com/login
```

#### 2. Ativar APIs Necessárias

No Google Cloud Console, ative:
- ✅ **Identity Toolkit API**
- ✅ **Identity and Access Management (IAM) API**
- ✅ **Google+ API** (se disponível)

#### 3. Configurar Environment de Produção

```typescript
// frontend/src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://seudominio.com/api',
  sanctumUrl: 'https://seudominio.com/sanctum',
  googleClientId: 'SEU_GOOGLE_CLIENT_ID_AQUI' // Substitua pelo seu Client ID
};
```

#### 4. Testar Login Google

```bash
# 1. Acesse https://seudominio.com/login
# 2. Clique no botão "Entrar com Google"
# 3. Faça login com sua conta Google
# 4. Verifique se foi redirecionado corretamente
```

#### 5. Solução de Problemas

**Erro 403 no Console:**
- ✅ **Normal** - Não afeta o funcionamento
- ✅ **Login funciona** - Apenas verificação de status
- ✅ **Pode ignorar** - Erro cosmético

**Login não funciona:**
- ❌ Verificar se as URLs estão corretas no Google Console
- ❌ Verificar se as APIs estão ativadas
- ❌ Verificar se o Client ID está correto

## 👥 Usuários de Teste

Após o deploy, os seguintes usuários estarão disponíveis:

### 👨‍💼 Administrador
- **Email**: `admin@adegags.com`
- **Senha**: `12345678`
- **Acesso**: Painel administrativo completo

### 👷‍♂️ Funcionário
- **Email**: `funcionario@adegags.com`
- **Senha**: `12345678`
- **Acesso**: Painel do funcionário (caixa, pedidos, estoque)

### 👤 Cliente
- **Email**: `cliente1@example.com`
- **Senha**: `12345678`
- **Acesso**: E-commerce (loja)

## 📊 Comandos para Gráficos e Dashboard

### Instalação dos Pacotes de Gráficos

```bash
# 1. Navegar para o diretório frontend
cd frontend

# 2. Instalar dependências dos gráficos
npm install ng2-charts@5.0.3 chart.js@4.4.0

# 3. Verificar se as dependências foram instaladas
npm list ng2-charts chart.js
```

### Configuração dos Gráficos

```bash
# 1. Verificar se o ng2-charts está funcionando
ng build --configuration=development

# 2. Se houver erros, reinstalar as dependências
npm uninstall ng2-charts chart.js
npm install ng2-charts@5.0.3 chart.js@4.4.0

# 3. Limpar cache do Angular
ng cache clean
```

### Comandos para Dados de Teste

```bash
# 1. Navegar para o backend
cd backend

# 2. Executar seeder para criar dados de teste
php artisan db:seed --class=DashboardTestDataSeeder

# 3. Verificar se os dados foram criados
php artisan tinker --execute="echo 'Users: ' . App\Models\User::count(); echo 'Products: ' . App\Models\Product::count(); echo 'Orders: ' . App\Models\Order::count();"
```

### Testando o Dashboard

```bash
# 1. Iniciar o backend
cd backend
php artisan serve --host=127.0.0.1 --port=8000

# 2. Em outro terminal, iniciar o frontend
cd frontend
ng serve --host=0.0.0.0 --port=4200

# 3. Acessar o dashboard
# URL: http://localhost:4200/admin/dashboard
# Login: admin@adegags.com / password
```

### Solução de Problemas com Gráficos

```bash
# Se os gráficos não aparecem:

# 1. Verificar se as dependências estão corretas
npm list ng2-charts chart.js

# 2. Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install

# 3. Verificar se o BaseChartDirective está importado
# No arquivo dashboard.component.ts deve ter:
# import { NgChartsModule } from 'ng2-charts';

# 4. Verificar se o NgChartsModule está nos imports
# imports: [..., NgChartsModule]
```

### Comandos de Desenvolvimento

```bash
# Para desenvolvimento com hot reload
ng serve --host=0.0.0.0 --port=4200 --watch

# Para build de produção
ng build --configuration=production

# Para testar apenas o backend
cd backend
php artisan serve --host=127.0.0.1 --port=8000
curl http://localhost:8000/api/admin/dashboard/summary
```

## 🛠️ Tecnologias Utilizadas

- **Backend**: Laravel 10, MySQL, Redis (opcional)
- **Frontend**: Angular 17, Angular Material, Chart.js, ng2-charts
- **Gráficos**: Chart.js 4.4.0, ng2-charts 5.0.3
- **Servidor**: Nginx, PHP 8.1-FPM
- **SSL**: Let's Encrypt
- **Backup**: Scripts automatizados

## 📞 Suporte

Para problemas específicos de deploy, verifique:

1. **Logs do Nginx**: `/var/log/nginx/error.log`
2. **Logs do Laravel**: `/var/www/adega/backend/storage/logs/laravel.log`
3. **Status dos serviços**: `sudo systemctl status nginx mysql php8.1-fpm`
4. **Permissões**: `sudo chown -R www-data:www-data /var/www/adega`
5. **Configuração SSL**: `sudo certbot certificates`

---

**Última atualização**: Janeiro 2025