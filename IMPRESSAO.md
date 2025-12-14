# 🖨️ Guia de Instalação Presencial - Sistema de Impressão

**Sistema:** Adega GS - Print Bridge  
**Data:** _______________  
**Cliente:** _______________  
**Técnico:** _______________

---

## 📋 Checklist de Instalação

### ✅ 1. Pré-requisitos (Levar em Pen Drive ou Baixar)

Antes de iniciar, certifique-se de ter os seguintes arquivos:

- [ ] **Driver da Impressora:** POS-80C (ou driver genérico POS-80)
- [ ] **Instalador .NET:** .NET Desktop Runtime 9.0 (x64)
  - Download: https://dotnet.microsoft.com/download/dotnet/9.0
- [ ] **NSSM (Non-Sucking Service Manager):** Executável portável
  - Download: https://nssm.cc/download
- [ ] **Arquivos do PrintBridge:** Pasta `publish` gerada pelo build do projeto .NET

---

### ✅ 2. Instalação de Hardware

#### 2.1. Conectar Impressora
- [ ] Conectar a impressora térmica via USB ao computador
- [ ] Aguardar o Windows detectar o dispositivo

#### 2.2. Instalar Driver
- [ ] Executar o instalador do driver da impressora
- [ ] Seguir o assistente de instalação
- [ ] Aguardar conclusão da instalação

#### 2.3. Teste de Impressão (⚠️ CRUCIAL)
- [ ] Abrir **Painel de Controle** → **Dispositivos e Impressoras**
- [ ] Clicar com botão direito na impressora instalada
- [ ] Selecionar **Propriedades da Impressora**
- [ ] Clicar em **Imprimir Página de Teste**
- [ ] **Verificar se a impressão funcionou corretamente**

#### 2.4. Anotar Nome Exato da Impressora
- [ ] No Painel de Controle, anotar o **nome exato** da impressora
- [ ] Exemplos: `POS-80C`, `Printer_001`, `POS-80C (USB)`
- [ ] ⚠️ **IMPORTANTE:** O nome deve ser exatamente como aparece no Windows
- [ ] Anotar aqui: `___________________________`

---

### ✅ 3. Instalação do .NET Runtime

- [ ] Executar o instalador do **.NET Desktop Runtime 9.0 (x64)**
- [ ] Aceitar os termos e concluir a instalação
- [ ] Verificar instalação: Abrir CMD e executar:
  ```cmd
  dotnet --version
  ```
- [ ] Deve retornar: `9.0.x` ou superior

---

### ✅ 4. Configuração do Print Bridge

#### 4.1. Criar Estrutura de Pastas
- [ ] Criar pasta: `C:\SistemaAdega\PrintBridge`
- [ ] Copiar todos os arquivos da pasta `publish` para `C:\SistemaAdega\PrintBridge`

#### 4.2. Configurar appsettings.json
- [ ] Abrir o arquivo `C:\SistemaAdega\PrintBridge\appsettings.json` no Bloco de Notas
- [ ] Localizar a seção `"Printer"`
- [ ] Alterar o valor de `"Name"` para o nome exato anotado no passo 2.4
- [ ] Exemplo:
  ```json
  {
    "Logging": {
      "LogLevel": {
        "Default": "Information"
      }
    },
    "Printer": {
      "Name": "POS-80C"
    }
  }
  ```
- [ ] Salvar o arquivo

---

### ✅ 5. Instalação do Serviço Windows (NSSM)

