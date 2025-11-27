# Projeto Adega

Sistema completo de e-commerce e PDV com API Laravel, frontend Angular e serviço de impressão térmica automática via Print Bridge (C#).

## 🛠️ Arquitetura e Tecnologias

- **Backend**: Laravel (API REST)
- **Frontend**: Angular
- **Serviço de Impressão**: C# .NET Worker Service (Print Bridge)
- **Banco de Dados**: MariaDB / MySQL

## 🚀 Guia de Setup Rápido (Nova Máquina)

Siga esta ordem exata para configurar o ambiente de desenvolvimento sem erros.

### Pré-requisitos

- PHP 8.2+ e Composer
- Node.js v20+ e NPM
- .NET SDK 9.0+ (ou superior)
- MariaDB/MySQL

### 1. Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
# Configure o banco de dados no arquivo .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve
```

### 2. Frontend (Angular)

⚠️ **Importante**: Devido a conflitos de versão em bibliotecas externas (QRCode), é obrigatório usar a flag `--legacy-peer-deps`.

```bash
cd frontend
# Instalação segura
npm install --legacy-peer-deps
# Rodar projeto
ng serve
```

### 3. Impressão (.NET PrintBridge)

Necessário para a impressão automática funcionar no Windows (Lojista).

Instale o .NET SDK 9.0 (ou superior) no site da Microsoft.

Execute o serviço:

```bash
cd print-bridge
dotnet run
```

O serviço rodará em `http://localhost:9000`.

## 🛠️ Resolução de Problemas Comuns (Troubleshooting)

### ❌ Erro: "npm ERESOLVE unable to resolve dependency tree"

Acontece porque algumas libs pedem Angular 20+, mas o projeto usa a versão estável 19. **Solução**: Nunca rode apenas `npm install`. Sempre use `npm install --legacy-peer-deps`.

### ❌ Erro: Imagens quebradas (404) no Backend

O link simbólico do Windows costuma quebrar ao mover a pasta do projeto ou trocar de PC. **Solução**:

1. Vá na pasta `backend/public` e delete o arquivo/atalho chamado `storage`.
2. Rode no terminal (como Admin se possível):

```bash
php artisan storage:link
```

Se persistir, limpe o cache: `php artisan config:clear`.

### ❌ Erro: "dotnet run" falha ou pede versão específica

**Solução**: Baixe o SDK mais recente no site da Microsoft. Se der erro de versão, edite o arquivo `print-bridge/PrintBridge.csproj` e altere a tag `<TargetFramework>` para a versão instalada na sua máquina (ex: `net8.0` ou `net10.0`).

### ❌ Erro: 404 ou 403 ao acessar rotas da API

Geralmente é cache de rotas antigo após um git pull. **Solução**:

```bash
php artisan route:clear
php artisan config:clear
```

## 📦 Implantação em Produção

### Backend (Laravel) e Frontend (Angular)

O deploy do Backend e Frontend seguem os padrões normais de hospedagem web:

- **Backend**: Deploy do Laravel em servidor PHP (ex: Hostinger, Forge, etc.)
- **Frontend**: Build com `ng build --configuration=production` e deploy dos arquivos estáticos

### Print Bridge (Instalando como Serviço do Windows)

Na máquina do funcionário (que tem a impressora **POS-80C** conectada via USB), o Print Bridge deve ser instalado como um **Serviço do Windows** para iniciar automaticamente.

#### 1. Publicar o Executável

Na sua máquina de desenvolvimento, gere os arquivos de produção:

```bash
# Navegue até a pasta
cd adega/print-bridge

# Publique (criará uma pasta em bin/Release/net8.0/win-x64/publish)
dotnet publish -c Release -r win-x64 --self-contained true
```

#### 2. Instalar na Máquina do Cliente (Funcionário)

Copie a pasta `publish` inteira para a máquina do funcionário (ex: `C:\Program Files\PrintBridge`).

#### 3. Registrar o Serviço

Abra o **CMD como Administrador** na máquina do funcionário e execute:

```cmd
# 1. Crie o serviço (aponte o binPath para o .exe)
sc create "AdegaPrintBridge" binPath="C:\Program Files\PrintBridge\PrintBridge.exe"

# 2. Configure para iniciar automaticamente
sc config "AdegaPrintBridge" start=auto

# 3. Inicie o serviço
sc start "AdegaPrintBridge"
```

#### 4. Verificar Status do Serviço

```cmd
# Ver status
sc query "AdegaPrintBridge"

# Parar serviço (se necessário)
sc stop "AdegaPrintBridge"

# Remover serviço (se necessário)
sc delete "AdegaPrintBridge"
```

Com isso, o serviço de impressão rodará **24/7** em `http://localhost:9000` naquela máquina, permitindo impressão automática de pedidos.

## 📋 Configuração da Impressora

O Print Bridge procura automaticamente pela impressora **POS-80C** instalada no Windows. Se sua impressora tiver outro nome, edite o arquivo `print-bridge/Services/PrinterService.cs`:

```csharp
private readonly string _printerName = "POS-80C"; // Altere para o nome da sua impressora
```

## 🔍 Verificação e Troubleshooting

### Verificar se o Print Bridge está rodando

```bash
# No navegador ou via curl
curl http://localhost:9000/health
# Deve retornar: {"status":"online","timestamp":"..."}
```

### Verificar se a impressora está instalada (Windows)

```powershell
Get-Printer | Where-Object { $_.Name -like "*POS-80C*" }
```

### Logs do Print Bridge

Os logs do serviço são exibidos no console (modo desenvolvimento) ou nos logs do Windows Event Viewer (modo serviço).

## 📞 Suporte

Para problemas específicos, verifique:

1. **Logs do Laravel**: `backend/storage/logs/laravel.log`
2. **Console do Print Bridge**: Verifique se está recebendo requisições
3. **Status da Impressora**: Verifique se está online e instalada no Windows
4. **Firewall**: Certifique-se de que a porta 9000 está acessível localmente

---

**Última atualização**: Janeiro 2025
