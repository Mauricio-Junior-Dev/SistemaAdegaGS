import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  // A URL base agora aponta para o novo DashboardController
  private baseUrl = `${environment.apiUrl}/admin/dashboard`;

  constructor(private http: HttpClient) {}

  // Headers para garantir que os dados NUNCA venham do cache
  private getCacheBustingHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  // Método para a Aba 1: Visão Geral
  getOverviewReport(filters: any): Observable<any> {
    const params = new HttpParams({ fromObject: filters });
    const headers = this.getCacheBustingHeaders();
    return this.http.get<any>(`${this.baseUrl}/overview`, { params, headers });
  }

  // Método para a Aba 2: Produtos
  getProductReport(filters: any): Observable<any> {
    const params = new HttpParams({ fromObject: filters });
    const headers = this.getCacheBustingHeaders();
    return this.http.get<any>(`${this.baseUrl}/products`, { params, headers });
  }
  
  // Método para a Aba 3: Clientes
  getCustomerReport(filters: any): Observable<any> {
    const params = new HttpParams({ fromObject: filters });
    const headers = this.getCacheBustingHeaders();
    return this.http.get<any>(`${this.baseUrl}/customers`, { params, headers });
  }

  // Método para o gráfico de clientes no dashboard principal
  getCustomerSummary(filters: any): Observable<any> {
    const params = new HttpParams({ fromObject: filters });
    const headers = this.getCacheBustingHeaders();
    return this.http.get<any>(`${environment.apiUrl}/admin/dashboard/customer-summary`, { params, headers });
  }
}
