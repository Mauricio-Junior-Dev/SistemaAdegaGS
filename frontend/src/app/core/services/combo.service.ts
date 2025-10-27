import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Combo } from '../models/combo.model';

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ComboService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Listar combos públicos com filtros e paginação
  getCombos(params?: {
    search?: string;
    featured?: boolean;
    offers?: boolean;
    sort_by?: string;
    sort_order?: string;
    per_page?: number;
    page?: number;
  }): Observable<PaginatedResponse<Combo>> {
    return this.http.get<PaginatedResponse<Combo>>(`${this.apiUrl}/combos`, { params });
  }

  // Obter combo por ID (público)
  getCombo(id: number): Observable<Combo> {
    return this.http.get<Combo>(`${this.apiUrl}/combos/${id}`);
  }

  // Obter combos em destaque
  getFeaturedCombos(): Observable<Combo[]> {
    return this.getCombos({ featured: true, per_page: 8 }).pipe(
      map(response => response.data)
    );
  }

  // Obter combos em oferta
  getOffersCombos(): Observable<Combo[]> {
    return this.getCombos({ offers: true, per_page: 8 }).pipe(
      map(response => response.data)
    );
  }

  // Buscar combos
  searchCombos(searchTerm: string): Observable<Combo[]> {
    return this.getCombos({ search: searchTerm, per_page: 20 }).pipe(
      map(response => response.data)
    );
  }
}
