using System.Text;
using PrintBridge;
using PrintBridge.DTOs;
using PrintBridge.Services;

// Registrar provider de codepages para suportar encodings como IBM860
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

var builder = WebApplication.CreateBuilder(args);

// Configurar como Windows Service
builder.Host.UseWindowsService();

// Configurar serviços
builder.Services.AddCors(options =>
{
    // Política permissiva para desenvolvimento/local (aceita localhost e IPs de rede)
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(origin => true) // Aceita qualquer origem (localhost e IPs de rede)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Registrar serviços
builder.Services.AddScoped<PrinterService>();

var app = builder.Build();

// Configurar pipeline
app.UseCors("AllowAll");

// Endpoint de impressão
app.MapPost("/print", (OrderDto order, PrinterService printerService, ILogger<Program> logger) =>
{
    try
    {
        logger.LogInformation("=== TRABALHO DE IMPRESSÃO RECEBIDO ===");
        logger.LogInformation($"Pedido: #{order.OrderNumber}, Total: {order.Total}");
        
        // Validar pedido
        if (string.IsNullOrEmpty(order.OrderNumber))
        {
            logger.LogWarning("Pedido sem número de pedido");
            return Results.BadRequest(new { success = false, message = "Número do pedido é obrigatório" });
        }

        // Imprimir
        bool success = printerService.PrintOrder(order);

        if (success)
        {
            logger.LogInformation($"Pedido #{order.OrderNumber} impresso com sucesso");
            return Results.Ok(new { 
                success = true, 
                message = $"Pedido #{order.OrderNumber} enviado para impressão com sucesso" 
            });
        }
        else
        {
            logger.LogError($"Falha ao imprimir pedido #{order.OrderNumber}");
            return Results.Problem(
                detail: "Não foi possível imprimir o pedido. Verifique se a impressora está conectada e configurada.",
                statusCode: 500,
                title: "Erro ao imprimir"
            );
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Erro ao processar trabalho de impressão");
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500,
            title: "Erro ao processar impressão"
        );
    }
});

// Endpoint de health check
app.MapGet("/health", () => Results.Ok(new { status = "online", timestamp = DateTime.UtcNow }));

var port = 9000;
// Escutar em todas as interfaces de rede (0.0.0.0) para aceitar conexões de IPs locais
app.Urls.Add($"http://0.0.0.0:{port}");

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation($"Print Bridge iniciado e escutando em http://0.0.0.0:{port} (aceita conexões de qualquer IP da rede local)");
logger.LogInformation("Pressione Ctrl+C para parar o serviço");

app.Run();
