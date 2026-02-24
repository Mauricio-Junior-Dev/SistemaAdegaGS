import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { interval, Subscription } from 'rxjs';
import { skip, switchMap } from 'rxjs/operators';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/order.model';
import { OrderDetailsDialogComponent } from './dialogs/order-details-dialog.component';
import { PixPaymentDialogComponent } from './dialogs/pix-payment-dialog.component';
import { OrderStatusTrackerComponent } from '../../../shared/components/order-status-tracker/order-status-tracker.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-orders-list',
  templateUrl: './orders-list.component.html',
  styleUrls: ['./orders-list.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    OrderStatusTrackerComponent
  ]
})
export class OrdersListComponent implements OnInit, OnDestroy {
  private static readonly POLLING_INTERVAL_MS = 30000;
  orders: Order[] = [];
  loading = true;
  error: string | null = null;
  private countdownInterval?: ReturnType<typeof setInterval>;
  private pollingSubscription?: Subscription;

  constructor(
    private orderService: OrderService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.startCountdown();
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.pollingSubscription?.unsubscribe();
  }

  /**
   * Polling a cada 30s (após o primeiro intervalo). Atualiza a lista em background e avisa se algum status mudou.
   */
  private startPolling(): void {
    this.pollingSubscription = interval(OrdersListComponent.POLLING_INTERVAL_MS).pipe(
      skip(1),
      switchMap(() => this.orderService.getOrders())
    ).subscribe({
      next: (newOrders) => this.onOrdersRefreshed(newOrders),
      error: () => { /* silencioso: não altera loading/error na tela */ }
    });
  }

