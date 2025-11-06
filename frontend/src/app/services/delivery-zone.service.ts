import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DeliveryZone, DeliveryZoneResponse, DeliveryZoneError } from '../models/delivery-zone.model';

@Injectable({
  providedIn: 'root'
})
export class DeliveryZoneService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Busca todas as zonas de entrega ativas
   */
  getDeliveryZones(): Observable<DeliveryZone[]> {
    return this.http.get<DeliveryZone[]>(`${this.apiUrl}/delivery-zones`);
  }

  /**
   * Calcula o frete por CEP
   */
  calculateFrete(cep: string): Observable<DeliveryZoneResponse> {
    const params = new HttpParams().set('cep', cep);
    return this.http.get<DeliveryZoneResponse>(`${this.apiUrl}/frete`, { params });
  }

  /**
   * Admin: Busca todas as zonas de entrega (incluindo inativas)
   */
  getAdminDeliveryZones(): Observable<DeliveryZone[]> {
    return this.http.get<DeliveryZone[]>(`${this.apiUrl}/admin/delivery-zones`);
  }

  /**
   * Admin: Busca uma zona de entrega específica
   */
  getAdminDeliveryZone(id: number): Observable<DeliveryZone> {
    return this.http.get<DeliveryZone>(`${this.apiUrl}/admin/delivery-zones/${id}`);
  }

  /**
   * Admin: Cria uma nova zona de entrega
   */
  createDeliveryZone(deliveryZone: Partial<DeliveryZone>): Observable<DeliveryZone> {
    return this.http.post<DeliveryZone>(`${this.apiUrl}/admin/delivery-zones`, deliveryZone);
  }

  /**
   * Admin: Atualiza uma zona de entrega
   */
  updateDeliveryZone(id: number, deliveryZone: Partial<DeliveryZone>): Observable<DeliveryZone> {
    return this.http.put<DeliveryZone>(`${this.apiUrl}/admin/delivery-zones/${id}`, deliveryZone);
  }

  /**
   * Admin: Remove uma zona de entrega
   */
  deleteDeliveryZone(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/delivery-zones/${id}`);
  }
}
