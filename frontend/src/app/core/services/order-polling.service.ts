import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, takeWhile, startWith, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { OrderService, OrderResponse, Order, Payment } from '../../employee/services/order.service';
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

  private userSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private orderService: OrderService,
    private printService: PrintService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    // Observar mudanças no usuário para iniciar/parar polling automaticamente
    // Isso garante que o polling seja iniciado mesmo após F5 (quando o usuário é restaurado do localStorage)
    this.userSubscription = this.authService.user$.pipe(
      tap(user => {
        // Verificação explícita e defensiva: APENAS employee pode iniciar polling
        if (user && user.type === 'employee') {
          // Se um funcionário foi detectado (seja no login ou no F5), iniciar polling
          if (!this.isPollingActive) {
            console.log(`[OrderPollingService] Usuário funcionário detectado (ID: ${user.id}, Tipo: ${user.type}), iniciando polling automaticamente`);
            this.startPolling();
          }
        } else {
          // Se não há usuário, é admin, customer ou qualquer outro tipo, parar polling
          if (this.isPollingActive) {
            const userType = user ? user.type : 'null';
            console.log(`[OrderPollingService] Usuário não é funcionário (Tipo: ${userType}), parando polling`);
            this.stopPolling();
          } else if (user && user.type !== 'employee') {
            // Log adicional para debug: garantir que admin/customer não iniciam polling
            console.log(`[OrderPollingService] Usuário tipo '${user.type}' detectado - polling NÃO será iniciado (apenas 'employee')`);
          }
        }
      })
    ).subscribe();
  }

  /**
   * Inicia o polling de novos pedidos
   * Deve ser chamado após o login de um funcionário
   */
  startPolling(): void {
    console.log('%c[OrderPollingService] STARTING POLLING...', 'color: blue; font-weight: bold;');
    
    if (this.isPollingActive) {
      console.log('[OrderPollingService] Polling já está ativo, ignorando chamada.');
      return;
    }

    const currentUser = this.authService.getUser();
    
    // Verificação dupla e explícita: APENAS employee pode iniciar polling
    if (!currentUser) {
      console.warn('[OrderPollingService] Tentativa de iniciar polling sem usuário logado. Abortando.');
      return;
    }
    
    if (currentUser.type !== 'employee') {
      console.warn(`[OrderPollingService] Tentativa de iniciar polling para usuário tipo '${currentUser.type}'. Apenas 'employee' pode iniciar polling. Abortando.`);
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
      status: 'processing'
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
          const isProcessing = order.status === 'processing';
          
          return isNew && notPrinted && isProcessing;
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
   * Apenas imprime pedidos com método de pagamento 'dinheiro'
   */
  private printNewOrders(orders: Order[]): void {
    if (!orders || orders.length === 0) {
      return;
    }

    let cashOrderIndex = 0;

    orders.forEach((order) => {
      // --- INÍCIO DA CORREÇÃO TS2339 ---
      let paymentMethod: string | null = null;

      if (Array.isArray(order.payment) && order.payment.length > 0) {
        paymentMethod = order.payment[0].payment_method;
      } else if (order.payment && !Array.isArray(order.payment)) {
        paymentMethod = (order.payment as Payment).payment_method;
      } else {
        paymentMethod = (order as any).payment_method;
      }
      // --- FIM DA CORREÇÃO TS2339 ---

      const isNew = !this.printedOrderIds.has(order.id);
      const isCash = paymentMethod === 'dinheiro';

      if (isNew && isCash) {
        // Marcar como impresso antes de imprimir para evitar duplicação
        this.printedOrderIds.add(order.id);
        
        console.log(`%c[OrderPollingService] NOVO PEDIDO 'DINHEIRO'! Enviando Pedido #${order.order_number} para impressão...`, 'color: green; font-weight: bold;');
        
        // Adicionar pequeno delay entre cada impressão para evitar sobrecarga
        setTimeout(() => {
          // Notificar o usuário sobre o novo pedido
          this.toastr.success(
            `Cliente: ${order.user.name}`,
            `Novo Pedido (Dinheiro)! #${order.order_number}`,
            {
              timeOut: 30000,
              closeButton: true,
              tapToDismiss: true
            }
          );
          
          this.printService.autoPrintOrder(order);
        }, cashOrderIndex * 1000); // 1 segundo entre cada pedido
        
        cashOrderIndex++;
      } else if (isNew && !isCash) {
        // Se for um pedido PIX/Cartão 'pending', adicione à memória, mas NÃO imprima
        this.printedOrderIds.add(order.id);
        console.log(`[OrderPollingService] Novo pedido PIX/Cartão #${order.order_number} detectado. Aguardando pagamento (não imprimir).`);
      }
    });
  }

  /**
   * Verifica se o usuário é funcionário (apenas employee, não admin)
   */
  private isEmployee(user: any): boolean {
    return user && user.type === 'employee';
  }

  /**
   * Retorna se o polling está ativo
   */
  isActive(): boolean {
    return this.isPollingActive;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}

