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
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { CepService } from '../../../../core/services/cep.service';
import { Address, CreateAddressRequest } from '../../../../core/services/address.service';

export interface NewAddressData {
  customerId: number;
}

@Component({
  selector: 'app-new-address-dialog',
  templateUrl: './new-address-dialog.component.html',
  styleUrls: ['./new-address-dialog.component.css'],
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
export class NewAddressDialogComponent {
  addressForm: FormGroup;
  loading = false;
  cepLoading = false;
  cepError: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<NewAddressDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: NewAddressData,
    private fb: FormBuilder,
    private http: HttpClient,
    private cepService: CepService,
    private snackBar: MatSnackBar
  ) {
    this.addressForm = this.fb.group({
      name: ['Casa', [Validators.required]],
      street: ['', [Validators.required]],
      number: ['', [Validators.required]],
      complement: [''],
      neighborhood: ['', [Validators.required]],
      city: ['', [Validators.required]],
      state: ['', [Validators.required, Validators.maxLength(2)]],
      zipcode: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      notes: ['']
    });
  }

  onSubmit(): void {
    if (this.addressForm.invalid) {
      this.snackBar.open('Por favor, preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }

    this.loading = true;

    const addressData: CreateAddressRequest = {
      name: this.addressForm.value.name,
      street: this.addressForm.value.street,
      number: this.addressForm.value.number,
      complement: this.addressForm.value.complement || undefined,
      neighborhood: this.addressForm.value.neighborhood,
      city: this.addressForm.value.city,
      state: this.addressForm.value.state,
      zipcode: this.addressForm.value.zipcode,
      notes: this.addressForm.value.notes || undefined
    };

    // Criar endereço para o cliente específico (funcionário pode criar para cliente)
    this.http.post<Address>(`${environment.apiUrl}/addresses`, {
      ...addressData,
      user_id: this.data.customerId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (address: Address) => {
        this.loading = false;
        this.snackBar.open('Endereço cadastrado com sucesso!', 'Fechar', { duration: 3000 });
        this.dialogRef.close(address);
      },
      error: (error) => {
        this.loading = false;
        console.error('Erro ao criar endereço:', error);
        this.snackBar.open('Erro ao criar endereço: ' + (error.error?.message || 'Erro desconhecido'), 'Fechar', { duration: 5000 });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  formatZipcode(event: any): void {
    const value = event.target.value;
    const formatted = this.cepService.formatCep(value);
    if (formatted !== value) {
      this.addressForm.get('zipcode')?.setValue(formatted, { emitEvent: false });
    }
  }

  searchCep(): void {
    const zipcode = this.addressForm.get('zipcode')?.value;
    
    if (!zipcode || !this.cepService.isValidCep(zipcode)) {
      this.snackBar.open('CEP inválido. Digite um CEP válido.', 'Fechar', { duration: 3000 });
      return;
    }

    this.cepLoading = true;
    this.cepError = null;
    
    this.cepService.searchCep(zipcode).subscribe({
      next: (cepData) => {
        this.addressForm.patchValue({
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

  clearCepError(): void {
    this.cepError = null;
  }
}

