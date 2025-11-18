import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-pix-payment-dialog',
  template: `
    <h2 mat-dialog-title>Pagamento PIX</h2>
    <mat-dialog-content>
      <div class="pix-payment-container">
        <p class="instruction">Escaneie o QR Code ou copie o código PIX para pagar</p>
        
        <!-- QR Code -->
        <div class="qr-code-container" *ngIf="data.qrCode">
          <qrcode 
            [qrdata]="data.qrCode" 
            [width]="256" 
            [errorCorrectionLevel]="'M'"
            [colorDark]="'#000000'"
            [colorLight]="'#FFFFFF'">
          </qrcode>
        </div>

        <!-- Código PIX Copia e Cola -->
        <div class="pix-code-container">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Código PIX (Copia e Cola)</mat-label>
            <textarea 
              matInput 
              [value]="data.qrCode" 
              readonly
              rows="4"
              #pixCodeInput>
            </textarea>
          </mat-form-field>
          
          <button 
            mat-raised-button 
            color="primary" 
            class="copy-button"
            (click)="copyPixCode()">
            <mat-icon>content_copy</mat-icon>
            Copiar Código
          </button>
        </div>

        <div class="expires-info" *ngIf="data.expiresAt">
          <mat-icon>schedule</mat-icon>
          <span>Este código expira em: {{ formatExpiration(data.expiresAt) }}</span>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 500px;
    }
    
    .pix-payment-container {
      padding: 20px 0;
    }

    .instruction {
      text-align: center;
      color: #666;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .qr-code-container {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
      padding: 20px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .pix-code-container {
      margin-bottom: 16px;
    }

    .full-width {
      width: 100%;
    }

    .copy-button {
      width: 100%;
      margin-top: 8px;
    }

    .expires-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background-color: #fff3cd;
      border-radius: 4px;
      color: #856404;
      font-size: 14px;
    }

    .expires-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
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
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    QRCodeComponent
  ]
})
export class PixPaymentDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PixPaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      qrCode: string;
      expiresAt?: string;
    },
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {}

  copyPixCode(): void {
    if (this.data.qrCode) {
      this.clipboard.copy(this.data.qrCode);
      this.snackBar.open('Código PIX copiado!', 'Fechar', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  formatExpiration(expiresAt: string): string {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

