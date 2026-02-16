import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CepService } from '../../../../core/services/cep.service';

@Component({
  selector: 'app-blocked-zip-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>Novo CEP Bloqueado</h2>

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>CEP</mat-label>
          <input
            matInput
            formControlName="zip_code"
            placeholder="00000-000"
            (input)="onCepInput($event)"
          >
          <mat-error *ngIf="form.get('zip_code')?.hasError('required')">
            CEP é obrigatório
          </mat-error>
          <mat-error *ngIf="form.get('zip_code')?.hasError('pattern')">
            CEP inválido
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Motivo (opcional)</mat-label>
          <textarea
            matInput
            formControlName="reason"
            rows="3"
            placeholder="Ex: Área de risco, via interditada, difícil acesso...">
          </textarea>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()" [disabled]="loading">
          Cancelar
        </button>
        <button mat-raised-button color="primary" type="submit" [disabled]="loading">
          <span *ngIf="!loading">Salvar</span>
          <mat-icon *ngIf="loading">
            <mat-spinner diameter="20"></mat-spinner>
          </mat-icon>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .full-width {
      width: 100%;
    }
  `]
})
export class BlockedZipFormDialogComponent {
  form: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private cepService: CepService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<BlockedZipFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.form = this.fb.group({
      zip_code: ['', [Validators.required, Validators.pattern(/^\d{5}-\d{3}$/)]],
      reason: ['']
    });
  }

  onCepInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.cepService.formatCep(input.value || '');
    this.form.get('zip_code')?.setValue(formatted, { emitEvent: false });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.snackBar.open('Verifique o CEP informado', 'Fechar', { duration: 3000 });
      return;
    }
    this.dialogRef.close(this.form.value);
  }
}

