import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
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
    // Iniciar o listener para mudanças de autenticação
    this.listenToAuthStatus();
  }

  private listenToAuthStatus(): void {
    // Verificar estado inicial imediatamente (BehaviorSubject emite valor atual na subscrição)
    this.checkAndStartPolling();
    
    // Escutar mudanças futuras
    this.userSubscription = this.authService.authStatus$.subscribe(() => {
      this.checkAndStartPolling();
    });
  }

  private checkAndStartPolling(): void {
    const isLoggedIn = this.authService.isLoggedIn();
    const userType = this.authService.getUserType();
    const isEmployee = userType === 'employee' || userType === 'admin';
    
    if (isLoggedIn && isEmployee) {
      // Se está logado e é funcionário/admin, iniciar polling
      if (!this.isPollingActive) {
        this.startPolling();
      }
    } else {
      // Se não está logado ou não é funcionário/admin, parar polling
      if (this.isPollingActive) {
        this.stopPolling();
      }
    }
  }

  /**
   * Inicia o polling de novos pedidos
   * Deve ser chamado após o login de um funcionário
   */
  startPolling(): void {
    if (this.isPollingActive) {
      return;
    }

    const currentUser = this.authService.getUser();
    
    // Verificação dupla e explícita: APENAS employee ou admin pode iniciar polling
    if (!currentUser) {
      return;
    }
    
    if (currentUser.type !== 'employee' && currentUser.type !== 'admin') {
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

    // Buscar pedidos com status 'pending' e 'processing' em paralelo
    const pendingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 50,
      status: 'pending'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos pending:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      })
    );

    const processingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 50,
      status: 'processing'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos processing:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      })
    );

    // Combinar os resultados das duas requisições em paralelo
    return forkJoin({
      pending: pendingRequest,
      processing: processingRequest
    }).pipe(
      switchMap(({ pending, processing }) => {
        // Combinar todos os pedidos
        const allOrders = [...pending.data, ...processing.data];
        
        // Remover duplicatas por ID (caso algum pedido apareça em ambas)
        const uniqueOrders = Array.from(
          new Map(allOrders.map(order => [order.id, order])).values()
        );
        
        // Sempre atualizar o BehaviorSubject com TODOS os pedidos pendentes
        this.pendingOrdersSubject.next(uniqueOrders);
        
        // Se for a primeira vez, apenas armazenar os IDs
        if (this.lastPendingOrderIds.size === 0) {
          uniqueOrders.forEach(order => {
            this.lastPendingOrderIds.add(order.id);
          });
          return of([]);
        }
        
        // Encontrar novos pedidos que ainda não foram impressos
        const newPendingOrders = uniqueOrders.filter(order => {
          const isNew = !this.lastPendingOrderIds.has(order.id);
          const notPrinted = !this.printedOrderIds.has(order.id);
          
          // Extrair método de pagamento
          const payment = order.payment || [];
          const paymentMethod = Array.isArray(payment) 
            ? payment[0]?.payment_method 
            : payment?.payment_method;
          
          // --- Lógica de Impressão ---
          // 1. É um PIX PAGO?
          const isPaidPix = order.status === 'processing';
          
          // 2. É um pedido NA ENTREGA? (Dinheiro ou Cartão)
          const isOnDelivery = order.status === 'pending' && 
                              (paymentMethod === 'dinheiro' || paymentMethod === 'cartão de débito');
          
          return isNew && notPrinted && (isPaidPix || isOnDelivery);
        });
        
        // Atualizar lista de IDs conhecidos
        uniqueOrders.forEach(order => {
          this.lastPendingOrderIds.add(order.id);
        });
        
        return of(newPendingOrders);
      })
    );
  }

  /**
   * Imprime os novos pedidos detectados
   * Todos os pedidos que chegam aqui já foram filtrados e são considerados "novos"
   */
  private printNewOrders(orders: Order[]): void {
    if (!orders || orders.length === 0) {
      return;
    }

    orders.forEach((order, index) => {
      // Pega o método de pagamento (para o toast)
      const payment = order.payment || [];
      const paymentMethod = Array.isArray(payment) 
        ? payment[0]?.payment_method 
        : payment?.payment_method;
      
      // Determinar título da notificação
      let title = 'Novo Pedido!';
      if (order.status === 'processing') {
        title = 'Novo Pedido (PIX Pago)!';
      } else if (paymentMethod === 'dinheiro') {
        title = 'Novo Pedido (Dinheiro)!';
      } else if (paymentMethod === 'cartão de débito') {
        title = 'Novo Pedido (Cartão na Entrega)!';
      }
      
      // Marcar como impresso IMEDIATAMENTE para evitar duplicação
      this.printedOrderIds.add(order.id);
      
      // Adicionar pequeno delay entre cada impressão para evitar sobrecarga
      setTimeout(() => {
        // Notificar o usuário sobre o novo pedido
        this.toastr.success(
          `Cliente: ${order.user.name}`,
          `${title} #${order.order_number}`,
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

