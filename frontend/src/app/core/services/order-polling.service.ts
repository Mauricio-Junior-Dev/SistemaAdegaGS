import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, takeWhile, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { OrderService, OrderResponse, Order } from '../../employee/services/order.service';
import { PrintService } from './print.service';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';

/**
 * Serviço global de polling para verificar e imprimir novos pedidos automaticamente
 * 
 * Este serviço roda em segundo plano quando o funcionário está logado,
 * verificando novos pedidos pendentes a cada 10 segundos e imprimindo-os
 * automaticamente através do Print Bridge.
 */
@Injectable({
  providedIn: 'root'
})
export class OrderPollingService implements OnDestroy {
  private readonly apiUrl = `${environment.apiUrl}/orders`;
  private pollingSubscription?: Subscription;
  private isPollingActive = false;
  
  // Controle de pedidos já impressos
  private printedOrderIds = new Set<number>();
  private lastPendingOrderIds = new Set<number>();

  // BehaviorSubject para manter estado dos pedidos pendentes
  private pendingOrdersSubject = new BehaviorSubject<Order[]>([]);
  public pendingOrders$ = this.pendingOrdersSubject.asObservable();

  constructor(
    private http: HttpClient,
    private orderService: OrderService,
    private printService: PrintService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
  }

  /**
   * Inicia o polling de novos pedidos
   * Deve ser chamado após o login de um funcionário
   */
  startPolling(): void {
    console.log('%c[OrderPollingService] STARTING POLLING...', 'color: blue; font-weight: bold;');
    
    if (this.isPollingActive) {
      return;
    }

    const currentUser = this.authService.getUser();
    
    if (!currentUser || !this.isEmployee(currentUser)) {
      return;
    }
    this.isPollingActive = true;
    this.lastPendingOrderIds.clear(); // Reset para detectar todos os pedidos atuais

    // Verificar a cada 10 segundos (startWith(0) inicia imediatamente)
    this.pollingSubscription = interval(10000)
      .pipe(
        startWith(0), // Fazer primeira verificação imediatamente
        takeWhile(() => this.isPollingActive),
        switchMap(() => {
          return this.checkForNewPendingOrders();
        })
      )
      .subscribe({
        next: (newOrders) => {
          if (newOrders && newOrders.length > 0) {
            this.printNewOrders(newOrders);
          }
        },
        error: (error) => {
          console.error('❌ Erro no polling de pedidos:', error);
        }
      });
  }

  /**
   * Para o polling de novos pedidos
   * Deve ser chamado no logout
   */
  stopPolling(): void {
    if (!this.isPollingActive) {
      return;
    }

    console.log('%c[OrderPollingService] STOPPING POLLING.', 'color: red; font-weight: bold;');
    this.isPollingActive = false;
    
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }

    // Limpar estado de polling (impressedOrderIds é limpo separadamente no logout)
    this.lastPendingOrderIds.clear();
  }

  /**
   * Limpa o cache de pedidos impressos
   * Deve ser chamado no logout
   */
  clearPrintedCache(): void {
    this.printedOrderIds.clear();
  }

  /**
   * Verifica novos pedidos pendentes no backend
   */
  private checkForNewPendingOrders(): Observable<Order[]> {
    if (!this.isPollingActive) {
      return of([]);
    }

    return this.orderService.fetchOrders({
      page: 1,
      per_page: 50, // Buscar mais pedidos para detectar todos os novos
      status: 'pending'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos pendentes:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      }),
      switchMap((response: OrderResponse) => {
        const currentPendingIds = new Set(response.data.map(order => order.id));
        
        // Sempre atualizar o BehaviorSubject com TODOS os pedidos pendentes
        this.pendingOrdersSubject.next(response.data);
        
        // Se for a primeira vez, apenas armazenar os IDs
        if (this.lastPendingOrderIds.size === 0) {
          response.data.forEach(order => {
            this.lastPendingOrderIds.add(order.id);
          });
          return of([]);
        }
        
        // Encontrar novos pedidos pendentes que ainda não foram impressos
        const newPendingOrders = response.data.filter(order => {
          const isNew = !this.lastPendingOrderIds.has(order.id);
          const notPrinted = !this.printedOrderIds.has(order.id);
          const isPending = order.status === 'pending';
          
          return isNew && notPrinted && isPending;
        });
        
        // Atualizar lista de IDs conhecidos
        response.data.forEach(order => {
          this.lastPendingOrderIds.add(order.id);
        });
        
        return of(newPendingOrders);
      })
    );
  }

  /**
   * Imprime os novos pedidos detectados
   */
  private printNewOrders(orders: Order[]): void {
    if (!orders || orders.length === 0) {
      return;
    }

    orders.forEach((order, index) => {
      // Marcar como impresso antes de imprimir para evitar duplicação
      this.printedOrderIds.add(order.id);
      
      // Adicionar pequeno delay entre cada impressão para evitar sobrecarga
      setTimeout(() => {
        // Notificar o usuário sobre o novo pedido
        this.toastr.success(
          `Cliente: ${order.user.name}`,
          `Novo Pedido Recebido! #${order.order_number}`,
          {
            timeOut: 30000,
            closeButton: true,
            tapToDismiss: true
          }
        );
        
        this.printService.autoPrintOrder(order);
      }, index * 1000); // 1 segundo entre cada pedido
    });
  }

  /**
   * Verifica se o usuário é funcionário ou admin
   */
  private isEmployee(user: any): boolean {
    return user && (user.type === 'employee' || user.type === 'admin');
  }

  /**
   * Retorna se o polling está ativo
   */
  isActive(): boolean {
    return this.isPollingActive;
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}

