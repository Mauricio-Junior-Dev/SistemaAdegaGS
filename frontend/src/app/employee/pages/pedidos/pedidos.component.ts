import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, Observable, combineLatest, map, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { OrderService, Order, OrderStatus, OrderResponse } from '../../services/order.service';
import { PrintService } from '../../../core/services/print.service';
import { OrderPollingService } from '../../../core/services/order-polling.service';
import { UpdateOrderStatusDialogComponent } from './dialogs/update-order-status-dialog.component';
import { OrderDetailsDialogComponent } from './dialogs/order-details-dialog.component';

@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    FormsModule
  ]
})
export class PedidosComponent implements OnInit, OnDestroy {
  // Observable para pedidos pendentes (atualizado automaticamente pelo OrderPollingService)
  public pedidos$!: Observable<Order[]>;
  
  pedidos: Order[] = [];
  pedidosTodos: Order[] = [];
  pedidosNovos: Order[] = [];
  pedidosEmPreparo: Order[] = [];
  pedidosEmEntrega: Order[] = [];
  pedidosConcluidos: Order[] = [];
  concluidosLoading = true;
  orders: Order[] = [];
  displayedColumns = ['id', 'created_at', 'customer', 'address', 'items', 'total', 'status', 'actions'];
  loading = true;
  selectedStatus: OrderStatus | 'all' = 'pending';
  lastOrderCount = 0;
  hasNewOrders = false;
  
  // Paginação
  totalItems = 0;
  pageSize = 15;
  currentPage = 0;
  searchTerm = '';
  searching = false;
  
  // Estatísticas gerais
  stats = {
    total: 0,
    pending: 0,
    processing: 0,
    preparing: 0,
    delivering: 0,
    completed: 0,
    cancelled: 0
  };
  
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private pollingSub?: Subscription;

