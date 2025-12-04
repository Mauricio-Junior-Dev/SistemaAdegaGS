import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatStepperModule } from '@angular/material/stepper';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

import { OrderService, CreateOrderRequest, PaymentMethod } from '../../../services/order.service';
import { ProductService } from '../../../../core/services/product.service';
import { Product } from '../../../../core/models/product.model';

export interface CreateManualOrderData {
  // Dados que podem ser passados para o dialog
}

@Component({
  selector: 'app-create-manual-order-dialog',
  templateUrl: './create-manual-order-dialog.component.html',
  styleUrls: ['./create-manual-order-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatDividerModule,
    MatTooltipModule,
    MatStepperModule,
    MatRadioModule,
    MatCheckboxModule
  ]
})
export class CreateManualOrderDialogComponent implements OnInit, OnDestroy {
  orderForm: FormGroup;
  searchForm: FormGroup;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;
  selectedProducts: { product: Product; quantity: number }[] = [];
  total = 0;
  receivedAmount = 0;
  changeAmount = 0;
  
  paymentMethods: PaymentMethod[] = ['dinheiro', 'cartão de débito', 'cartão de crédito', 'pix'];
  
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private dialogRef: MatDialogRef<CreateManualOrderDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreateManualOrderData,
    private fb: FormBuilder,
    private orderService: OrderService,
    private productService: ProductService,
    private snackBar: MatSnackBar
  ) {
    this.orderForm = this.fb.group({
      customer_name: ['', Validators.required],
      customer_phone: [''],
      customer_email: [''],
      customer_document: [''],
      payment_method: ['dinheiro', Validators.required],
      received_amount: [0],
      change_amount: [0],
      delivery: this.fb.group({
        address: [''],
        number: [''],
        complement: [''],
        neighborhood: [''],
        city: [''],
        state: [''],
        zipcode: [''],
        phone: [''],
        instructions: ['']
      })
    });

    this.searchForm = this.fb.group({
      searchTerm: ['']
    });

    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.filterProducts(term);
    });

    // Listener para o campo de busca
    this.searchForm.get('searchTerm')?.valueChanges.subscribe(term => {
      this.searchSubject.next(term);
    });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.setupFormListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFormListeners(): void {
    // Listener para calcular troco quando pagamento for em dinheiro
    this.orderForm.get('payment_method')?.valueChanges.subscribe(method => {
      if (method === 'dinheiro') {
        this.orderForm.get('received_amount')?.setValidators([Validators.required, Validators.min(0)]);
        this.orderForm.get('received_amount')?.updateValueAndValidity();
      } else {
        this.orderForm.get('received_amount')?.clearValidators();
        this.orderForm.get('received_amount')?.updateValueAndValidity();
        this.orderForm.patchValue({ received_amount: 0, change_amount: 0 });
      }
    });

    // Listener para calcular troco
    this.orderForm.get('received_amount')?.valueChanges.subscribe(() => {
      this.calculateChange();
    });
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (response) => {
        this.products = response.data.filter((p: Product) => p.is_active && p.current_stock > 0);
        this.filteredProducts = [...this.products];
      },
      error: (error) => {
        console.error('Erro ao carregar produtos:', error);
        this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
      }
    });
  }

  onSearchChange(term: string): void {
    this.searchSubject.next(term);
  }

  filterProducts(term: string): void {
    if (!term.trim()) {
      this.filteredProducts = [...this.products];
      return;
    }

    this.filteredProducts = this.products.filter(product =>
      product.name.toLowerCase().includes(term.toLowerCase())
    );
  }

  addProduct(product: Product): void {
    const existingIndex = this.selectedProducts.findIndex(p => p.product.id === product.id);
    
    if (existingIndex >= 0) {
      this.selectedProducts[existingIndex].quantity += 1;
    } else {
      this.selectedProducts.push({ product, quantity: 1 });
    }
    
    this.calculateTotal();
  }

  removeProduct(index: number): void {
    this.selectedProducts.splice(index, 1);
    this.calculateTotal();
  }

  updateQuantity(index: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeProduct(index);
      return;
    }
    
    this.selectedProducts[index].quantity = quantity;
    this.calculateTotal();
  }

  calculateTotal(): void {
    this.total = this.selectedProducts.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);
  }

  calculateChange(): void {
    const received = this.orderForm.get('received_amount')?.value || 0;
    const total = this.total;
    
    if (received >= total) {
      this.changeAmount = received - total;
      this.orderForm.patchValue({ change_amount: this.changeAmount });
    } else {
      this.changeAmount = 0;
      this.orderForm.patchValue({ change_amount: 0 });
    }
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels = {
      'dinheiro': 'Dinheiro',
      'cartão de débito': 'Cartão de Débito',
      'cartão de crédito': 'Cartão de Crédito',
      'pix': 'PIX'
    };
    return labels[method];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  onSubmit(): void {
    if (this.orderForm.invalid || this.selectedProducts.length === 0) {
      this.snackBar.open('Por favor, preencha todos os campos obrigatórios e adicione pelo menos um produto', 'Fechar', { duration: 3000 });
      return;
    }

    this.loading = true;

    const orderData: CreateOrderRequest = {
      items: this.selectedProducts.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price
      })),
      total: this.total,
      payment_method: this.orderForm.value.payment_method,
      customer_name: this.orderForm.value.customer_name,
      customer_phone: this.orderForm.value.customer_phone,
      customer_email: this.orderForm.value.customer_email,
      customer_document: this.orderForm.value.customer_document,
      received_amount: this.orderForm.value.received_amount,
      change_amount: this.orderForm.value.change_amount,
      delivery: this.orderForm.value.delivery
    };

    this.orderService.createManualOrder(orderData).subscribe({
      next: (response) => {
        this.loading = false;
        this.snackBar.open('Pedido criado com sucesso!', 'Fechar', { duration: 3000 });
        this.dialogRef.close(response);
      },
      error: (error) => {
        this.loading = false;
        console.error('Erro ao criar pedido:', error);
        this.snackBar.open('Erro ao criar pedido: ' + (error.error?.message || 'Erro desconhecido'), 'Fechar', { duration: 5000 });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
