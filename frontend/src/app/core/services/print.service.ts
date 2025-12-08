import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order } from '../../employee/services/order.service';
import { PrintingBridgeService } from './printing-bridge.service';

interface PrinterConfig {
  printerName?: string;
  useDefaultPrinter: boolean;
  autoPrint: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private configKey = 'printer_config';
  
  private defaultConfig: PrinterConfig = {
    useDefaultPrinter: true,
    autoPrint: true
  };

  private apiUrl = `${environment.apiUrl}/orders`;

  constructor(
    private http: HttpClient,
    private printingBridge: PrintingBridgeService
  ) {
    // Carregar configuração salva
    this.loadConfig();
  }

  private loadConfig(): PrinterConfig {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) {
        const config = JSON.parse(saved);
        return { ...this.defaultConfig, ...config };
      }
    } catch (e) {
      console.error('Erro ao carregar configuração de impressora:', e);
    }
    return this.defaultConfig;
  }

  saveConfig(config: Partial<PrinterConfig>): void {
    try {
      const current = this.loadConfig();
      const newConfig = { ...current, ...config };
      localStorage.setItem(this.configKey, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Erro ao salvar configuração de impressora:', e);
    }
  }

  getConfig(): PrinterConfig {
    return this.loadConfig();
  }
  /**
   * Imprime um pedido manualmente (quando usuário clica no botão)
   * Reutiliza a mesma lógica do autoPrintOrder para garantir layout idêntico
   * Tenta primeiro o Print Bridge, e só usa fallback se falhar
   * O Print Bridge imprime exatamente 2 vias (uma para cozinha/separação e uma para motoboy/cliente)
   */
  printOrderManual(order: Order): void {
    // Enviar pedido para Print Bridge (mesma lógica do autoPrintOrder)
    // O Print Bridge já imprime 2 vias internamente, então chamamos apenas uma vez
    this.printingBridge.printOrder(order).subscribe({
      next: (response) => {
        if (!response.success) {
          console.error(`%c❌ ${response.message}`, 'color: red; font-weight: bold;');
          // Fallback: tentar método antigo via backend Laravel
          this.fallbackToBackendPrint(order);
        } else {
          console.log(`%c✅ Pedido #${order.order_number} impresso com sucesso (2 vias)`, 'color: green; font-weight: bold;');
        }
      },
      error: (error) => {
        console.error(`%c❌ Erro ao imprimir via Print Bridge:`, 'color: red; font-weight: bold;', error);
        // Fallback: tentar método antigo via backend Laravel
        this.fallbackToBackendPrint(order);
      }
    });
  }

  /**
   * Método legado - mantido para compatibilidade
   * Usa window.print() para abrir diálogo de impressão
   * @deprecated Use printOrderManual() para garantir layout idêntico à impressão automática
   */
  printOrder(order: Order, copies: number = 1): void {
    // Para impressão manual, usar método tradicional do navegador
    for (let i = 0; i < copies; i++) {
      if (i > 0) {
        setTimeout(() => this.printSingleOrder(order), i * 500);
      } else {
        this.printSingleOrder(order);
      }
    }
  }

  /**
   * Imprime uma única ordem manualmente via diálogo do navegador
   */
  private printSingleOrder(order: Order): void {
    const printWindow = window.open('', '_blank', 'width=1,height=1');
    if (!printWindow) {
      console.error('Não foi possível abrir janela de impressão');
      return;
    }

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
            Total: ${formatCurrency(this.parseNumber(order.total))}
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
    const doPrint = () => {
      try {
        setTimeout(() => {
          printWindow.print();
          // Fechar janela após um tempo
          setTimeout(() => {
            try {
              printWindow.close();
            } catch (e) {
              // Ignorar erro
            }
          }, 2000);
        }, 100);
      } catch (error) {
        console.error('Erro ao imprimir:', error);
        printWindow.close();
      }
    };

    if (printWindow.document.readyState === 'complete') {
      doPrint();
    } else {
      printWindow.onload = doPrint;
      setTimeout(doPrint, 1000);
    }
  }

  /**
   * Imprime automaticamente um pedido pendente
   * Usado para impressão automática quando novos pedidos são detectados
   * Agora usa o Print Bridge (serviço C# local) para impressão automática e silenciosa
   * O Print Bridge imprime exatamente 2 vias (uma para cozinha/separação e uma para motoboy/cliente)
   */
  autoPrintOrder(order: Order): void {
    const config = this.loadConfig();
    
    if (!config.autoPrint) {
      return;
    }
    
    // Enviar pedido completo para Print Bridge
    // O Print Bridge já imprime 2 vias internamente, então chamamos apenas uma vez
    this.printingBridge.printOrder(order).subscribe({
      next: (response) => {
        if (!response.success) {
          console.error(`%c❌ ${response.message}`, 'color: red; font-weight: bold;');
          // Fallback: tentar método antigo via backend Laravel
          this.fallbackToBackendPrint(order);
        }
      },
      error: (error) => {
        console.error(`%c❌ Erro ao imprimir via Print Bridge:`, 'color: red; font-weight: bold;', error);
        // Fallback: tentar método antigo via backend Laravel
        this.fallbackToBackendPrint(order);
      }
    });
  }

  /**
   * Gera HTML formatado do pedido para impressão
   * Reutiliza a mesma lógica do método printSingleOrder
   */
  private generateOrderHtml(order: Order): string {
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

    return `
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
            Total: ${formatCurrency(this.parseNumber(order.total))}
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
    `;
  }

  /**
   * Fallback: método antigo via backend Laravel (caso Print Bridge não esteja disponível)
   */
  private fallbackToBackendPrint(order: Order): void {
    this.http.post<{success: boolean, message: string}>(`${this.apiUrl}/${order.id}/print`, {}).subscribe({
      next: (response) => {
        if (!response.success) {
          console.error(`%c❌ ${response.message}`, 'color: red; font-weight: bold;');
        }
      },
      error: (error) => {
        console.error(`%c❌ Erro ao imprimir via backend (fallback):`, 'color: red; font-weight: bold;', error);
      }
    });
  }


  /**
   * Converte um valor para número de forma segura
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (value === null || value === undefined) {
      return 0;
    }
    // Tentar converter para string e depois para número
    try {
      const str = String(value);
      const parsed = parseFloat(str);
      return isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
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
