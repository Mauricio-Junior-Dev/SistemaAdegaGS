import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, OrderItem } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Headers para garantir que os dados NUNCA venham do cache
  private getCacheBustingHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  getOrders(): Observable<Order[]> {
    console.log('OrderService: Fetching orders from:', `${this.apiUrl}/my-orders`);
    return this.http.get<Order[]>(`${this.apiUrl}/my-orders`);
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`);
  }

  createOrder(orderData: any): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, orderData);
  }

  updateOrderStatus(id: number, status: string): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/orders/${id}/status`, { status });
  }

  confirmDelivery(orderId: number): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/orders/${orderId}/confirm-delivery`, {});
  }

  /**
   * Busca um único pedido pelo ID (para verificar o status do pagamento)
   */
  getOrderById(orderId: number): Observable<Order> {
    const headers = this.getCacheBustingHeaders();
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}`, { headers });
  }
}
