import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { OrderService } from '../../../core/services/order.service';
import { CepService } from '../../../core/services/cep.service';
import { AddressService, Address } from '../../../core/services/address.service';
import { DeliveryZoneService } from '../../../services/delivery-zone.service';
import { CartItem } from '../../../core/models/cart.model';
import { User } from '../../../core/models/auth.model';
import { Product } from '../../../core/models/product.model';
import { DeliveryZone } from '../../../models/delivery-zone.model';
import { ProductSuggestionsComponent } from '../../components/product-suggestions/product-suggestions.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatSnackBarModule,
    MatSelectModule,
    ProductSuggestionsComponent
  ]
})
export class CheckoutComponent implements OnInit {
  deliveryForm: FormGroup;
  paymentForm: FormGroup;
  cartItems$!: Observable<CartItem[]>;
  cartTotal$!: Observable<number>;
  user$!: Observable<User | null>;
  loading = false;
  error: string | null = null;
  
  // Endereços
  addresses: Address[] = [];
  selectedAddressId: number | null = null;
  useSavedAddress = false;
  loadingAddresses = false;
  
  // Delivery Zones
  deliveryZones: DeliveryZone[] = [];
  selectedNeighborhood = '';
  deliveryFee = 0;
  estimatedTime = '';
  loadingDeliveryZones = false;
  
  // Controle de Steps
  currentStep = 1;

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private cepService: CepService,
    private addressService: AddressService,
    private deliveryZoneService: DeliveryZoneService,
    private snackBar: MatSnackBar,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.deliveryForm = this.fb.group({
      address: ['', Validators.required],
      number: ['', Validators.required],
      complement: [''],
      neighborhood: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipcode: ['', [Validators.required, Validators.pattern(/^\d{5}-\d{3}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^\(\d{2}\) \d{5}-\d{4}$/)]],
      instructions: ['']
    });

