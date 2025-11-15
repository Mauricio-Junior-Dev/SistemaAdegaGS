import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/order.model';
import { OrderDetailsDialogComponent } from './dialogs/order-details-dialog.component';
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
    OrderStatusTrackerComponent
  ]
})
export class OrdersListComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private orderService: OrderService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;

    console.log('OrdersListComponent: Loading orders...');

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        console.log('OrdersListComponent: Orders received:', orders);
        this.orders = orders;
        this.loading = false;
      },
      error: (error) => {
        console.error('OrdersListComponent: Error loading orders:', error);
        this.error = error.error?.message || 'Erro ao carregar pedidos';
        this.loading = false;
      }
    });
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendente',
      'processing': 'PIX Aprovado',
      'preparing': 'Em Preparo',
      'delivering': 'Em Entrega',
      'paid': 'Pago',
      'shipped': 'Enviado',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado',
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