#### 5.1. Preparar NSSM
- [ ] Copiar o executável `nssm.exe` para uma pasta temporária (ex: `C:\temp\`)
- [ ] Abrir **CMD como Administrador**:
  - Pressionar `Win + X`
  - Selecionar **Terminal (Admin)** ou **Prompt de Comando (Admin)**

#### 5.2. Executar Comandos de Instalação

Execute os comandos abaixo **na ordem**, um por vez:

```cmd
cd C:\temp
```

```cmd
nssm install AdegaPrintBridge "C:\SistemaAdega\PrintBridge\PrintBridge.exe"
```

```cmd
nssm set AdegaPrintBridge AppDirectory "C:\SistemaAdega\PrintBridge"
```

```cmd
nssm set AdegaPrintBridge AppStdout "C:\SistemaAdega\PrintBridge\log_out.txt"
```

```cmd
nssm set AdegaPrintBridge AppStderr "C:\SistemaAdega\PrintBridge\log_err.txt"
```

```cmd
nssm set AdegaPrintBridge AppExit Default Restart
```

```cmd
nssm start AdegaPrintBridge
```

#### 5.3. Verificar Instalação do Serviço
- [ ] Abrir **Gerenciador de Tarefas** (Ctrl + Shift + Esc)
- [ ] Ir na aba **Serviços**
- [ ] Procurar por `AdegaPrintBridge`
- [ ] Verificar se o status está como **Em execução**

---

### ✅ 6. Configuração do Navegador (Chrome/Edge)

#### 6.1. Entender o Problema
O sistema web roda em HTTPS (`https://adegags.com.br`), mas o Print Bridge roda em HTTP local (`http://localhost:9000`). Isso causa um erro de **Mixed Content**.

#### 6.2. Habilitar Localhost Inseguro (Chrome)
- [ ] Abrir o Chrome
- [ ] Na barra de endereços, digitar: `chrome://flags/#allow-insecure-localhost`
- [ ] Pressionar Enter
- [ ] Localizar a opção: **"Allow insecure localhost"**
- [ ] Alterar de **Default** para **Enabled**
- [ ] Clicar em **Relaunch** (ou fechar e reabrir o navegador)

#### 6.3. Habilitar Localhost Inseguro (Edge)
- [ ] Abrir o Edge
- [ ] Na barra de endereços, digitar: `edge://flags/#allow-insecure-localhost`
- [ ] Pressionar Enter
- [ ] Localizar a opção: **"Allow insecure localhost"**
- [ ] Alterar de **Default** para **Enabled**
- [ ] Clicar em **Relaunch** (ou fechar e reabrir o navegador)

---

### ✅ 7. Validação Final

#### 7.1. Teste do Serviço
- [ ] Abrir o navegador
- [ ] Acessar: `http://localhost:9000/health`
- [ ] Deve retornar JSON: `{"status":"online","timestamp":"..."}`
- [ ] Se retornar 404, o serviço está rodando (endpoint `/health` pode não existir)
- [ ] Se der erro de conexão, verificar se o serviço está rodando

#### 7.2. Teste de Impressão Real
- [ ] Acessar o sistema: `https://adegags.com.br`
- [ ] Fazer login no sistema
- [ ] Abrir o **Console do Navegador** (F12 → Console)
- [ ] Realizar um pedido de teste
- [ ] Verificar no console se há erros
- [ ] Verificar se a impressão foi executada na impressora física

#### 7.3. Verificar Logs (Se Necessário)
- [ ] Abrir os arquivos de log:
  - `C:\SistemaAdega\PrintBridge\log_out.txt`
  - `C:\SistemaAdega\PrintBridge\log_err.txt`
- [ ] Verificar se há mensagens de erro

---

## 🔧 Comandos Úteis para Manutenção

### Parar o Serviço
```cmd
nssm stop AdegaPrintBridge
```

### Iniciar o Serviço
```cmd
nssm start AdegaPrintBridge
```

### Reiniciar o Serviço
```cmd
nssm restart AdegaPrintBridge
```

### Desinstalar o Serviço
```cmd
nssm remove AdegaPrintBridge confirm
```

### Ver Status do Serviço
```cmd
nssm status AdegaPrintBridge
```

---

## ⚠️ Troubleshooting

### Problema: Serviço não inicia
- Verificar se o .NET Runtime está instalado
- Verificar se o caminho do executável está correto
- Verificar os logs em `log_err.txt`

### Problema: Impressora não encontrada
- Verificar se o nome no `appsettings.json` está exatamente igual ao do Windows
- Verificar se a impressora está instalada e funcionando
- Testar impressão de página de teste novamente

### Problema: Erro de Mixed Content no navegador
- Verificar se a flag `allow-insecure-localhost` está habilitada
- Reiniciar o navegador completamente
- Limpar cache do navegador

### Problema: Erro de conexão (ERR_CONNECTION_REFUSED)
- Verificar se o serviço está rodando (Gerenciador de Tarefas)
- Verificar se a porta 9000 não está bloqueada pelo firewall
- Verificar os logs do serviço

---

## 📝 Notas Finais

- [ ] Documentar nome exato da impressora: `___________________________`
- [ ] Documentar data de instalação: `___________________________`
- [ ] Documentar versão do .NET instalada: `___________________________`
- [ ] Testar impressão de pelo menos 2 pedidos diferentes
- [ ] Orientar o cliente sobre como reiniciar o serviço se necessário

---

**Instalação concluída por:** _______________  
**Data:** _______________  
**Assinatura do Cliente:** _______________

