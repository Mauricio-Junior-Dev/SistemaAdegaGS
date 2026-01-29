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
    <h2 mat-dialog-title class="dialog-title-with-badge">
      <span>Acompanhamento do Pedido #{{data.order.order_number}}</span>
      <mat-chip *ngIf="data.getBadgeClass && data.getBadgeLabel" [class]="data.getBadgeClass(data.order)" class="badge-chip">
        {{ data.getBadgeLabel(data.order) }}
      </mat-chip>
    </h2>
    <mat-dialog-content>
      <mat-card class="order-details-card">
        <!-- Barra de Status Dinâmica -->
        <mat-card-header>
          <mat-card-title>
            <div class="status-progress-container">
              <div class="status-steps">
                <!-- Etapa 1: Pendente -->
                <div class="status-step" [ngClass]="{
                  'completed': isStepCompleted('pending'),
                  'active': isStepActive('pending')
                }">
                  <div class="step-circle">
                    <mat-icon *ngIf="isStepCompleted('pending')">check</mat-icon>
                    <span *ngIf="!isStepCompleted('pending')" class="step-number">1</span>
                  </div>
                  <span class="step-label">Pendente</span>
                </div>

                <!-- Linha conectora -->
                <div class="step-connector" [ngClass]="{'completed': isStepCompleted('preparing')}"></div>

                <!-- Etapa 2: Em Preparo -->
                <div class="status-step" [ngClass]="{
                  'completed': isStepCompleted('preparing'),
                  'active': isStepActive('preparing')
                }">
                  <div class="step-circle">
                    <mat-icon *ngIf="isStepCompleted('preparing')">check</mat-icon>
                    <span *ngIf="!isStepCompleted('preparing')" class="step-number">2</span>
                  </div>
                  <span class="step-label">Em Preparo</span>
                </div>

                <!-- Linha conectora -->
                <div class="step-connector" [ngClass]="{'completed': isStepCompleted('delivering')}"></div>

                <!-- Etapa 3: Em Entrega -->
                <div class="status-step" [ngClass]="{
                  'completed': isStepCompleted('delivering'),
                  'active': isStepActive('delivering')
                }">
                  <div class="step-circle">
                    <mat-icon *ngIf="isStepCompleted('delivering')">check</mat-icon>
                    <span *ngIf="!isStepCompleted('delivering')" class="step-number">3</span>
                  </div>
                  <span class="step-label">Em Entrega</span>
                </div>

                <!-- Linha conectora -->
                <div class="step-connector" [ngClass]="{'completed': isStepCompleted('completed')}"></div>

                <!-- Etapa 4: Concluído -->
                <div class="status-step" [ngClass]="{
                  'completed': isStepCompleted('completed'),
                  'active': isStepActive('completed')
                }">
                  <div class="step-circle">
                    <mat-icon *ngIf="isStepCompleted('completed')">check</mat-icon>
                    <span *ngIf="!isStepCompleted('completed')" class="step-number">4</span>
                  </div>
                  <span class="step-label">Concluído</span>
                </div>
              </div>
            </div>
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <!-- Informações do Pedido -->
          <div class="section">
            <h3>Informações do Pedido</h3>
            <p><strong>Número:</strong> #{{data.order.order_number}}</p>
            <p><strong>Data:</strong> {{data.formatDate(data.order.created_at || '')}}</p>
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
            <p>
              <strong>Subtotal:</strong>
              {{data.formatCurrency((data.order.total || 0) - (data.order.delivery_fee || 0))}}
            </p>
            <p>
              <strong>Frete:</strong>
              {{data.formatCurrency(data.order.delivery_fee || 0)}}
            </p>
            <p class="total">
              <strong>Total:</strong>
              {{data.formatCurrency(data.order.total || 0)}}
            </p>
          </div>

          <mat-divider></mat-divider>

          <!-- Endereço de Entrega -->
          <div class="section">
            <h3>Endereço de Entrega</h3>
            <div class="address-details" *ngIf="data.order.delivery_address; else noAddress">
              <p><strong>Endereço:</strong> {{data.order.delivery_address.street}}, {{data.order.delivery_address.number}}</p>
              <p *ngIf="data.order.delivery_address.complement"><strong>Complemento:</strong> {{data.order.delivery_address.complement}}</p>
              <p><strong>Bairro:</strong> {{data.order.delivery_address.neighborhood}}</p>
              <p><strong>Cidade:</strong> {{data.order.delivery_address.city}}/{{data.order.delivery_address.state}}</p>
              <p><strong>CEP:</strong> {{data.order.delivery_address.zipcode}}</p>
              <p *ngIf="data.order.delivery_address.name"><strong>Nome do Endereço:</strong> {{data.order.delivery_address.name}}</p>
              <p *ngIf="data.order.delivery_address.notes"><strong>Observações do Endereço:</strong> {{data.order.delivery_address.notes}}</p>
              <p *ngIf="data.order.delivery_notes"><strong>Observações do Pedido:</strong> {{data.order.delivery_notes}}</p>
            </div>
            <ng-template #noAddress>
              <div class="no-address">
                <p>Nenhum endereço de entrega informado</p>
              </div>
            </ng-template>
          </div>
        </mat-card-content>
      </mat-card>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button 
              color="success" 
              *ngIf="data.order.status === 'delivering'"
              (click)="confirmarEntrega()"
              [disabled]="confirming">
        <mat-icon>check_circle</mat-icon>
        {{confirming ? 'Confirmando...' : 'Confirmar Recebimento'}}
      </button>
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

    .no-address {
      color: #999;
      font-style: italic;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      text-align: center;
    }

    /* Badge de status no título (vermelho = cancelado/expirado, amarelo = aguardando) */
    .dialog-title-with-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .badge-chip {
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-danger {
      background-color: #dc3545 !important;
      color: #fff !important;
    }
    .badge-warning {
      background-color: #ffc107 !important;
      color: #212529 !important;
    }
    .badge-info {
      background-color: #0dcaf0 !important;
      color: #000 !important;
    }

    /* Estilos da Barra de Status */
    .status-progress-container {
      width: 100%;
      margin: 20px 0;
    }

    .status-steps {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      padding: 20px 0;
    }

    .status-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
    }

    .step-circle {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: #e0e0e0;
      border: 3px solid #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      transition: all 0.3s ease;
      position: relative;
      z-index: 2;
    }

    .step-number {
      font-weight: bold;
      color: #999;
      font-size: 18px;
    }

    .status-step.active .step-circle {
      background-color: #2196f3;
      border-color: #2196f3;
      box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.2);
    }

    .status-step.active .step-number {
      color: white;
    }

    .status-step.completed .step-circle {
      background-color: #4caf50;
      border-color: #4caf50;
    }

    .status-step.completed .step-circle mat-icon {
      color: white;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .step-label {
      font-size: 12px;
      color: #666;
      text-align: center;
      font-weight: 500;
      transition: color 0.3s ease;
    }

    .status-step.active .step-label {
      color: #2196f3;
      font-weight: 600;
    }

    .status-step.completed .step-label {
      color: #4caf50;
    }

    .step-connector {
      flex: 1;
      height: 3px;
      background-color: #e0e0e0;
      margin: 0 10px;
      margin-top: -35px;
      transition: background-color 0.3s ease;
      position: relative;
      z-index: 1;
    }

    .step-connector.completed {
      background-color: #4caf50;
    }

    mat-dialog-actions {
      margin-top: 20px;
    }

    mat-dialog-actions button[color="success"] {
      margin-right: 10px;
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
  confirming = false;

  constructor(
    public dialogRef: MatDialogRef<OrderDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      order: Order;
      getBadgeClass?: (order: Order) => string;
      getBadgeLabel?: (order: Order) => string;
      getStatusLabel: (status: string) => string;
      getStatusClass: (status: string) => string;
      getPaymentMethodLabel: (order: any) => string;
      formatDate: (date: string) => string;
      formatCurrency: (value: number) => string;
      getUnitPrice: (item: any) => number;
      getItemSubtotal: (item: any) => number;
      confirmDelivery?: (orderId: number) => void;
    }
  ) {}

  isStepCompleted(step: string): boolean {
    const status = this.data.order.status;
    
    switch (step) {
      case 'pending':
        // Pendente está concluído quando o pedido passou desta etapa
        return status !== 'pending';
      case 'preparing':
        // Em Preparo está concluído quando o pedido está em entrega ou concluído
        return status === 'preparing' || status === 'delivering' || status === 'completed';
      case 'delivering':
        // Em Entrega está concluído quando o pedido está concluído
        return status === 'completed';
      case 'completed':
        // Concluído só está concluído quando o status é completed
        return status === 'completed';
      default:
        return false;
    }
  }

  isStepActive(step: string): boolean {
    const status = this.data.order.status;
    
    switch (step) {
      case 'pending':
        return status === 'pending';
      case 'preparing':
        // Status "processing" ou "preparing" significa que o pedido está em preparo
        return status === 'processing' || status === 'preparing';
      case 'delivering':
        return status === 'delivering';
      case 'completed':
        return status === 'completed';
      default:
        return false;
    }
  }

  confirmarEntrega(): void {
    const confirmado = confirm('Você confirma que recebeu seu pedido?');
    
    if (confirmado && this.data.confirmDelivery) {
      this.confirming = true;
      this.data.confirmDelivery(this.data.order.id);
    }
  }
}
