import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { DeliveryZoneService } from '../../../../services/delivery-zone.service';
import { DeliveryZone } from '../../../../models/delivery-zone.model';

export interface DeliveryZoneFormData {
  zone?: DeliveryZone;
}

@Component({
  selector: 'app-delivery-zone-form-dialog',
  templateUrl: './delivery-zone-form-dialog.component.html',
  styleUrls: ['./delivery-zone-form-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatIconModule,
    MatProgressSpinnerModule
  ]
})
export class DeliveryZoneFormDialogComponent implements OnInit {
  form: FormGroup;
  loading = false;
  isEdit = false;

  constructor(
    private fb: FormBuilder,
    private deliveryZoneService: DeliveryZoneService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<DeliveryZoneFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeliveryZoneFormData
  ) {
    this.isEdit = !!data.zone;
    
    this.form = this.fb.group({
      nome_bairro: [this.data.zone?.nome_bairro || '', [Validators.required, Validators.maxLength(255)]],
      cep_inicio: [this.data.zone?.cep_inicio || '', [Validators.required, Validators.pattern(/^[0-9]{5}-?[0-9]{3}$/)]],
      cep_fim: [this.data.zone?.cep_fim || '', [Validators.required, Validators.pattern(/^[0-9]{5}-?[0-9]{3}$/)]],
      valor_frete: [this.data.zone?.valor_frete || '', [Validators.required, Validators.min(0)]],
      tempo_estimado: [this.data.zone?.tempo_estimado || '', [Validators.maxLength(255)]],
      ativo: [this.data.zone?.ativo ?? true]
    });
  }

  ngOnInit(): void {
    if (this.isEdit && this.data.zone) {
      this.form.patchValue({
        nome_bairro: this.data.zone.nome_bairro,
        cep_inicio: (this.data.zone as any).cep_inicio || '',
        cep_fim: (this.data.zone as any).cep_fim || '',
        valor_frete: this.data.zone.valor_frete,
        tempo_estimado: this.data.zone.tempo_estimado || '',
        ativo: this.data.zone.ativo
      });
    }
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.loading = true;
      const formData = this.form.value;

      if (this.isEdit && this.data.zone) {
        // Atualizar zona existente
        this.deliveryZoneService.updateDeliveryZone(this.data.zone.id, formData)
          .subscribe({
            next: () => {
              this.snackBar.open('Zona de entrega atualizada com sucesso', 'Fechar', { duration: 3000 });
              this.dialogRef.close(true);
            },
            error: (error) => {
              console.error('Erro ao atualizar zona de entrega:', error);
              this.snackBar.open('Erro ao atualizar zona de entrega', 'Fechar', { duration: 3000 });
              this.loading = false;
            }
          });
      } else {
        // Criar nova zona
        this.deliveryZoneService.createDeliveryZone(formData)
          .subscribe({
            next: () => {
              this.snackBar.open('Zona de entrega criada com sucesso', 'Fechar', { duration: 3000 });
              this.dialogRef.close(true);
            },
            error: (error) => {
              console.error('Erro ao criar zona de entrega:', error);
              this.snackBar.open('Erro ao criar zona de entrega', 'Fechar', { duration: 3000 });
              this.loading = false;
            }
          });
      }
    } else {
      this.form.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  getErrorMessage(field: string): string {
    const control = this.form.get(field);
    if (control?.hasError('required')) {
      return 'Este campo é obrigatório';
    }
    if (control?.hasError('pattern')) {
      return 'Formato de CEP inválido (use 00000-000)';
    }
    if (control?.hasError('min')) {
      return 'Valor deve ser maior ou igual a 0';
    }
    if (control?.hasError('maxlength')) {
      return `Máximo de ${control.errors?.['maxlength'].requiredLength} caracteres`;
    }
    return '';
  }
}
