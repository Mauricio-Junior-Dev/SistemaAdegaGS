import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StockMovement {
  id: number;
  product_id: number;
  user_id: number;
  type: 'entrada' | 'saida';
  quantity: number;
  description?: string;
  unit_cost?: number;
  created_at: string;
  updated_at: string;
  product?: {
    id: number;
    name: string;
  };
  user?: {
    id: number;
    name: string;
  };
}

export interface StockMovementResponse {
  data: StockMovement[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

export interface MovementSummary {
  summary: {
    entrada?: {
      count: number;
      total_quantity: number;
    };
    saida?: {
      count: number;
      total_quantity: number;
    };
  };
  user_summary: Array<{
    user_id: number;
    user_name: string;
    movements_count: number;
  }>;
  product_summary: Array<{
    product_id: number;
    product_name: string;
    movements_count: number;
  }>;
  total_movements: number;
}

export interface MovementFilters {
  product_id?: number;
  user_id?: number;
  type?: 'entrada' | 'saida';
  date_from?: string;
  date_to?: string;
  per_page?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockMovementService {
  private apiUrl = `${environment.apiUrl}/admin/stock-movements`;

  constructor(private http: HttpClient) {}

  getMovements(filters: MovementFilters = {}): Observable<StockMovementResponse> {
    let params = new HttpParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<StockMovementResponse>(this.apiUrl, { params });
  }

  getSummary(filters: { date_from?: string; date_to?: string } = {}): Observable<MovementSummary> {
    let params = new HttpParams();
    
    if (filters.date_from) {
      params = params.set('date_from', filters.date_from);
    }
    if (filters.date_to) {
      params = params.set('date_to', filters.date_to);
    }

    return this.http.get<MovementSummary>(`${this.apiUrl}/summary`, { params });
  }

  exportMovements(filters: MovementFilters = {}): Observable<any> {
    let params = new HttpParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get(`${this.apiUrl}/export`, { params });
  }

  getMovementStats(filters: { date_from?: string; date_to?: string } = {}): Observable<{ total_in: number; total_out: number; balance: number }> {
    let params = new HttpParams();
    
    if (filters.date_from) {
      params = params.set('date_from', filters.date_from);
    }
    if (filters.date_to) {
      params = params.set('date_to', filters.date_to);
    }

    return this.http.get<{ total_in: number; total_out: number; balance: number }>(`${this.apiUrl}/stats`, { params });
  }
}
