import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { switchMap, catchError, takeWhile, take } from 'rxjs/operators';
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
  private readonly PRINTED_IDS_KEY = 'adega_impressao_ids';
  private pollingSubscription?: Subscription;
  private isPollingActive = false;
  
  // Controle de pedidos já impressos
  private printedOrderIds = new Set<number>();

  // BehaviorSubject para manter estado dos pedidos pendentes
  private pendingOrdersSubject = new BehaviorSubject<Order[]>([]);
  public pendingOrders$ = this.pendingOrdersSubject.asObservable();

  private userSubscription?: Subscription;

  private audio = new Audio('assets/sounds/notification.mp3');

  constructor(
    private http: HttpClient,
    private orderService: OrderService,
    private printService: PrintService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.audio.load();
    // Carregar a memória de impressão persistida
    this.loadPrintedIdsFromStorage();
    // Iniciar o listener para mudanças de autenticação
    this.listenToAuthStatus();
  }

  /**
   * Carrega os IDs de pedidos já impressos do localStorage
   */
  private loadPrintedIdsFromStorage(): void {
    const storedIds = localStorage.getItem(this.PRINTED_IDS_KEY);
    if (storedIds) {
      try {
        this.printedOrderIds = new Set(JSON.parse(storedIds));
        console.log(`[Polling] Memória de impressão carregada. ${this.printedOrderIds.size} IDs já impressos.`);
      } catch (error) {
        console.error('[Polling] Erro ao carregar memória de impressão:', error);
        this.printedOrderIds = new Set<number>();
      }
    }
  }

  /**
   * Salva os IDs de pedidos já impressos no localStorage
   */
  private savePrintedIdsToStorage(): void {
    try {
      // Converte o Set para um Array para poder salvar como JSON
      localStorage.setItem(this.PRINTED_IDS_KEY, JSON.stringify(Array.from(this.printedOrderIds)));
    } catch (error) {
      console.error('[Polling] Erro ao salvar memória de impressão:', error);
    }
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
   * Implementa "priming" para ignorar a fila atual e imprimir apenas novos pedidos
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
    console.log('[Polling] Iniciando... "Priming" da memória de impressão...');

    // ETAPA 1: "PRIMING" (Busca a fila ATUAL para IGNORAR)
    // Busca todos os status ativos do Kanban em paralelo
    // Otimizado: per_page reduzido de 200 para 50 (suficiente para identificar pedidos existentes)
    const pendingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 50,
      status: 'pending'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos pending no priming:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      })
    );

    const processingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 50,
      status: 'processing'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos processing no priming:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      })
    );

    const preparingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 50,
      status: 'preparing'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos preparing no priming:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      })
    );

    const deliveringRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 50,
      status: 'delivering'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos delivering no priming:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 50, last_page: 1 } as OrderResponse);
      })
    );

    forkJoin({
      pending: pendingRequest,
      processing: processingRequest,
      preparing: preparingRequest,
      delivering: deliveringRequest
    }).pipe(
      take(1) // Só precisamos da primeira resposta
    ).subscribe({
      next: (response) => {
        // Combinar todos os pedidos
        const allOrders = [...response.pending.data, ...response.processing.data, 
                          ...response.preparing.data, ...response.delivering.data];
        
        // Remover duplicatas
        const uniqueOrders = Array.from(
          new Map(allOrders.map(order => [order.id, order])).values()
        );
        
        // Adiciona TODOS os IDs atuais à memória, SEM imprimir
        uniqueOrders.forEach(order => {
          // Apenas adiciona ao Set, não chama printNewOrders()
          this.printedOrderIds.add(order.id);
        });
        
        this.savePrintedIdsToStorage(); // Salva a memória "preparada"
        console.log(`[Polling] 'Priming' concluído. ${uniqueOrders.length} pedidos existentes foram adicionados à memória para ignorar.`);

        // ETAPA 2: INICIAR O POLLING REAL (só agora)
        // (Inicia o loop 10s APÓS o priming)
        this.pollingSubscription = interval(10000) // Sem startWith(0)
          .pipe(
            takeWhile(() => this.isPollingActive),
            switchMap(() => this.checkForNewPendingOrders()) // Agora sim, busca por NOVOS
          )
          .subscribe({
            next: (newOrders) => {
              if (newOrders && newOrders.length > 0) {
                console.log(`[Polling] ${newOrders.length} novos pedidos detectados para impressão.`);
                this.printNewOrders(newOrders);
              }
            },
            error: (error) => {
              console.error('❌ Erro no polling de pedidos:', error);
            }
          });
      },
      error: (err) => {
        console.error('❌ Erro ao "primar" o poller:', err);
        this.isPollingActive = false; // Para o serviço se o priming falhar
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
  }

  /**
   * Limpa o cache de pedidos impressos
   * Deve ser chamado no logout
   * NOTA: O localStorage NUNCA deve ser limpo aqui - a memória é permanente
   */
  clearPrintedCache(): void {
    this.printedOrderIds.clear();
    // O localStorage permanece intacto para preservar a memória de impressão
  }

  /**
   * Verifica novos pedidos pendentes no backend
   */
  private checkForNewPendingOrders(): Observable<Order[]> {
    if (!this.isPollingActive) {
      return of([]);
    }

    // Buscar pedidos com status ativos do Kanban ('pending', 'processing', 'preparing', 'delivering') em paralelo
    // Otimizado: per_page reduzido de 50 para 20 (mais leve para polling a cada 10s, suficiente para novos pedidos)
    const pendingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 20,
      status: 'pending'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos pending:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 20, last_page: 1 } as OrderResponse);
      })
    );

    const processingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 20,
      status: 'processing'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos processing:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 20, last_page: 1 } as OrderResponse);
      })
    );

    const preparingRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 20,
      status: 'preparing'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos preparing:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 20, last_page: 1 } as OrderResponse);
      })
    );

    const deliveringRequest = this.orderService.fetchOrders({
      page: 1,
      per_page: 20,
      status: 'delivering'
    }).pipe(
      catchError((error) => {
        console.error('Erro ao buscar pedidos delivering:', error);
        return of({ data: [], total: 0, current_page: 1, per_page: 20, last_page: 1 } as OrderResponse);
      })
    );

    // Combinar os resultados das quatro requisições em paralelo
    return forkJoin({
      pending: pendingRequest,
      processing: processingRequest,
      preparing: preparingRequest,
      delivering: deliveringRequest
    }).pipe(
      switchMap(({ pending, processing, preparing, delivering }) => {
        // Combinar todos os pedidos de todos os status ativos do Kanban
        const allOrders = [...pending.data, ...processing.data, ...preparing.data, ...delivering.data];
        
        // Remover duplicatas por ID (caso algum pedido apareça em ambas)
        const uniqueOrders = Array.from(
          new Map(allOrders.map(order => [order.id, order])).values()
        );
        
        // Sempre atualizar o BehaviorSubject com TODOS os pedidos pendentes
        this.pendingOrdersSubject.next(uniqueOrders);
        
        // Encontrar pedidos que ainda não foram impressos
        const newPendingOrders = uniqueOrders.filter(order => {
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
          
          return notPrinted && (isPaidPix || isOnDelivery);
        });
        
        return of(newPendingOrders);
      })
    );
  }

  /**
   * Imprime os novos pedidos detectados
   * Todos os pedidos que chegam aqui já foram filtrados e são considerados "novos"
   */
  /**
   * Toca o alerta sonoro para novo pedido.
   * Universal: toca para qualquer novo pedido (Funcionário e Admin).
   */
  private playNotificationSound(): void {
    this.audio.currentTime = 0;
    this.audio.play().catch(error => {
      console.warn('O navegador bloqueou o som automático. O usuário precisa interagir com a página primeiro.', error);
    });
  }

  private printNewOrders(orders: Order[]): void {
    if (!orders || orders.length === 0) {
      return;
    }

    // Alerta sonoro universal - toca para qualquer novo pedido detectado
    this.playNotificationSound();

    // Marcar TODOS os pedidos como processados IMEDIATAMENTE para evitar duplicatas
    // (independente de imprimir ou não - Admin com switch off não deve ver o mesmo pedido de novo)
    orders.forEach(order => {
      this.printedOrderIds.add(order.id);
    });
    this.savePrintedIdsToStorage();

    // Regra: Funcionário sempre imprime | Admin só imprime se o switch estiver ligado
    const isEmployee = this.authService.isEmployee();
    const isAdmin = this.authService.isAdmin();
    const adminPrintEnabled = localStorage.getItem('admin_auto_print') === 'true';
    if (!isEmployee && !(isAdmin && adminPrintEnabled)) {
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

