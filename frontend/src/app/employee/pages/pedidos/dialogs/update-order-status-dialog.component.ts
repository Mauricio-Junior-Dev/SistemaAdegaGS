import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { OrderStatus } from '../../../services/order.service';

// Componente de confirmação de entrega
@Component({
  selector: 'app-delivery-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div mat-dialog-content class="confirmation-content">
      <div class="warning-icon">
        <mat-icon color="warn" style="font-size: 48px; width: 48px; height: 48px;">warning</mat-icon>
      </div>
      
      <h3>Confirmação de Entrega</h3>
      
      <p class="warning-text">
        <strong>Atenção:</strong> Este pedido não passou pelo status "Em Entrega".
      </p>
      
      <p>
        Você está prestes a marcar este pedido como <strong>"Concluído"</strong> sem ter confirmado a entrega.
      </p>
      
      <p class="question">
        Deseja realmente confirmar que a entrega foi realizada?
      </p>
    </div>
    
    <div mat-dialog-actions align="end" class="confirmation-actions">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button 
              color="primary" 
              (click)="onConfirm()">
        Sim, Confirmar Entrega
      </button>
    </div>
  `,
  styles: [`
    .confirmation-content {
      text-align: center;
      padding: 20px;
    }
    
    .warning-icon {
      margin-bottom: 16px;
    }
    
    h3 {
      margin: 16px 0;
      color: #333;
    }
    
    .warning-text {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
      color: #856404;
    }
    
    .question {
      font-weight: 500;
      margin: 20px 0;
      color: #333;
    }
    
    .confirmation-actions {
      margin-top: 20px;
    }
  `]
})
export class DeliveryConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DeliveryConfirmationDialogComponent>
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

interface DialogData {
  currentStatus: OrderStatus;
}

@Component({
  selector: 'app-update-order-status-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatRadioModule,
    MatSnackBarModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>Atualizar Status do Pedido</h2>
    <mat-dialog-content>
      <div class="status-options">
        <mat-radio-group [(ngModel)]="selectedStatus" class="status-radio-group">
          <mat-radio-button *ngFor="let status of availableStatuses" 
                           [value]="status.value"
                           [disabled]="status.disabled"
                           class="status-radio-button">
            {{status.label}}
          </mat-radio-button>
        </mat-radio-group>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button 
              color="primary"
              [disabled]="!selectedStatus || selectedStatus === data.currentStatus"
              (click)="onConfirm()">
        Confirmar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .status-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 12px 0;
    }
    .status-radio-button {
      margin: 6px 0;
    }
  `]
})
export class UpdateOrderStatusDialogComponent {
  selectedStatus!: OrderStatus;
  availableStatuses: { value: OrderStatus; label: string; disabled: boolean }[];

  constructor(
    public dialogRef: MatDialogRef<UpdateOrderStatusDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialog: MatDialog
  ) {
    this.selectedStatus = this.data.currentStatus;
    
    // Definir opções de status disponíveis com base no status atual
    this.availableStatuses = [
      { 
        value: 'pending', 
        label: 'Pendente',
        disabled: this.data.currentStatus !== 'pending'
      },
      { 
        value: 'processing', 
        label: 'Em Processamento',
        disabled: this.data.currentStatus !== 'processing' && this.data.currentStatus !== 'pending'
      },
      { 
        value: 'delivering', 
        label: 'Em Entrega',
        disabled: this.data.currentStatus !== 'processing' && this.data.currentStatus !== 'delivering'
      },
      { 
        value: 'completed', 
        label: 'Concluído',
        disabled: false // Sempre habilitado
      },
      { 
        value: 'cancelled', 
        label: 'Cancelado',
        disabled: this.data.currentStatus === 'completed' || this.data.currentStatus === 'cancelled'
      }
    ];
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    // Verificar se está tentando marcar como concluído sem ter passado por entrega
    if (this.selectedStatus === 'completed' && this.data.currentStatus !== 'delivering') {
      this.showDeliveryConfirmation();
    } else {
      this.dialogRef.close(this.selectedStatus);
    }
  }

  private showDeliveryConfirmation(): void {
    const confirmDialog = this.dialog.open(DeliveryConfirmationDialogComponent, {
      width: '400px',
      disableClose: true
    });

    confirmDialog.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.dialogRef.close(this.selectedStatus);
      }
    });
  }
}