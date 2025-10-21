import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { Order } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-details-dialog',
  template: `
    <h2 mat-dialog-title>Detalhes do Pedido #{{data.order.order_number}}</h2>
    <mat-dialog-content>
      <mat-card class="order-details-card">
        <!-- Status -->
        <mat-card-header>
          <mat-card-title>
            <mat-chip [class]="data.getStatusClass(data.order.status)">
              {{data.getStatusLabel(data.order.status)}}
            </mat-chip>
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <!-- Informações do Pedido -->
          <div class="section">
            <h3>Informações do Pedido</h3>
            <p><strong>Número:</strong> #{{data.order.order_number}}</p>
            <p><strong>Data:</strong> {{data.formatDate(data.order.created_at || '')}}</p>
            <p><strong>Status:</strong> {{data.getStatusLabel(data.order.status)}}</p>
          </div>

          <mat-divider></mat-divider>

          <!-- Itens do Pedido -->
          <div class="section">
            <h3>Itens do Pedido</h3>
            <div class="items-list">
              <div *ngFor="let item of data.order.items" class="item-detail">
                <div class="item-header">
                  <span class="quantity">{{item.quantity}}x</span>
                  <span class="name">{{item.product?.name}}</span>
                  <span class="unit-price">{{data.formatCurrency(data.getUnitPrice(item))}} cada</span>
                </div>
                <div class="subtotal">
                  <span>Subtotal: {{data.formatCurrency(data.getItemSubtotal(item))}}</span>
                </div>
              </div>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Pagamento -->
          <div class="section">
            <h3>Pagamento</h3>
            <p><strong>Método:</strong> {{data.getPaymentMethodLabel(data.order)}}</p>
            <p class="total"><strong>Total:</strong> {{data.formatCurrency(data.order.total_amount || data.order.total || 0)}}</p>
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
              <p *ngIf="data.order.notes"><strong>Observações:</strong> {{data.order.notes}}</p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 600px;
    }
    
    .order-details-card {
      margin: 20px 0;
    }
    
    .section {
      margin: 20px 0;
    }
    
    .section h3 {
      color: #666;
      margin-bottom: 10px;
      font-size: 1.1rem;
    }
    
    .items-list {
      margin: 10px 0;
    }
    
    .item-detail {
      margin: 10px 0;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #007bff;
    }
    
    .item-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 8px;
    }
    
    .quantity {
      font-weight: bold;
      color: #007bff;
      min-width: 30px;
    }
    
    .name {
      flex: 1;
      font-weight: 500;
    }
    
    .unit-price {
      color: #28a745;
      font-weight: 500;
    }
    
    .subtotal {
      text-align: right;
      color: #666;
      font-weight: 500;
    }
    
    .total {
      font-size: 1.2em;
      color: #333;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 2px solid #dee2e6;
    }
    
    .address-details {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #28a745;
    }
    
    .address-details p {
      margin: 5px 0;
    }
    
    mat-dialog-actions {
      margin-top: 20px;
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
    MatCardModule
  ]
})
export class OrderDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<OrderDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      order: Order;
      getStatusLabel: (status: string) => string;
      getStatusClass: (status: string) => string;
      getPaymentMethodLabel: (order: any) => string;
      formatDate: (date: string) => string;
      formatCurrency: (value: number) => string;
      getUnitPrice: (item: any) => number;
      getItemSubtotal: (item: any) => number;
    }
  ) {}
}
