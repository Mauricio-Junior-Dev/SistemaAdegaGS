import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, OrderItem } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

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
}
