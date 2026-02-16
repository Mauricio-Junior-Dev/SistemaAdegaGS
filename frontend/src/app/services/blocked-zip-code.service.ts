import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BlockedZipCode } from '../models/blocked-zip-code.model';

@Injectable({
  providedIn: 'root'
})
export class BlockedZipCodeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Admin: lista todos os CEPs bloqueados.
   */
  getAll(): Observable<BlockedZipCode[]> {
    return this.http.get<BlockedZipCode[]>(`${this.apiUrl}/admin/blocked-zip-codes`);
  }

  /**
   * Admin: cria um novo CEP bloqueado.
   */
  create(payload: { zip_code: string; reason?: string | null }): Observable<BlockedZipCode> {
    return this.http.post<BlockedZipCode>(`${this.apiUrl}/admin/blocked-zip-codes`, payload);
  }

  /**
   * Admin: exclui um CEP bloqueado.
   */
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/blocked-zip-codes/${id}`);
  }
}

