import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { OrderService, QuickCustomerRequest, Customer } from '../../../services/order.service';
import { CepService } from '../../../../core/services/cep.service';

export interface QuickCustomerData {
  // Dados que podem ser passados para o dialog
}

@Component({
  selector: 'app-quick-customer-dialog',
  templateUrl: './quick-customer-dialog.component.html',
  styleUrls: ['./quick-customer-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ]
})
export class QuickCustomerDialogComponent {
  customerForm: FormGroup;
  loading = false;
  cepLoading = false;
  cepError: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<QuickCustomerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuickCustomerData,
    private fb: FormBuilder,
    private orderService: OrderService,
    private cepService: CepService,
    private snackBar: MatSnackBar
  ) {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: [''],
      email: ['', [Validators.email]],
      document_number: [''],
      // Campos de endereço
      address_name: ['Casa'],
      street: ['', [Validators.required]],
      number: ['', [Validators.required]],
      complement: [''],
      neighborhood: ['', [Validators.required]],
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      zipcode: ['', [Validators.pattern(/^\d{5}-\d{3}$/)]],
      notes: ['']
    });
  }

  onSubmit(): void {
    if (this.customerForm.invalid) {
      this.snackBar.open('Por favor, preencha os campos obrigatórios (nome, rua, número, bairro, cidade, estado)', 'Fechar', { duration: 3000 });
      return;
    }

    this.loading = true;

    const customerData: QuickCustomerRequest = {
      name: this.customerForm.value.name,
      phone: this.customerForm.value.phone || undefined,
      email: this.customerForm.value.email || undefined,
      document_number: this.customerForm.value.document_number || undefined,
      // Dados do endereço
      address: {
        name: this.customerForm.value.address_name,
        street: this.customerForm.value.street,
        number: this.customerForm.value.number,
        complement: this.customerForm.value.complement || undefined,
        neighborhood: this.customerForm.value.neighborhood,
        city: this.customerForm.value.city,
        state: this.customerForm.value.state,
        zipcode: this.customerForm.value.zipcode || undefined,
        notes: this.customerForm.value.notes || undefined
      }
    };

    this.orderService.createQuickCustomer(customerData).subscribe({
      next: (customer: Customer) => {
        this.loading = false;
        this.snackBar.open('Cliente criado com sucesso!', 'Fechar', { duration: 3000 });
        this.dialogRef.close(customer);
      },
      error: (error) => {
        this.loading = false;
        console.error('Erro ao criar cliente:', error);
        
        if (error.status === 409) {
          // Cliente já existe
          this.snackBar.open('Cliente já existe! Usando dados existentes.', 'Fechar', { duration: 3000 });
          this.dialogRef.close(error.error.customer);
        } else {
          // Extrair mensagem de erro amigável do backend
          const errorMessage = error.error?.message || error.error?.error || 'Erro ao criar cliente. Verifique os dados.';
          this.snackBar.open(errorMessage, 'Fechar', { duration: 5000 });
        }
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Formata CEP enquanto o usuário digita
   */
  formatZipcode(event: any): void {
    const value = event.target.value;
    const formatted = this.cepService.formatCep(value);
    if (formatted !== value) {
      this.customerForm.get('zipcode')?.setValue(formatted, { emitEvent: false });
    }
  }

  /**
   * Busca endereço pelo CEP
   */
  searchCep(): void {
    const zipcode = this.customerForm.get('zipcode')?.value;
    
    if (!zipcode || !this.cepService.isValidCep(zipcode)) {
      this.snackBar.open('CEP inválido. Digite um CEP válido.', 'Fechar', { duration: 3000 });
      return;
    }

    this.cepLoading = true;
    this.cepError = null;
    
    this.cepService.searchCep(zipcode).subscribe({
      next: (cepData) => {
        // Preenche automaticamente os campos do endereço
        this.customerForm.patchValue({
          street: cepData.street,
          neighborhood: cepData.neighborhood,
          city: cepData.city,
          state: cepData.state
        });
        
        this.cepLoading = false;
        this.snackBar.open(`Endereço encontrado: ${cepData.street}, ${cepData.neighborhood} - ${cepData.city}/${cepData.state}`, 'Fechar', { duration: 3000 });
      },
      error: (error) => {
        console.error('Erro ao buscar CEP:', error);
        this.cepError = error.message || 'Erro ao buscar CEP';
        this.cepLoading = false;
        this.snackBar.open('Erro ao buscar CEP: ' + this.cepError, 'Fechar', { duration: 3000 });
      }
    });
  }

  /**
   * Limpa erro quando o usuário começa a digitar
   */
  clearCepError(): void {
    this.cepError = null;
  }
}
