import { Injectable } from '@angular/core';
import { Order } from '../../employee/services/order.service';

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  printOrder(order: Order): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedDate = new Date(order.created_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const getStatusLabel = (status: string) => {
      const labels: { [key: string]: string } = {
        pending: 'Pendente',
        delivering: 'Em Entrega',
        completed: 'Concluído',
        cancelled: 'Cancelado'
      };
      return labels[status] || status;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${order.order_number}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                size: 80mm 297mm;
                margin: 0;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              margin: 0;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              margin-bottom: 10mm;
            }
            .header h1 {
              font-size: 16pt;
              margin: 0;
            }
            .header p {
              font-size: 10pt;
              margin: 2mm 0;
            }
            .order-info {
              margin-bottom: 5mm;
              font-size: 10pt;
            }
            .customer-info {
              margin-bottom: 5mm;
              font-size: 10pt;
            }
            .items {
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 3mm 0;
              margin: 3mm 0;
            }
            .item {
              font-size: 10pt;
              margin: 2mm 0;
            }
            .item .quantity {
              display: inline-block;
              width: 15mm;
            }
            .item .name {
              display: inline-block;
              width: 40mm;
            }
            .item .price {
              display: inline-block;
              width: 20mm;
              text-align: right;
            }
            .total {
              text-align: right;
              font-size: 12pt;
              font-weight: bold;
              margin: 5mm 0;
            }
            .footer {
              text-align: center;
              font-size: 10pt;
              margin-top: 10mm;
            }
            .qr-code {
              text-align: center;
              margin: 5mm 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ADEGA GS</h1>
            <p>CNPJ: XX.XXX.XXX/0001-XX</p>
            <p>Rua Exemplo, 123 - Centro</p>
            <p>Tel: (11) 9999-9999</p>
          </div>

          <div class="order-info">
            <p><strong>Pedido:</strong> #${order.order_number}</p>
            <p><strong>Data:</strong> ${formattedDate}</p>
            <p><strong>Status:</strong> ${getStatusLabel(order.status)}</p>
          </div>

          <div class="customer-info">
            <p><strong>Cliente:</strong> ${order.user.name}</p>
            ${order.user.phone ? `<p><strong>Telefone:</strong> ${order.user.phone}</p>` : ''}
          </div>

          <div class="items">
            ${order.items.map(item => `
              <div class="item">
                <span class="quantity">${item.quantity}x</span>
                <span class="name">${item.is_combo && item.combo ? item.combo.name : (item.product?.name || 'Produto não encontrado')}</span>
                <span class="price">${formatCurrency(item.price * item.quantity)}</span>
              </div>
            `).join('')}
          </div>

          <div class="total">
            Total: ${formatCurrency(order.total)}
          </div>

          <div class="payment-info">
            <p><strong>Forma de Pagamento:</strong> ${this.getPaymentMethod(order)}</p>
          </div>

          <div class="footer">
            <p>Agradecemos a preferência!</p>
            <p>www.adegags.com.br</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Aguardar o carregamento da página antes de imprimir
    printWindow.onload = () => {
      printWindow.print();
      // Fechar a janela após a impressão (opcional, depende da preferência do usuário)
      // printWindow.close();
    };
  }

  private getPaymentMethod(order: Order): string {
    // Primeiro tenta o payment_method direto do order
    if (order.payment_method) {
      return this.formatPaymentMethod(order.payment_method);
    }
    
    // Depois tenta o payment_method do objeto payment (pode ser array ou objeto)
    if (order.payment) {
      if (Array.isArray(order.payment) && order.payment.length > 0) {
        // Se é array, pega o primeiro payment
        return this.formatPaymentMethod(order.payment[0].payment_method);
      } else if (!Array.isArray(order.payment)) {
        // Se é objeto único
        return this.formatPaymentMethod(order.payment.payment_method);
      }
    }
    
    return 'Não informado';
  }

  private formatPaymentMethod(method: string): string {
    const methods: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'cartao': 'Cartão',
      'pix': 'PIX',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito'
    };
    return methods[method] || method;
  }
}
