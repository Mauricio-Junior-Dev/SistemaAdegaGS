import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

export interface SangriaDialogData {
  currentAmount: number;
}

export interface SangriaResult {
  amount: number;
  description: string;
}

@Component({
  selector: 'app-sangria-dialog',
  templateUrl: './sangria-dialog.component.html',
  styleUrls: ['./sangria-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatDividerModule
  ]
})
export class SangriaDialogComponent {
  form: FormGroup;
  submitting = false;

  constructor(
    private dialogRef: MatDialogRef<SangriaDialogComponent, SangriaResult>,
    @Inject(MAT_DIALOG_DATA) public data: SangriaDialogData,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]]
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.snackBar.open('Preencha os campos corretamente', 'Fechar', { duration: 3000 });
      return;
    }

    const amount = Number(this.form.value.amount);
    if (amount > this.data.currentAmount) {
      this.snackBar.open('Valor maior que o saldo disponível em caixa', 'Fechar', { duration: 3000 });
      return;
    }

    this.submitting = true;
    const result: SangriaResult = {
      amount,
      description: this.form.value.description.trim()
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
