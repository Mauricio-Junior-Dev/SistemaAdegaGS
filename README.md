# Projeto Adega

Sistema completo de e-commerce e PDV com API Laravel, frontend Angular e serviço de impressão térmica automática via Print Bridge (C#).

## 🛠️ Arquitetura e Tecnologias

- **Backend**: Laravel (API REST)
- **Frontend**: Angular
- **Serviço de Impressão**: C# .NET Worker Service (Print Bridge)
- **Banco de Dados**: MariaDB / MySQL

## 🖥️ Configuração do Ambiente de Desenvolvimento

### Pré-requisitos

- PHP 8.2+ e Composer
- Node.js v20+ e NPM
- .NET SDK 8.0+
- MariaDB/MySQL

### 1. Configurar Backend (Laravel)

```bash
# 1. Clone o repositório
git clone ...
cd adega/backend

# 2. Instale dependências
composer install

# 3. Configure o .env
cp .env.example .env
# (Edite o .env e configure a conexão com o banco de dados: DB_DATABASE, DB_USERNAME, DB_PASSWORD)

# 4. Gere a chave e rode as migrações
php artisan key:generate
php artisan migrate --seed
```

### 2. Configurar Frontend (Angular)

```bash
# 1. Navegue até a pasta do frontend
cd ../frontend

# 2. Instale dependências
npm install
```

### 3. Configurar Print Bridge (C#)

```bash
# 1. Navegue até a pasta do bridge
cd ../print-bridge

# 2. Restaure as dependências do .NET
dotnet restore
```

## 🏃‍♂️ Executando o Sistema (Modo de Desenvolvimento)

Para rodar o sistema completo, você precisará de **3 terminais abertos simultaneamente**.

### Terminal 1: Backend (API Laravel)

```bash
cd adega/backend
php artisan serve
# (Rodando em http://localhost:8000)
```

### Terminal 2: Frontend (Angular)

```bash
cd adega/frontend
ng serve --open
# (Rodando em http://localhost:4200)
```

### Terminal 3: Serviço de Impressão (Print Bridge)

```bash
cd adega/print-bridge
dotnet run
# (Obrigatório para impressão térmica)
# (Rodando e escutando em http://localhost:9000)
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
