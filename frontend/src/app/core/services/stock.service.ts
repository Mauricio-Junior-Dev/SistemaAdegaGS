import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../../employee/services/order.service';

export interface StockResponse {
  data: Product[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

export interface StockSummary {
  total_products: number;
  total_items_in_stock?: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_value: number;
}

export interface StockMovement {
  id: number;
  product_id: number;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiUrl = `${environment.apiUrl}/stock`;

  constructor(private http: HttpClient) {}

  getStock(params: { 
    search?: string;
    page?: number;
    per_page?: number;
    low_stock?: boolean;
    category?: string;
    stock_filter?: string;
  } = {}): Observable<StockResponse> {
    return this.http.get<StockResponse>(this.apiUrl, { params: { ...params } });
  }

  getSummary(): Observable<StockSummary> {
    return this.http.get<StockSummary>(`${this.apiUrl}/summary`);
  }

  getLowStock(): Observable<StockResponse> {
    return this.http.get<StockResponse>(`${this.apiUrl}/low`);
  }

  getProductStock(productId: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${productId}`);
  }

  getProductMovements(productId: number): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.apiUrl}/${productId}/movements`);
  }

  updateStock(productId: number, data: {
    type: 'in' | 'out';
    quantity: number;
    reason: string;
  }): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/${productId}`, data);
  }

  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/categories`);
  }
}