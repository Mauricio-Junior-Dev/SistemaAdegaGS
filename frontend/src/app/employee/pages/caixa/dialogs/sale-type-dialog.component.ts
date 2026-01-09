import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../../../core/models/product.model';

export interface SaleTypeResult {
  price: number;
  type: 'balcao' | 'entrega';
}

@Component({
  selector: 'app-sale-type-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Escolha o Tipo de Venda</h2>
    <mat-dialog-content>
      <div class="dialog-content">
        <p class="product-name">{{ data.product.name }}</p>
        
        <div class="options">
          <button mat-raised-button 
                  color="primary" 
                  class="option-button balcao"
                  (click)="selectBalcao()">
            <mat-icon>store</mat-icon>
            <div class="button-content">
              <span class="label">Balcão/Retirada</span>
              <span class="price">{{ formatCurrency(data.product.price) }}</span>
            </div>
          </button>
          
          <button mat-raised-button 
                  color="accent" 
                  class="option-button entrega"
                  (click)="selectEntrega()">
            <mat-icon>local_shipping</mat-icon>
            <div class="button-content">
              <span class="label">Entrega</span>
              <span class="price">{{ formatCurrency(data.product.delivery_price!) }}</span>
            </div>
          </button>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancelar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      padding: 16px 0;
      min-width: 300px;
    }

    .product-name {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 24px;
      text-align: center;
      color: #333;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .option-button {
      width: 100%;
      height: auto;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      justify-content: flex-start;
    }

    .option-button mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .button-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      flex: 1;
    }

    .label {
      font-size: 16px;
      font-weight: 500;
    }

    .price {
      font-size: 18px;
      font-weight: bold;
      color: #fff;
    }

    .balcao {
      background-color: #673ab7 !important;
    }

    .entrega {
      background-color: #ff9800 !important;
    }
  `]
})
export class SaleTypeDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SaleTypeDialogComponent, SaleTypeResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {}

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  selectBalcao(): void {
    this.dialogRef.close({
      price: this.data.product.price,
      type: 'balcao'
    });
  }

  selectEntrega(): void {
    if (this.data.product.delivery_price) {
      this.dialogRef.close({
        price: this.data.product.delivery_price,
        type: 'entrega'
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
