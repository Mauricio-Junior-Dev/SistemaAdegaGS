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
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins(
            "http://localhost:4200",
            "http://127.0.0.1:4200"
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// Registrar serviços
builder.Services.AddScoped<PrinterService>();

var app = builder.Build();

// Configurar pipeline
app.UseCors("AllowAngularApp");

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
app.Urls.Add($"http://localhost:{port}");

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation($"Print Bridge iniciado e escutando em http://localhost:{port}");
logger.LogInformation("Pressione Ctrl+C para parar o serviço");

app.Run();