  constructor(
    private orderService: OrderService,
    private orderPollingService: OrderPollingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private printService: PrintService
  ) {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(800), // Aumentado para 800ms para dar tempo de digitar
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 0;
      this.searching = true;
      this.loadOrders();
    });
  }

  ngOnInit(): void {
    // Conectar o componente ao Observable do OrderPollingService
    // O componente agora está 'escutando' o serviço
    this.pedidos$ = this.orderPollingService.pendingOrders$;
    
    // Subscrever ao Observable para atualizar a lista local quando houver mudanças
    // Esta subscrição será sempre ativa e atualizará todas as listas filtradas para o Kanban
    this.pollingSub = this.orderPollingService.pendingOrders$.subscribe(
      (pedidosRecebidos: Order[]) => {
        this.pedidos = pedidosRecebidos;
        this.pedidosTodos = pedidosRecebidos;
        this.filtrarPedidosPorStatus();
        this.loading = false;
      }
    );
    
    // O loading será desativado quando o Observable emitir os dados
    // O OrderPollingService já busca os dados a cada 10 segundos e atualiza o BehaviorSubject
    
    this.loadStats();
    this.loadConcluidos();
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Método removido: A impressão automática agora é feita pelo OrderPollingService
  // que roda globalmente quando o funcionário está logado

  loadConcluidos(): void {
    this.concluidosLoading = true;
    // Busca os últimos 50 pedidos concluídos
    this.orderService.fetchOrders({ status: 'completed', per_page: 50, page: 1 })
      .pipe(finalize(() => this.concluidosLoading = false))
      .subscribe({
        next: (response) => {
          this.pedidosConcluidos = response.data;
        },
        error: (err) => {
          console.error('Erro ao carregar pedidos concluídos', err);
          this.snackBar.open('Não foi possível carregar os pedidos concluídos.', 'Fechar', { duration: 3000 });
        }
      });
  }

  filtrarPedidosPorStatus(): void {
    // Novos pedidos: pending ou processing
    this.pedidosNovos = this.pedidosTodos.filter(
      p => p.status === 'pending' || p.status === 'processing'
    );
    
    // Em preparo
    this.pedidosEmPreparo = this.pedidosTodos.filter(
      p => p.status === 'preparing'
    );
    
    // Em entrega
    this.pedidosEmEntrega = this.pedidosTodos.filter(
      p => p.status === 'delivering'
    );
  }

  loadOrders(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      status: this.selectedStatus === 'all' ? undefined : this.selectedStatus,
      search: this.searchTerm || undefined
    };


    this.orderService.fetchOrders(params).subscribe({
      next: (response: OrderResponse) => {
        
        this.orders = response.data;
        this.totalItems = response.total;
        this.loading = false;
        this.searching = false;
        
      },
      error: (error: Error) => {
        console.error('Erro ao carregar pedidos:', error);
        this.snackBar.open('Erro ao carregar pedidos', 'Fechar', { duration: 3000 });
        this.loading = false;
        this.searching = false;
      }
    });
  }

  loadStats(): void {
    // Carregar estatísticas para cada status
    const statuses: (OrderStatus | 'all')[] = ['all', 'pending', 'processing', 'preparing', 'delivering', 'completed', 'cancelled'];
    let completedRequests = 0;
    
    statuses.forEach(status => {
      this.orderService.fetchOrders({ 
        page: 1, 
        per_page: 1, 
        status: status === 'all' ? undefined : status 
      }).subscribe({
        next: (response: OrderResponse) => {
          if (status === 'all') {
            this.stats.total = response.total;
          } else {
            this.stats[status] = response.total;
          }
          
          completedRequests++;
        },
        error: (error: Error) => {
          console.error(`Erro ao carregar estatísticas para ${status}:`, error);
          completedRequests++;
        }
      });
    });
  }

  onStatusFilterChange(status: OrderStatus | 'all'): void {
    this.selectedStatus = status;
    this.currentPage = 0;
    
    // Se mudar para 'pending' ou 'processing', usar os dados do Observable do OrderPollingService
    // O Observable já atualiza automaticamente através da subscription no ngOnInit
    if (status === 'pending' || status === 'processing') {
      // Filtrar pedidos de acordo com o status selecionado
      if (status === 'pending') {
        this.orders = this.pedidos.filter(order => order.status === 'pending');
      } else if (status === 'processing') {
        this.orders = this.pedidos.filter(order => order.status === 'processing');
      }
      this.totalItems = this.orders.length;
      this.loading = false;
    } else {
      // Para outros status, usar busca HTTP tradicional
      this.loadOrders();
    }
    
    // Recarregar estatísticas quando mudar o filtro
    this.loadStats();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 0;
    this.loadOrders();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadOrders();
  }

  showDetails(order: Order): void {
    this.dialog.open(OrderDetailsDialogComponent, {
      data: {
        order,
        getStatusColor: this.getStatusColor.bind(this),
        getStatusLabel: this.getStatusLabel.bind(this),
        formatCurrency: this.formatCurrency.bind(this),
        formatDate: this.formatDate.bind(this),
        printOrder: this.printOrder.bind(this)
      },
      width: '600px'
    });
  }

  quickUpdateStatus(order: Order, newStatus: OrderStatus): void {
    // Atualizar o status localmente imediatamente para feedback visual
    const oldStatus = order.status;
    order.status = newStatus;

    // Chamar o serviço para atualizar no backend
    this.orderService.updateOrderStatus(order.id, newStatus).subscribe({
      next: (updatedOrder) => {
        // Atualizar o objeto order com os dados do servidor
        Object.assign(order, updatedOrder);
        
        // Atualizar o pedido na lista pedidosTodos
        const index = this.pedidosTodos.findIndex(p => p.id === order.id);
        if (index !== -1) {
          this.pedidosTodos[index] = updatedOrder;
        } else {
          // Se não estava na lista, adicionar (caso tenha voltado para pending/processing)
          if (updatedOrder.status === 'pending' || updatedOrder.status === 'processing' || 
              updatedOrder.status === 'preparing' || updatedOrder.status === 'delivering') {
            this.pedidosTodos.push(updatedOrder);
          }
        }

        // Se o status foi alterado para 'completed', adiciona manualmente na lista de concluídos para UI instantânea
        if (newStatus === 'completed') {
          // .unshift() coloca o pedido no topo da lista
          this.pedidosConcluidos.unshift(updatedOrder);
        }

        this.loadStats();
        
        // Re-filtrar as listas para que o pedido "pule" de uma coluna para outra
        // Esta chamada vai remover o pedido das abas ativas
        this.filtrarPedidosPorStatus();
        
        // Mensagem de sucesso personalizada baseada no novo status
        const messages: { [key: string]: string } = {
          'preparing': 'Pedido iniciado para preparo!',
          'delivering': 'Pedido saiu para entrega!',
          'completed': 'Pedido marcado como concluído!'
        };
        const message = messages[newStatus] || 'Status atualizado com sucesso';
        this.snackBar.open(message, 'Fechar', { duration: 3000 });
      },
      error: (error: Error) => {
        // Reverter o status local em caso de erro
        order.status = oldStatus;
        console.error('Erro ao atualizar status:', error);
        this.snackBar.open('Erro ao atualizar status', 'Fechar', { duration: 3000 });
      }
    });
  }

  openManualStatusModal(order: Order): void {
    this.updateStatus(order);
  }

  updateStatus(order: Order): void {
    const dialogRef = this.dialog.open(UpdateOrderStatusDialogComponent, {
      width: '400px',
      data: { currentStatus: order.status }
    });

    dialogRef.afterClosed().subscribe((newStatus?: OrderStatus) => {
      if (newStatus) {
        this.orderService.updateOrderStatus(order.id, newStatus).subscribe({
          next: (updatedOrder) => {
            // Atualizar o objeto order com os dados do servidor
            Object.assign(order, updatedOrder);

            // Se o filtro for 'pending' ou 'processing', atualizar a lista local manualmente
            // pois a subscrição atualizará automaticamente na próxima verificação do OrderPollingService
            if (this.selectedStatus === 'pending' || this.selectedStatus === 'processing') {
              // Remover o pedido atualizado da lista se mudou de status
              this.orders = this.orders.filter(o => o.id !== order.id);
              // Se o novo status corresponde ao filtro atual, adicionar de volta
              if (updatedOrder.status === this.selectedStatus) {
                this.orders.push(updatedOrder);
                // Ordenar por data de criação (mais recentes primeiro)
                this.orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              }
              this.totalItems = this.orders.length;
            } else {
              // Para outros status, usar busca HTTP tradicional
              this.loadOrders();
            }
            this.loadStats();
            this.snackBar.open('Status atualizado com sucesso', 'Fechar', { duration: 3000 });
          },
          error: (error: Error) => {
            console.error('Erro ao atualizar status:', error);
            this.snackBar.open('Erro ao atualizar status', 'Fechar', { duration: 3000 });
          }
        });
      }
    });
  }

  printOrder(order: Order): void {
    this.printService.printOrder(order);
  }

  getStatusColor(order: Order): string {
    // Pega o método de pagamento (com segurança)
    const payment = order.payment || [];
    const paymentMethod = Array.isArray(payment) 
      ? payment[0]?.payment_method 
      : payment?.payment_method;

    switch (order.status) {
      case 'pending':
        if (paymentMethod === 'pix') {
          return '#757575'; // Cinza para "Aguardando PIX"
        }
        return '#ff9800'; // Laranja para "Pendente (Preparar)"
      
      case 'processing':
        return '#9c27b0'; // Roxo para "PIX Aprovado"
      
      case 'preparing':
        return '#007bff'; // Azul para "Em Preparo"
      
      case 'delivering':
        return '#2196f3'; // Azul para "Em Entrega"
      
      case 'completed':
        return '#4caf50'; // Verde para "Concluído"
      
      case 'cancelled':
        return '#f44336'; // Vermelho para "Cancelado"
      
      default:
        return '#757575'; // Cinza como fallback
    }
  }

  getStatusLabel(order: Order): string {
    if (!order || !order.status) {
      return 'Status inválido';
    }

    // Pega o método de pagamento (com segurança)
    const payment = order.payment || [];
    const paymentMethod = Array.isArray(payment) 
      ? payment[0]?.payment_method 
      : payment?.payment_method;

    switch (order.status) {
      case 'pending':
        if (paymentMethod === 'pix') {
          return 'Aguardando PIX'; // PIX ainda não pago
        }
        return 'Pendente (Preparar)'; // Dinheiro ou Cartão na Entrega

      case 'processing':
        return 'PIX Aprovado'; // PIX foi pago

      case 'preparing':
        return 'Em Preparo';

      case 'delivering':
        return 'Em Entrega';

      case 'completed':
        return 'Concluído';

      case 'cancelled':
        return 'Cancelado';

      default:
        return order.status;
    }
  }

  // Métodos computados para contagem de pedidos por status
  getPendingCount(): number {
    return this.stats.pending;
  }

  getProcessingCount(): number {
    return this.stats.processing;
  }

  getDeliveringCount(): number {
    return this.stats.delivering;
  }

  getCompletedCount(): number {
    return this.stats.completed;
  }

  getCancelledCount(): number {
    return this.stats.cancelled;
  }

  formatCurrency(value: number): string {
    if (value === null || value === undefined) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(date: string): string {
    if (!date) {
      return 'Data inválida';
    }
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

}