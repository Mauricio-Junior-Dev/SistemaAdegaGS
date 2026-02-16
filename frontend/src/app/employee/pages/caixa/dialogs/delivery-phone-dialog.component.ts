import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';

import { OrderService, Customer } from '../../../services/order.service';

export type DeliveryPhoneResult =
  | { type: 'found'; customer: Customer }
  | { type: 'quick'; data: QuickDeliveryData }
  | null;

export interface QuickDeliveryData {
  customerName: string;
  customerPhone: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  deliveryFeeManual: number;
}

@Component({
  selector: 'app-delivery-phone-dialog',
  templateUrl: './delivery-phone-dialog.component.html',
  styleUrls: ['./delivery-phone-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatCardModule
  ]
})
export class DeliveryPhoneDialogComponent {
  step: 'phone' | 'quick' = 'phone';
  phoneForm: FormGroup;
  quickForm: FormGroup;
  loading = false;
  searchResults: Customer[] = [];
  selectedPhone = '';

  constructor(
    private dialogRef: MatDialogRef<DeliveryPhoneDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {},
    private fb: FormBuilder,
    private orderService: OrderService
  ) {
    this.phoneForm = this.fb.group({
      phone: ['', [Validators.required, Validators.minLength(8)]]
    });
    this.quickForm = this.fb.group({
      customerName: ['', [Validators.required, Validators.minLength(2)]],
      customerPhone: [''],
      street: ['', Validators.required],
      number: ['', Validators.required],
      deliveryFeeManual: [0, [Validators.required, Validators.min(0)]]
    });
  }

  searchByPhone(): void {
    if (this.phoneForm.invalid) return;
    const raw = (this.phoneForm.value.phone || '').trim();
    const phoneDigits = raw.replace(/\D/g, '');
    if (phoneDigits.length < 8) return;

    this.loading = true;
    this.selectedPhone = raw;
    // Envia só dígitos para a API encontrar independente da formatação salva: (11) 93419-9864 ou 11934199864
    this.orderService.searchCustomers(phoneDigits).subscribe({
      next: (customers) => {
        this.loading = false;
        this.searchResults = customers || [];
        if (this.searchResults.length === 1) {
          this.dialogRef.close({ type: 'found', customer: this.searchResults[0] } as DeliveryPhoneResult);
        } else         if (this.searchResults.length === 0) {
          this.step = 'quick';
          this.quickForm.patchValue({
            customerName: '',
            customerPhone: this.selectedPhone,
            deliveryFeeManual: 0
          });
        }
      },
      error: () => {
        this.loading = false;
        this.searchResults = [];
        this.step = 'quick';
        this.quickForm.patchValue({
          customerName: '',
          customerPhone: this.selectedPhone,
          deliveryFeeManual: 0
        });
      }
    });
  }

  selectCustomer(customer: Customer): void {
    this.dialogRef.close({ type: 'found', customer } as DeliveryPhoneResult);
  }

  submitQuickForm(): void {
    if (this.quickForm.invalid) return;
    const v = this.quickForm.getRawValue();
    const data: QuickDeliveryData = {
      customerName: (v.customerName || '').trim(),
      customerPhone: (v.customerPhone || this.selectedPhone || '').trim(),
      street: (v.street || '').trim(),
      number: (v.number || '').trim(),
      neighborhood: '-',
      city: 'São Paulo',
      state: 'SP',
      zipcode: '00011111',
      deliveryFeeManual: Number(v.deliveryFeeManual) || 0
    };
    this.dialogRef.close({ type: 'quick', data } as DeliveryPhoneResult);
  }

  backToPhone(): void {
    this.step = 'phone';
    this.searchResults = [];
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
