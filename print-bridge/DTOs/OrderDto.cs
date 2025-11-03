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

    [JsonPropertyName("user")]
    public UserDto? User { get; set; }

    [JsonPropertyName("items")]
    public List<OrderItemDto> Items { get; set; } = new();

    [JsonPropertyName("payment")]
    public List<PaymentDto>? Payment { get; set; }

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

    [JsonPropertyName("product")]
    public ProductDto? Product { get; set; }

    [JsonPropertyName("combo")]
    public ComboDto? Combo { get; set; }

    [JsonPropertyName("is_combo")]
    public bool IsCombo { get; set; }

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
    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public string Amount { get; set; } = "0";
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

