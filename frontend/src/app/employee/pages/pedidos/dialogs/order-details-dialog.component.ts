import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Order, OrderStatus } from '../../../services/order.service';

@Component({
  selector: 'app-order-details-dialog',
  template: `
    <h2 mat-dialog-title>Detalhes do Pedido #{{data.order.order_number}}</h2>
    <mat-dialog-content>
      <!-- Status -->
      <div class="status-section">
        <mat-chip [style.background-color]="data.getStatusColor(data.order.status)"
                 [style.color]="'white'">
          {{data.getStatusLabel(data.order.status)}}
        </mat-chip>
      </div>

      <!-- Cliente -->
      <div class="section">
        <h3>Cliente</h3>
        <p><strong>Nome:</strong> {{data.order.user.name}}</p>
        <p><strong>Email:</strong> {{data.order.user.email}}</p>
        <p *ngIf="data.order.user.phone"><strong>Telefone:</strong> {{data.order.user.phone}}</p>
      </div>

      <!-- Endereço de Entrega -->
      <div class="section" *ngIf="data.order.delivery_address">
        <h3>Endereço de Entrega</h3>
        <div class="address-details">
          <p><strong>Endereço:</strong> {{data.order.delivery_address.street}}, {{data.order.delivery_address.number}}</p>
          <p *ngIf="data.order.delivery_address.complement"><strong>Complemento:</strong> {{data.order.delivery_address.complement}}</p>
          <p><strong>Bairro:</strong> {{data.order.delivery_address.neighborhood}}</p>
          <p><strong>Cidade:</strong> {{data.order.delivery_address.city}}/{{data.order.delivery_address.state}}</p>
          <p><strong>CEP:</strong> {{data.order.delivery_address.zipcode}}</p>
          <p *ngIf="data.order.delivery_address.name"><strong>Nome do Endereço:</strong> {{data.order.delivery_address.name}}</p>
          <p *ngIf="data.order.delivery_address.notes"><strong>Observações:</strong> {{data.order.delivery_address.notes}}</p>
          <p *ngIf="data.order.delivery_notes"><strong>Observações do Pedido:</strong> {{data.order.delivery_notes}}</p>
        </div>
      </div>

      <div class="section" *ngIf="!data.order.delivery_address">
        <h3>Endereço de Entrega</h3>
        <p class="no-address">Nenhum endereço de entrega informado</p>
      </div>

      <mat-divider></mat-divider>

      <!-- Itens -->
      <div class="section">
        <h3>Itens do Pedido</h3>
        <div class="items-list">
          <div *ngFor="let item of data.order.items" class="item">
            <div class="item-details">
              <span class="quantity">{{item.quantity}}x</span>
              <span class="name">{{item.product.name}}</span>
              <span class="price">{{data.formatCurrency(item.price)}}</span>
            </div>
            <div class="subtotal">
              <small>Subtotal: {{data.formatCurrency(item.subtotal)}}</small>
            </div>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Pagamento -->
      <div class="section">
        <h3>Pagamento</h3>
        <p><strong>Método:</strong> {{getPaymentMethod(data.order)}}</p>
        <p><strong>Status:</strong> {{getPaymentStatus(data.order)}}</p>
        <p class="total"><strong>Total:</strong> {{data.formatCurrency(data.order.total)}}</p>
      </div>

      <!-- Datas -->
      <div class="section">
        <h3>Datas</h3>
        <p><strong>Criado em:</strong> {{data.formatDate(data.order.created_at)}}</p>
        <p><strong>Atualizado em:</strong> {{data.formatDate(data.order.updated_at)}}</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Fechar</button>
      <button mat-raised-button 
              color="primary" 
              (click)="data.printOrder(data.order)"
              matTooltip="Imprimir Pedido">
        <mat-icon>print</mat-icon>
        Imprimir
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 600px;
    }
    .section {
      margin: 20px 0;
    }
    .section h3 {
      color: #666;
      margin-bottom: 10px;
    }
    .status-section {
      margin-bottom: 20px;
    }
    .items-list {
      margin: 10px 0;
    }
    .item {
      margin: 10px 0;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }
    .item-details {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .quantity {
      font-weight: bold;
      color: #666;
    }
    .name {
      flex: 1;
    }
    .price {
      color: #666;
    }
    .subtotal {
      margin-top: 5px;
      text-align: right;
      color: #666;
    }
    .total {
      font-size: 1.2em;
      color: #333;
      margin-top: 10px;
    }
    mat-dialog-actions {
      margin-top: 20px;
    }
    
    .address-details {
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      border-left: 4px solid #2196f3;
    }
    
    .address-details p {
      margin: 4px 0;
    }
    
    .no-address {
      color: #999;
      font-style: italic;
    }
  `],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule
  ]
})
export class OrderDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<OrderDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      order: Order;
      getStatusColor: (status: OrderStatus) => string;
      getStatusLabel: (status: OrderStatus) => string;
      formatCurrency: (value: number) => string;
      formatDate: (date: string) => string;
      printOrder: (order: Order) => void;
    }
  ) {}

  getPaymentMethod(order: Order): string {
    // Primeiro tenta o payment_method direto do order
    if (order.payment_method) {
      return this.formatPaymentMethod(order.payment_method);
    }
    
    // Depois tenta o payment_method do objeto payment (pode ser array ou objeto)
    if (order.payment) {
      if (Array.isArray(order.payment) && order.payment.length > 0) {
        // Se é array, pega o primeiro payment
        return this.formatPaymentMethod(order.payment[0].payment_method);
      } else if (!Array.isArray(order.payment)) {
        // Se é objeto único
        return this.formatPaymentMethod(order.payment.payment_method);
      }
    }
    
    return 'Não informado';
  }

  getPaymentStatus(order: Order): string {
    // Tenta o status do objeto payment (pode ser array ou objeto)
    if (order.payment) {
      if (Array.isArray(order.payment) && order.payment.length > 0) {
        // Se é array, pega o primeiro payment
        return this.formatPaymentStatus(order.payment[0].status);
      } else if (!Array.isArray(order.payment)) {
        // Se é objeto único
        return this.formatPaymentStatus(order.payment.status);
      }
    }
    
    return 'Não informado';
  }

  private formatPaymentMethod(method: string): string {
    const methods: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'cartao': 'Cartão',
      'pix': 'PIX',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito'
    };
    return methods[method] || method;
  }

  private formatPaymentStatus(status: string): string {
    const statuses: { [key: string]: string } = {
      'pending': 'Pendente',
      'paid': 'Pago',
      'failed': 'Falhou',
      'refunded': 'Reembolsado'
    };
    return statuses[status] || status;
  }
}