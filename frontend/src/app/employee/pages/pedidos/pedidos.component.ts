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
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, Observable, combineLatest, map } from 'rxjs';

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
    FormsModule
  ]
})
export class PedidosComponent implements OnInit, OnDestroy {
  // Observable para pedidos pendentes (atualizado automaticamente pelo OrderPollingService)
  public pedidos$!: Observable<Order[]>;
  
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
    delivering: 0,
    completed: 0,
    cancelled: 0
  };
  
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

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
    this.pedidos$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(pendingOrders => {
      // Atualizar apenas se o filtro estiver em 'processing'
      if (this.selectedStatus === 'processing') {
        this.orders = pendingOrders;
        this.totalItems = pendingOrders.length;
        this.loading = false;
      }
    });
    
    // Para outros status, usa a busca HTTP tradicional
    // Para 'processing', o Observable do OrderPollingService já fornece os dados automaticamente
    if (this.selectedStatus !== 'processing') {
      this.loadOrders();
    } else {
      // Quando for 'processing', o loading será desativado quando o Observable emitir os dados
      // O OrderPollingService já busca os dados a cada 10 segundos e atualiza o BehaviorSubject
    }
    
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Método removido: A impressão automática agora é feita pelo OrderPollingService
  // que roda globalmente quando o funcionário está logado

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
    const statuses: (OrderStatus | 'all')[] = ['all', 'pending', 'processing', 'delivering', 'completed', 'cancelled'];
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
    
    // Se mudar para 'processing', usar o Observable do OrderPollingService
    // O Observable já atualiza automaticamente através da subscription no ngOnInit
    // Caso contrário, usar busca HTTP tradicional
    if (status !== 'processing') {
      this.loadOrders();
    }
    // Se for 'processing', a subscription já atualiza a lista automaticamente
    
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

  updateStatus(order: Order): void {
    const dialogRef = this.dialog.open(UpdateOrderStatusDialogComponent, {
      width: '400px',
      data: { currentStatus: order.status }
    });

    dialogRef.afterClosed().subscribe((newStatus?: OrderStatus) => {
      if (newStatus) {
        this.orderService.updateOrderStatus(order.id, newStatus).subscribe({
          next: (updatedOrder) => {
            // Recarregar a lista e estatísticas para garantir consistência
            this.loadOrders();
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

  getStatusColor(status: OrderStatus): string {
    const colors = {
      pending: '#ff9800',      // Laranja
      processing: '#9c27b0',   // Roxo
      delivering: '#2196f3',   // Azul
      completed: '#4caf50',    // Verde
      cancelled: '#f44336'     // Vermelho
    };
    return colors[status] || '#757575'; // Cinza como fallback
  }

  getStatusLabel(status: OrderStatus): string {
    if (!status) {
      return 'Status inválido';
    }
    const labels = {
      pending: 'Pendente',
      processing: 'Em Processamento',
      delivering: 'Em Entrega',
      completed: 'Concluído',
      cancelled: 'Cancelado'
    };
    return labels[status] || 'Status desconhecido';
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