  /**
   * Compara pedidos novos com os atuais; se algum status mudou, exibe toast e atualiza a lista.
   */
  private onOrdersRefreshed(newOrders: Order[]): void {
    const oldMap = new Map(this.orders.map(o => [o.id, o.status]));
    const hasStatusChange = newOrders.some(o => oldMap.get(o.id) !== o.status);
    this.orders = newOrders;
    this.startCountdown();
    this.cdr.detectChanges();
    if (hasStatusChange) {
      this.snackBar.open('Seu pedido foi atualizado!', 'Fechar', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
        this.startCountdown();
      },
      error: (error) => {
        this.error = error.error?.message || 'Erro ao carregar pedidos';
        this.loading = false;
      }
    });
  }

  /** Atualizar agora (botão manual). */
  refreshNow(): void {
    this.loadOrders();
  }

  startCountdown(): void {
    // Limpar intervalo anterior se existir
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Atualizar contador a cada segundo
    this.countdownInterval = setInterval(() => {
      // Forçar detecção de mudanças para atualizar a UI
      this.cdr.detectChanges();
    }, 1000);
  }

  getTimeRemaining(expiresAt: string | undefined): string {
    if (!expiresAt) return '';
    
    const now = new Date().getTime();
    const expiration = new Date(expiresAt).getTime();
    const diff = expiration - now;

    if (diff <= 0) {
      return 'Expirado';
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  isPixExpired(expiresAt: string | undefined): boolean {
    if (!expiresAt) return false;
    const now = new Date().getTime();
    const expiration = new Date(expiresAt).getTime();
    return expiration <= now;
  }

  getPayment(order: Order): any {
    if (order.payment) {
      if (Array.isArray(order.payment) && order.payment.length > 0) {
        return order.payment[0];
      } else if (!Array.isArray(order.payment)) {
        return order.payment;
      }
    }
    if (order.payments && order.payments.length > 0) {
      return order.payments[0];
    }
    return null;
  }

  isPixPending(order: Order): boolean {
    const payment = this.getPayment(order);
    if (!payment) return false;
    
    const paymentMethod = payment.payment_method?.toLowerCase();
    const isPix = paymentMethod === 'pix';
    const isPending = order.status === 'pending' || order.status === 'pending_pix';
    const notExpired = !this.isPixExpired(payment.expires_at);
    
    return isPending && isPix && notExpired;
  }

  openPixModal(order: Order): void {
    const payment = this.getPayment(order);
    if (!payment || !payment.qr_code) {
      this.snackBar.open('QR Code não disponível para este pedido', 'Fechar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.dialog.open(PixPaymentDialogComponent, {
      data: {
        qrCode: payment.qr_code,
        expiresAt: payment.expires_at
      },
      width: '500px',
      maxHeight: '90vh'
    });
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendente',
      'processing': 'PIX Aprovado',
      'preparing': 'Em Preparo',
      'delivering': 'Saiu para Entrega',
      'paid': 'Pago',
      'shipped': 'Enviado',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado',
      'canceled': 'Cancelado',
      'refunded': 'Reembolsado',
      'completed': 'Concluído'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const classMap: { [key: string]: string } = {
      'pending': 'status-pending',
      'processing': 'status-processing',
      'preparing': 'status-preparing',
      'delivering': 'status-delivering',
      'paid': 'status-paid',
      'shipped': 'status-shipped',
      'delivered': 'status-delivered',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
      'refunded': 'status-refunded'
    };
    return classMap[status] || 'status-default';
  }

  /**
   * Verifica se o pedido PIX pendente já expirou (passou do tempo).
   * Usado para o banner e para o badge (feedback imediato antes do cron).
   */
  isExpired(order: Order): boolean {
    if (order.status !== 'pending' && order.status !== 'pending_pix') {
      return false;
    }
    return this.isPixExpired(this.getPayment(order)?.expires_at);
  }

  /**
   * Retorna o método de pagamento do pedido (lowercase), alinhado ao backend.
   */
  private getPaymentMethodKey(order: Order): string {
    const payment = this.getPayment(order);
    const method = payment?.payment_method ?? order.payment_method ?? '';
    return String(method).toLowerCase().trim();
  }

  /**
   * True se o pagamento é na entrega (dinheiro, cartão na entrega, etc.) – não exige pagamento antecipado.
   */
  private isOfflinePaymentMethod(order: Order): boolean {
    const key = this.getPaymentMethodKey(order);
    const offlineKeys = [
      'dinheiro', 'cash', 'money', 'dinero',
      'cartão de débito', 'cartao de debito', 'cartão de crédito', 'cartao de credito',
      'credit_card', 'debit_card', 'card_delivery', 'cartão', 'cartao'
    ];
    return offlineKeys.some(k => key === k || key.includes(k));
  }

  /**
   * Classe do badge: danger (cancelado/expirado), warning (PIX aguardando), info (offline aguardando confirmação).
   */
  getBadgeClass(order: Order): string {
    if (order.status === 'cancelled' || order.status === 'canceled') {
      return 'badge-danger';
    }
    if (order.status === 'pending' || order.status === 'pending_pix') {
      if (this.isExpired(order)) {
        return 'badge-danger';
      }
      if (this.isOfflinePaymentMethod(order)) {
        return 'badge-info';
      }
      return 'badge-warning';
    }
    return this.getStatusClass(order.status);
  }

  /**
   * Label do badge: distingue PIX (online) de pagamento na entrega (offline).
   */
  getBadgeLabel(order: Order): string {
    if (order.status === 'cancelled' || order.status === 'canceled') {
      return 'Cancelado';
    }
    if (order.status === 'pending' || order.status === 'pending_pix') {
      const method = this.getPaymentMethodKey(order);
      if (method === 'pix') {
        return this.isExpired(order) ? 'Expirado' : 'Aguardando Pagamento';
      }
      if (this.isOfflinePaymentMethod(order)) {
        return 'Aguardando Confirmação';
      }
      return 'Aguardando Pagamento';
    }
    return this.getStatusLabel(order.status);
  }

  /** @deprecated Use getBadgeClass. Mantido para compatibilidade. */
  getStatusClassForOrder(order: Order): string {
    return this.getBadgeClass(order);
  }

  /** @deprecated Use getBadgeLabel. Mantido para compatibilidade. */
  getStatusLabelForOrder(order: Order): string {
    return this.getBadgeLabel(order);
  }

  getPaymentMethodLabel(order: any): string {
    // Tenta diferentes propriedades para encontrar o método de pagamento
    let method = '';
    
    // Primeiro tenta o payment_method direto do order
    if (order.payment_method) {
      method = order.payment_method;
    }
    // Depois tenta o payment_method do objeto payment (pode ser array ou objeto)
    else if (order.payment) {
      if (Array.isArray(order.payment) && order.payment.length > 0) {
        // Se é array, pega o primeiro payment
        method = order.payment[0].payment_method;
      } else if (!Array.isArray(order.payment)) {
        // Se é objeto único
        method = order.payment.payment_method;
      }
    }
    // Tenta payments (array)
    else if (order.payments && order.payments.length > 0) {
      method = order.payments[0].payment_method;
    }

    // Mapeia os métodos de pagamento para labels mais amigáveis
    const methodMap: { [key: string]: string } = {
      'pix': 'PIX',
      'cash': 'Dinheiro',
      'dinheiro': 'Dinheiro',
      'card': 'Cartão',
      'cartao': 'Cartão',
      'cartão': 'Cartão',
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito',
      'credit': 'Cartão de Crédito',
      'debit': 'Cartão de Débito'
    };
    
    return methodMap[method?.toLowerCase()] || method || 'Não informado';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  showOrderDetails(order: Order): void {
    const dialogRef = this.dialog.open(OrderDetailsDialogComponent, {
      data: {
        order,
        getBadgeClass: this.getBadgeClass.bind(this),
        getBadgeLabel: this.getBadgeLabel.bind(this),
        getStatusLabel: this.getStatusLabel.bind(this),
        getStatusClass: this.getStatusClass.bind(this),
        getPaymentMethodLabel: this.getPaymentMethodLabel.bind(this),
        formatDate: this.formatDate.bind(this),
        formatCurrency: this.formatCurrency.bind(this),
        getUnitPrice: this.getUnitPrice.bind(this),
        getItemSubtotal: this.getItemSubtotal.bind(this),
        confirmDelivery: (orderId: number) => {
          this.orderService.confirmDelivery(orderId).subscribe({
            next: (updatedOrder) => {
              // Atualiza o pedido na lista local
              const index = this.orders.findIndex(o => o.id === orderId);
              if (index !== -1) {
                this.orders[index] = updatedOrder;
              }
              // Atualiza o pedido no dialog
              if (dialogRef.componentInstance) {
                dialogRef.componentInstance.data.order = updatedOrder;
                dialogRef.componentInstance.confirming = false;
              }
              // Recarrega a lista de pedidos para garantir sincronização
              this.loadOrders();
            },
            error: (error) => {
              console.error('Erro ao confirmar entrega:', error);
              alert('Erro ao confirmar entrega. Tente novamente.');
              if (dialogRef.componentInstance) {
                dialogRef.componentInstance.confirming = false;
              }
            }
          });
        }
      },
      width: '600px',
      maxHeight: '90vh'
    });
  }

  getUnitPrice(item: any): number {
    // Tenta diferentes propriedades que podem conter o preço unitário
    if (item.unit_price) {
      return item.unit_price;
    }
    if (item.price) {
      return item.price;
    }
    if (item.total_price && item.quantity) {
      return item.total_price / item.quantity;
    }
    if (item.product?.price) {
      return item.product.price;
    }
    return 0;
  }

  getItemSubtotal(item: any): number {
    // Tenta diferentes propriedades que podem conter o subtotal
    if (item.total_price) {
      return item.total_price;
    }
    if (item.subtotal) {
      return item.subtotal;
    }
    if (item.price && item.quantity) {
      return item.price * item.quantity;
    }
    if (item.unit_price && item.quantity) {
      return item.unit_price * item.quantity;
    }
    return 0;
  }

  confirmarEntrega(order: Order): void {
    const confirmado = confirm('Você confirma que recebeu seu pedido?');

    if (confirmado) {
      this.orderService.confirmDelivery(order.id).subscribe({
        next: (updatedOrder) => {
          // Atualiza o status localmente para a UI reagir
          order.status = updatedOrder.status;
          // Atualiza também o objeto completo na lista
          const index = this.orders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            this.orders[index] = updatedOrder;
          }
          this.snackBar.open('Pedido confirmado com sucesso!', 'Fechar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: (err) => {
          console.error('Erro ao confirmar entrega:', err);
          this.snackBar.open('Erro ao confirmar o pedido. Tente novamente.', 'Fechar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    }
  }

  openWhatsAppHelp(order: Order): void {
    const phoneNumber = environment.whatsappNumber;

    // Mensagem pré-pronta
    const message = `Olá! Preciso de ajuda com o meu pedido Nº ${order.order_number}.`;

    // Codifica a mensagem para a URL
    const encodedMessage = encodeURIComponent(message);

    // Cria a URL do WhatsApp
    const url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    // Abre em uma nova aba
    window.open(url, '_blank');
  }
}

