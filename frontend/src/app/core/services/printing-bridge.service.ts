import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PrintingBridgeService {
  // URL hardcoded para o Print Bridge que roda localmente na máquina do cliente
  private readonly bridgeUrl: string = 'http://localhost:9000';

  constructor(private http: HttpClient) {
    // Print Bridge sempre roda em localhost:9000 na máquina do cliente
  }

  /**
   * Envia um pedido completo para impressão através do Print Bridge
   * 
   * @param order Objeto Order completo do Angular
   * @returns Observable com a resposta do serviço
   */
  printOrder(order: any): Observable<{ success: boolean; message: string }> {
    // Converter o Order do Angular para o formato esperado pelo Print Bridge
    const orderDto = this.convertToOrderDto(order);

    return this.http.post<{ success: boolean; message: string }>(
      `${this.bridgeUrl}/print`,
      orderDto
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        // Erro específico para quando o serviço não está rodando
        if (error.status === 0 || error.error instanceof ProgressEvent) {
          console.error('❌ Print Bridge não está disponível');
          console.error('💡 Certifique-se de que o serviço Print Bridge está rodando em http://localhost:9000');
          return throwError(() => new Error('Print Bridge não está disponível. Verifique se o serviço está rodando.'));
        }

        // Outros erros HTTP
        console.error('❌ Erro ao comunicar com Print Bridge:', error);
        return throwError(() => new Error(error.error?.detail || error.error?.message || 'Erro ao enviar para impressão'));
      })
    );
  }

  /**
   * Converte o Order do Angular para o formato OrderDto esperado pelo Print Bridge
   */
  private convertToOrderDto(order: any): any {
    // Converter items
    const items = (order.items || []).map((item: any) => ({
      quantity: item.quantity || 0,
      price: String(item.price || item.subtotal || 0),
      product: item.product ? {
        name: item.product.name || ''
      } : null,
      combo: item.combo ? {
        name: item.combo.name || ''
      } : null,
      is_combo: item.is_combo || false,
      sale_type: item.sale_type || null
    }));

    // Converter payments
    let payments: any[] = [];
    let receivedAmount = null;
    let changeAmount = null;
    
    if (order.payment) {
      if (Array.isArray(order.payment)) {
        payments = order.payment.map((p: any) => ({
          payment_method: p.payment_method || order.payment_method || '',
          amount: String(p.amount || order.total || 0)
        }));
        // Pegar received_amount e change_amount do primeiro payment
        if (order.payment.length > 0) {
          receivedAmount = order.payment[0].received_amount != null && order.payment[0].received_amount !== '' 
            ? String(order.payment[0].received_amount) 
            : null;
          changeAmount = order.payment[0].change_amount != null && order.payment[0].change_amount !== '' 
            ? String(order.payment[0].change_amount) 
            : null;
        }
      } else {
        payments = [{
          payment_method: order.payment.payment_method || order.payment_method || '',
          amount: String(order.payment.amount || order.total || 0)
        }];
        receivedAmount = order.payment.received_amount != null && order.payment.received_amount !== '' 
          ? String(order.payment.received_amount) 
          : null;
        changeAmount = order.payment.change_amount != null && order.payment.change_amount !== '' 
          ? String(order.payment.change_amount) 
          : null;
      }
    } else if (order.payment_method) {
      payments = [{
        payment_method: order.payment_method,
        amount: String(order.total || 0)
      }];
    }

    // Converter delivery address
    let deliveryAddress: any = null;
    if (order.delivery_address) {
      deliveryAddress = {
        street: order.delivery_address.street || order.delivery_address.address || null,
        number: order.delivery_address.number || null,
        neighborhood: order.delivery_address.neighborhood || null,
        city: order.delivery_address.city || null,
        complement: order.delivery_address.complement || null,
        zipcode: order.delivery_address.zipcode || order.delivery_address.cep || null,
        state: order.delivery_address.state || order.delivery_address.uf || null
      };
    }

    const result = {
      id: order.id || 0,
      order_number: order.order_number || '',
      total: String(order.total || 0),
      status: order.status || null,
      user: order.user ? {
        name: order.user.name || '',
        phone: order.user.phone || null
      } : null,
      items: items,
      payment: payments.length > 0 ? payments : null,
      payment_method: order.payment_method || null,
      delivery_address: deliveryAddress,
      delivery_notes: order.delivery_notes || null,
      delivery_fee: order.delivery_fee != null ? String(order.delivery_fee) : '0',
      created_at: order.created_at || new Date().toISOString(),
      received_amount: receivedAmount,
      change_amount: changeAmount
    };
    
    return result;
  }

  /**
   * Verifica se o Print Bridge está online e respondendo
   * 
   * @returns Observable com o status do serviço
   */
  checkHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(
      `${this.bridgeUrl}/health`
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 0 || error.error instanceof ProgressEvent) {
          return throwError(() => new Error('Print Bridge não está disponível'));
        }
        return throwError(() => new Error('Erro ao verificar status do Print Bridge'));
      })
    );
  }
}

