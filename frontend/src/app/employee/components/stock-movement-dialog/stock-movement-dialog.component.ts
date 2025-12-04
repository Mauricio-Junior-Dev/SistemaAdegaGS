import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Product } from '../../../core/models/product.model';

interface DialogData {
  product: Product;
}

@Component({
  selector: 'app-stock-movement-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title>Movimentação de Estoque</h2>
    <mat-dialog-content>
      <div class="product-info">
        <h3>{{data.product.name}}</h3>
        <p class="stock">Estoque atual: {{data.product.current_stock}}</p>
        <p class="min-stock">Estoque mínimo: {{data.product.min_stock}}</p>
      </div>

      <form #movementForm="ngForm">
        <mat-form-field appearance="outline">
          <mat-label>Tipo de Movimentação</mat-label>
          <mat-select [(ngModel)]="movement.type" name="type" required>
            <mat-option value="entrada">Entrada</mat-option>
            <mat-option value="saida">Saída</mat-option>
            <mat-option value="ajuste">Ajuste</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Quantidade</mat-label>
          <input matInput 
                 type="number" 
                 [(ngModel)]="movement.quantity" 
                 name="quantity" 
                 required 
                 min="1"
                 [max]="movement.type === 'saida' ? data.product.current_stock : null">
          <mat-error *ngIf="movement.type === 'saida' && movement.quantity > data.product.current_stock">
            Quantidade não pode ser maior que o estoque atual
          </mat-error>
        </mat-form-field>


        <mat-form-field appearance="outline">
          <mat-label>Descrição</mat-label>
          <textarea matInput 
                    [(ngModel)]="movement.description" 
                    name="description" 
                    rows="3"
                    required
                    placeholder="Descreva o motivo da movimentação"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button 
              color="primary"
              [disabled]="!isValid()"
              (click)="onConfirm()">
        Confirmar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .product-info {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }
    .product-info h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }
    .stock, .min-stock {
      margin: 5px 0;
      font-weight: 500;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    mat-form-field {
      width: 100%;
    }
  `]
})
export class StockMovementDialogComponent {
  movement = {
    type: 'entrada',
    quantity: 1,
    description: ''
  };

  constructor(
    public dialogRef: MatDialogRef<StockMovementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  isValid(): boolean {
    if (!this.movement.type || !this.movement.quantity || !this.movement.description) {
      return false;
    }

    if (this.movement.type === 'saida' && this.movement.quantity > this.data.product.current_stock) {
      return false;
    }

    return true;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.isValid()) {
      this.dialogRef.close(this.movement);
    }
  }
}