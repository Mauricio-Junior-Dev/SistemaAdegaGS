using System.Text.Json.Serialization;

namespace PrintBridge.DTOs;

/// <summary>
/// DTO para receber pedidos completos do frontend Angular
/// </summary>
public class OrderDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("order_number")]
    public string OrderNumber { get; set; } = string.Empty;

    [JsonPropertyName("total")]
    public string Total { get; set; } = "0";

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    /// <summary>
    /// Status financeiro do pagamento (ex: "pending", "completed", "paid").
    /// Usado para decidir se o pedido já foi pago ou se deve ser cobrado na entrega.
    /// </summary>
    [JsonPropertyName("payment_status")]
    public string? PaymentStatus { get; set; }

    [JsonPropertyName("user")]
    public UserDto? User { get; set; }

    [JsonPropertyName("items")]
    public List<OrderItemDto> Items { get; set; } = new();

    /// <summary>
    /// Lista de pagamentos (Split Payment / múltiplas formas).
    /// Mapeia o campo "payment" recebido do JSON.
    /// </summary>
    [JsonPropertyName("payment")]
    public List<PaymentDto>? Payments { get; set; }

    [JsonPropertyName("payment_method")]
    public string? PaymentMethod { get; set; }

    [JsonPropertyName("delivery_address")]
    public DeliveryAddressDto? DeliveryAddress { get; set; }

    [JsonPropertyName("delivery_notes")]
    public string? DeliveryNotes { get; set; }

    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    [JsonPropertyName("received_amount")]
    public string? ReceivedAmount { get; set; }

    [JsonPropertyName("change_amount")]
    public string? ChangeAmount { get; set; }

    [JsonPropertyName("delivery_fee")]
    public string? DeliveryFee { get; set; }
}

public class UserDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }
}

public class OrderItemDto
{
    [JsonPropertyName("quantity")]
    public int Quantity { get; set; }

    [JsonPropertyName("price")]
    public string Price { get; set; } = "0";

    /// <summary>Nome unificado (produto ou combo) enviado pela API para evitar "Produto desconhecido".</summary>
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("product")]
    public ProductDto? Product { get; set; }

    [JsonPropertyName("combo")]
    public ComboDto? Combo { get; set; }

    [JsonPropertyName("is_combo")]
    public bool IsCombo { get; set; }

    /// <summary>Sub-itens do combo para imprimir recuado (ex: "- 1x Coca-Cola").</summary>
    [JsonPropertyName("sub_lines")]
    public List<string>? SubLines { get; set; }

    [JsonPropertyName("sale_type")]
    public string? SaleType { get; set; } // 'dose' ou 'garrafa'
}

public class ProductDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class ComboDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class PaymentDto
{
    /// <summary>
    /// Método de pagamento raw recebido do JSON (ex: "dinheiro", "pix", "credit_card").
    /// Continua mapeando o campo "payment_method" para compatibilidade.
    /// </summary>
    [JsonPropertyName("payment_method")]
    public string Method { get; set; } = string.Empty;

    /// <summary>
    /// Valor da parcela. Aceita tanto número quanto string no JSON.
    /// </summary>
    [JsonPropertyName("amount")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public decimal Amount { get; set; }
}

public class DeliveryAddressDto
{
    [JsonPropertyName("street")]
    public string? Street { get; set; }

    [JsonPropertyName("number")]
    public string? Number { get; set; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("complement")]
    public string? Complement { get; set; }

    [JsonPropertyName("zipcode")]
    public string? Zipcode { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }
}