    this.paymentForm = this.fb.group({
      method: ['pix', Validators.required],
      received_amount: [''], // Valor recebido para pagamento em dinheiro
      change: [''] // Troco para (legacy, mantido para compatibilidade)
    });
  }

  ngOnInit(): void {
    // Inicializar observables
    this.cartItems$ = this.cartService.cartItems$;
    this.cartTotal$ = this.cartItems$.pipe(
      map((items: CartItem[]) => items.reduce((total: number, item: CartItem) => total + (item.quantity * item.price), 0))
    );
    this.user$ = this.authService.user$;

    // Preencher formulário com dados do usuário
    this.user$.subscribe((user: User | null) => {
      if (user) {
        this.deliveryForm.patchValue({
          phone: user.phone
        });
      }
    });

    // Carregar endereços salvos
    this.loadAddresses();
    
    // Carregar zonas de entrega
    this.loadDeliveryZones();
  }

  loadAddresses(): void {
    this.loadingAddresses = true;
    this.addressService.getAddresses().subscribe({
      next: (addresses) => {
        this.addresses = addresses;
        this.loadingAddresses = false;
        
        // Se há endereços, usar endereço salvo por padrão
        if (addresses.length > 0) {
          this.useSavedAddress = true;
          const defaultAddress = addresses.find(addr => addr.is_default);
          if (defaultAddress) {
            this.selectAddress(defaultAddress.id);
          } else {
            // Se não há endereço padrão, selecionar o primeiro
            this.selectAddress(addresses[0].id);
          }
        } else {
          // Se não há endereços, usar novo endereço
          this.useSavedAddress = false;
        }
      },
      error: (error) => {
        console.error('Erro ao carregar endereços:', error);
        this.loadingAddresses = false;
        this.useSavedAddress = false;
      }
    });
  }

  selectAddress(addressId: number): void {
    this.selectedAddressId = addressId;
    this.useSavedAddress = true;
    
    const address = this.addresses.find(addr => addr.id === addressId);
    if (address) {
      this.deliveryForm.patchValue({
        zipcode: address.zipcode,
        address: address.street,
        number: address.number,
        complement: address.complement,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        instructions: address.notes
      });
    }
  }

  onAddressOptionChange(event: any): void {
    const selectedValue = event.value;
    console.log('Address option changed:', selectedValue);
    
    this.useSavedAddress = selectedValue;
    
    if (this.useSavedAddress) {
      // Se selecionou usar endereço salvo, garantir que um endereço está selecionado
      if (this.addresses.length > 0 && !this.selectedAddressId) {
        const defaultAddress = this.addresses.find(addr => addr.is_default);
        if (defaultAddress) {
          this.selectAddress(defaultAddress.id);
        } else {
          this.selectAddress(this.addresses[0].id);
        }
      }
    } else {
      // Se selecionou usar novo endereço
      this.useNewAddress();
    }
    
    // Forçar detecção de mudanças
    this.cdr.detectChanges();
  }

  useNewAddress(): void {
    console.log('Using new address');
    this.useSavedAddress = false;
    this.selectedAddressId = null;
    this.deliveryForm.reset();
    
    // Manter o telefone se já estiver preenchido
    const phone = this.deliveryForm.get('phone')?.value;
    this.deliveryForm.patchValue({ phone });
    
    // Forçar detecção de mudanças
    this.cdr.detectChanges();
    
    console.log('New address setup complete:', {
      useSavedAddress: this.useSavedAddress,
      selectedAddressId: this.selectedAddressId,
      formValue: this.deliveryForm.value
    });
  }

  isDeliveryFormValid(): boolean {
    console.log('Validating delivery form:', {
      useSavedAddress: this.useSavedAddress,
      selectedAddressId: this.selectedAddressId,
      formValid: this.deliveryForm.valid,
      formValue: this.deliveryForm.value
    });
    
    if (this.useSavedAddress) {
      // Se está usando endereço salvo, verificar se um endereço foi selecionado
      return this.selectedAddressId !== null;
    } else {
      // Se está usando novo endereço, verificar se o formulário está válido
      return this.deliveryForm.valid;
    }
  }

  formatPhone(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
      this.deliveryForm.get('phone')?.setValue(value, { emitEvent: false });
    }
  }

  formatZipcode(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length <= 8) {
      value = value.replace(/^(\d{5})(\d{3}).*/, '$1-$2');
      this.deliveryForm.get('zipcode')?.setValue(value, { emitEvent: false });
    }
  }

  /**
   * Busca endereço pelo CEP
   */
  searchCep(): void {
    const zipcode = this.deliveryForm.get('zipcode')?.value;
    
    if (!zipcode || !this.cepService.isValidCep(zipcode)) {
      return;
    }

    this.loading = true;
    
    this.cepService.searchCep(zipcode).subscribe({
      next: (cepData) => {
        // Preenche automaticamente os campos do endereço
        this.deliveryForm.patchValue({
          address: cepData.street,
          neighborhood: cepData.neighborhood,
          city: cepData.city,
          state: cepData.state
        });
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao buscar CEP:', error);
        this.error = error.message || 'Erro ao buscar CEP';
        this.loading = false;
      }
    });
  }

  /**
   * Limpa erro quando o usuário começa a digitar
   */
  clearError(): void {
    this.error = null;
  }

  /**
   * Carrega as zonas de entrega disponíveis
   */
  loadDeliveryZones(): void {
    this.loadingDeliveryZones = true;
    this.deliveryZoneService.getDeliveryZones().subscribe({
      next: (zones) => {
        this.deliveryZones = zones;
        this.loadingDeliveryZones = false;
      },
      error: (error) => {
        console.error('Erro ao carregar zonas de entrega:', error);
        this.loadingDeliveryZones = false;
      }
    });
  }

  /**
   * Calcula o frete quando o bairro é selecionado
   */
  onNeighborhoodChange(): void {
    if (this.selectedNeighborhood) {
      this.deliveryZoneService.calculateFrete(this.selectedNeighborhood).subscribe({
        next: (response) => {
          this.deliveryFee = response.valor_frete;
          this.estimatedTime = response.tempo_estimado || '';
        },
        error: (error) => {
          console.error('Erro ao calcular frete:', error);
          this.deliveryFee = 0;
          this.estimatedTime = '';
          if (error.status === 404) {
            this.snackBar.open('Entre em contato para verificar disponibilidade para este bairro', 'Fechar', { duration: 5000 });
          }
        }
      });
    } else {
      this.deliveryFee = 0;
      this.estimatedTime = '';
    }
  }

  // Controle de Steps
  nextStep(): void {
    if (this.currentStep < 4) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  async onSubmit(): Promise<void> {
    console.log('Submitting order:', {
      useSavedAddress: this.useSavedAddress,
      selectedAddressId: this.selectedAddressId,
      deliveryFormValid: this.deliveryForm.valid,
      paymentFormValid: this.paymentForm.valid
    });

    if (!this.isDeliveryFormValid() || this.paymentForm.invalid) {
      this.error = 'Por favor, preencha todos os campos obrigatórios';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      // Buscar os itens do carrinho
      const items = await new Promise<CartItem[]>((resolve) => {
        this.cartItems$.subscribe(items => {
          resolve(items);
        }).unsubscribe();
      });

      if (items.length === 0) {
        this.error = 'Seu carrinho está vazio';
        this.loading = false;
        return;
      }

      // Mapear método de pagamento para o formato esperado pelo backend
      const paymentMethodMap: { [key: string]: string } = {
        'pix': 'pix',
        'cash': 'dinheiro',
        'card': 'cartão de débito'
      };

      const paymentMethodValue = this.paymentForm.value.method;
      const mappedPaymentMethod = paymentMethodMap[paymentMethodValue] || 'pix';
      
      // Verificar se é pagamento em dinheiro (case-insensitive)
      const isCashPayment = mappedPaymentMethod.toLowerCase() === 'dinheiro';

      // Calcular total do pedido (subtotal + frete)
      const cartTotal = await new Promise<number>((resolve) => {
        this.cartTotal$.subscribe(total => {
          resolve(total);
        }).unsubscribe();
      });
      const orderTotal = cartTotal + this.deliveryFee;

      // Preparar dados do pagamento (received_amount e change_amount)
      let receivedAmount: number | undefined = undefined;
      let changeAmount: number | undefined = undefined;

      if (isCashPayment) {
        // Para pagamento em dinheiro, usar received_amount do formulário
        // ou o campo "change" (legacy) que representa o valor total a pagar
        const receivedValue = this.paymentForm.value.received_amount || this.paymentForm.value.change;
        
        if (receivedValue && parseFloat(receivedValue) > 0) {
          receivedAmount = parseFloat(receivedValue);
          
          // Calcular troco se o valor recebido for maior que o total
          if (receivedAmount >= orderTotal) {
            changeAmount = receivedAmount - orderTotal;
          } else {
            // Se o valor recebido for menor que o total, não há troco
            changeAmount = 0;
          }
        }
      }

      // Preparar dados do pedido
      let deliveryData;
      if (this.useSavedAddress && this.selectedAddressId) {
        // Usar endereço salvo
        deliveryData = {
          address_id: this.selectedAddressId,
          phone: this.deliveryForm.value.phone,
          instructions: ''
        };
      } else {
        // Usar novo endereço
        deliveryData = {
          name: 'Endereço de Entrega',
          ...this.deliveryForm.value
        };
      }

      const orderData = {
        type: 'online',
        delivery: deliveryData,
        payment_method: mappedPaymentMethod,
        customer_name: deliveryData.address,
        customer_phone: deliveryData.phone,
        items: items.map(item => {
          if (item.isCombo && item.combo) {
            return {
              combo_id: item.combo.id,
              quantity: item.quantity,
              sale_type: 'garrafa' // Default para combos
            };
          } else if (item.product) {
            return {
              product_id: item.product.id,
              quantity: item.quantity,
              sale_type: 'garrafa' // Default para produtos
            };
          }
          return null;
        }).filter(item => item !== null),
        delivery_fee: this.deliveryFee,
        // Incluir received_amount e change_amount se for pagamento em dinheiro
        received_amount: isCashPayment ? receivedAmount : undefined,
        change_amount: isCashPayment ? changeAmount : undefined
      };

      console.log('Enviando pedido:', orderData);
      console.log('Items processados:', orderData.items);
      console.log('Items originais:', items);

      // Enviar pedido para o backend
      this.orderService.createOrder(orderData).subscribe({
        next: (response) => {
          console.log('Pedido criado com sucesso:', response);
          this.loading = false;

          // Limpar o carrinho
          this.cartService.clearCart();

          // Redirecionar baseado no método de pagamento
          const paymentMethod = this.paymentForm.value.method;
          
          if (paymentMethod === 'pix') {
            // TODO: Mostrar página com QR Code do PIX
            alert(`Pedido #${response.order_number} criado com sucesso!\n\nPagamento via PIX.\nTotal: R$ ${response.total_amount || response.total}`);
            this.router.navigate(['/pedidos']);
          } else if (paymentMethod === 'cash') {
            // Dinheiro na entrega
            alert(`Pedido #${response.order_number} criado com sucesso!\n\nPagamento em dinheiro na entrega.\nTotal: R$ ${response.total_amount || response.total}`);
            this.router.navigate(['/pedidos']);
          } else if (paymentMethod === 'card') {
            // Cartão na entrega
            alert(`Pedido #${response.order_number} criado com sucesso!\n\nPagamento com cartão na entrega.\nTotal: R$ ${response.total_amount || response.total}`);
            this.router.navigate(['/pedidos']);
          }
        },
        error: (error) => {
          console.error('Erro ao criar pedido:', error);
          this.error = error.error?.message || 'Erro ao finalizar pedido. Tente novamente.';
          this.loading = false;
        }
      });

    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      this.error = 'Erro ao processar pedido. Tente novamente.';
      this.loading = false;
    }
  }

  getImageUrl(item: CartItem): string {
    if (item.isCombo && item.combo) {
      // Para combos, usar a primeira imagem ou imagem padrão
      if (item.combo.images && item.combo.images.length > 0) {
        return item.combo.images[0];
      }
      return 'assets/images/default-combo.jpg';
    } else if (item.product) {
      // Para produtos
      const imageUrl = item.product.image_url;
      if (!imageUrl) return 'assets/images/no-image.png';
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return `${imageUrl}?v=${encodeURIComponent(item.product.updated_at || '')}`;
      if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${base}${path}?v=${encodeURIComponent(item.product.updated_at || '')}`;
      }
      return `${imageUrl}?v=${encodeURIComponent(item.product.updated_at || '')}`;
    }
    return 'assets/images/no-image.png';
  }

  getItemName(item: CartItem): string {
    if (item.isCombo && item.combo) {
      return item.combo.name;
    } else if (item.product) {
      return item.product.name;
    }
    return 'Item';
  }

  getItemCategory(item: CartItem): string {
    if (item.isCombo && item.combo) {
      return 'Combo';
    } else if (item.product && item.product.category) {
      return item.product.category.name;
    }
    return 'Categoria';
  }
}
