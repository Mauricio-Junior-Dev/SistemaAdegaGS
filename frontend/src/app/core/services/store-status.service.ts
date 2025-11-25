import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { of } from 'rxjs';

export interface StoreStatus {
  isOpen: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StoreStatusService {
  private apiUrl = `${environment.apiUrl}/store-status`;
  private adminApiUrl = `${environment.apiUrl}/admin/store-status`;
  
  private statusSubject = new BehaviorSubject<boolean>(true); // Por padrão, loja aberta
  public status$ = this.statusSubject.asObservable();

  constructor(private http: HttpClient) {
    // Carregar status inicial
    this.loadStatus();
    
    // Atualizar status a cada 30 segundos
    interval(30000).pipe(
      switchMap(() => this.getStoreStatus())
    ).subscribe({
      next: (status) => this.statusSubject.next(status.isOpen),
      error: (err) => console.error('Erro ao atualizar status da loja:', err)
    });
  }

  /**
   * Carrega o status atual da loja (público)
   */
  loadStatus(): void {
    this.getStoreStatus().subscribe({
      next: (status) => this.statusSubject.next(status.isOpen),
      error: (err) => {
        console.error('Erro ao carregar status da loja:', err);
        // Em caso de erro, assume que a loja está aberta
        this.statusSubject.next(true);
      }
    });
  }

  /**
   * Obtém o status atual da loja (público)
   */
  getStoreStatus(): Observable<StoreStatus> {
    return this.http.get<StoreStatus>(this.apiUrl).pipe(
      catchError((error) => {
        console.error('Erro ao buscar status da loja:', error);
        // Em caso de erro, retorna loja aberta
        return of({ isOpen: true });
      })
    );
  }

  /**
   * Atualiza o status da loja (apenas admin/funcionário)
   */
  updateStoreStatus(isOpen: boolean): Observable<StoreStatus> {
    return this.http.post<StoreStatus>(this.adminApiUrl, { isOpen }).pipe(
      map((response) => {
        this.statusSubject.next(response.isOpen);
        return response;
      }),
      catchError((error) => {
        console.error('Erro ao atualizar status da loja:', error);
        throw error;
      })
    );
  }

  /**
   * Retorna o status atual (síncrono)
   */
  getCurrentStatus(): boolean {
    return this.statusSubject.value;
  }
}

