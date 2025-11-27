import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
import { Observable, firstValueFrom, Subscription, timer, switchMap, takeWhile, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { OrderService } from '../../../core/services/order.service';
import { CepService } from '../../../core/services/cep.service';
import { AddressService, Address } from '../../../core/services/address.service';
import { DeliveryZoneService } from '../../../services/delivery-zone.service';
import { StoreStatusService } from '../../../core/services/store-status.service';
import { CartItem } from '../../../core/models/cart.model';
import { User } from '../../../core/models/auth.model';
import { Product } from '../../../core/models/product.model';
import { Order, PixPaymentResponse } from '../../../core/models/order.model';
import { DeliveryZone } from '../../../models/delivery-zone.model';
import { ProductSuggestionsComponent } from '../../components/product-suggestions/product-suggestions.component';
import { environment } from '../../../../environments/environment';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatProgressBarModule } from '@angular/material/progress-bar';

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
    ProductSuggestionsComponent,
    MatProgressBarModule
  ]
})
export class CheckoutComponent implements OnInit, OnDestroy {
  deliveryForm: FormGroup;
  paymentForm: FormGroup;
  cartItems$!: Observable<CartItem[]>;
  cartTotal$!: Observable<number>;
  user$!: Observable<User | null>;
  isStoreOpen$!: Observable<boolean>;
  loading = false;
  error: string | null = null;
  public checkoutState: 'form' | 'awaiting_payment' = 'form';
  public pixQrCodeBase64: string | null = null;
  public pixCopiaECola: string | null = null;
  public safeQrCodeUrl: SafeUrl | null = null;
  public isProcessingPayment = false;
  public loadingMessage: string = 'Aguardando pagamento...';
  private paymentPollingSub?: Subscription;
  
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
  isDeliveryAreaValid = false; // Flag para indicar se a área de entrega é válida
  
  // Controle de Steps
  currentStep = 1;
  
  // Controle de UI
  showAddressForm = false;
  showOrderSummary = false;

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private cepService: CepService,
    private addressService: AddressService,
    private deliveryZoneService: DeliveryZoneService,
    private storeStatusService: StoreStatusService,
    private snackBar: MatSnackBar,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private clipboard: Clipboard,
    private sanitizer: DomSanitizer
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
      method: ['cash', Validators.required],
      received_amount: [''],
      change: ['']
    });

    // Inicializar observável do status da loja após injeção do serviço
    this.isStoreOpen$ = this.storeStatusService.status$;
  }

  private updateCartTotals(): void {
    this.cartTotal$ = this.cartItems$.pipe(
      map((items: CartItem[]) => {
        const total = items.reduce((sum: number, item: CartItem) => {
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          return sum + (quantity * price);
        }, 0);

        if (!Number.isFinite(total)) {
          return 0;
        }

        const normalizedTotal = Number(total.toFixed(2));
        return Number.isFinite(normalizedTotal) ? normalizedTotal : 0;
      })
    );
  }
  // Método central para buscar frete por CEP
  private _fetchFrete(cep: string): void {
    if (!cep || cep.replace(/\D/g, '').length < 8) {
      this.deliveryFee = 0;
      this.estimatedTime = '';
      this.isDeliveryAreaValid = false;
      return;
    }

    this.loadingDeliveryZones = true;
    this.deliveryZoneService.calculateFrete(cep).subscribe({
      next: (response) => {
        this.deliveryFee = parseFloat(String(response?.valor_frete ?? '0')) || 0;
        this.estimatedTime = response?.tempo_estimado || '';
        this.isDeliveryAreaValid = true; // Área válida quando frete é calculado
        this.loadingDeliveryZones = false;
        this.updateCartTotals();
      },
      error: (error) => {
        console.error('Erro ao calcular frete:', error);
        // Limpar valores de frete quando houver erro
        this.deliveryFee = 0;
        this.estimatedTime = 'Não disponível';
        // Definir flag de erro - área fora de entrega
        this.isDeliveryAreaValid = false;
        this.loadingDeliveryZones = false;
        if (error.status === 404) {
          this.snackBar.open('Infelizmente, ainda não atendemos este CEP.', 'Fechar', { duration: 5000 });
        }
      }
    });
  }


  ngOnInit(): void {
    // Inicializar observables
    this.cartItems$ = this.cartService.cartItems$;
    this.updateCartTotals();
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

      // Dispara cálculo de frete pelo CEP do endereço selecionado
      if (address.zipcode) {
        this._fetchFrete(address.zipcode);
      } else {
        this.isDeliveryAreaValid = false;
      }
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
    this.isDeliveryAreaValid = false; // Resetar flag ao usar novo endereço
    
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
        // Verificar se o bairro do CEP existe na lista de deliveryZones
        const matchingZone = this.deliveryZones.find(zone => 
          zone.nome_bairro.toLowerCase().includes(cepData.neighborhood.toLowerCase()) ||
          cepData.neighborhood.toLowerCase().includes(zone.nome_bairro.toLowerCase())
        );
        
        // Preenche automaticamente os campos do endereço
        const patchData: any = {
          address: cepData.street || '',
          city: cepData.city || '',
          state: cepData.state || ''
        };
        
        // Se encontrou uma zona correspondente, usar o nome exato da zona
        if (matchingZone) {
          patchData.neighborhood = matchingZone.nome_bairro;
          this.selectedNeighborhood = matchingZone.nome_bairro;
        } else {
          // Se não encontrou, usar o bairro do CEP diretamente
          patchData.neighborhood = cepData.neighborhood || '';
          this.selectedNeighborhood = cepData.neighborhood || '';
        }
        
        // Garantir que o neighborhood está sendo preenchido corretamente
        this.deliveryForm.patchValue(patchData);
        
        // Forçar atualização do campo neighborhood
        const neighborhoodControl = this.deliveryForm.get('neighborhood');
        if (neighborhoodControl && patchData.neighborhood) {
          neighborhoodControl.setValue(patchData.neighborhood, { emitEvent: true });
        }
        
        // Dispara a validação de área de entrega e cálculo de frete
        this.calculateFreteFromCep();
        
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao buscar CEP:', error);
        this.error = error.message || 'Erro ao buscar CEP';
        this.loading = false;
      }
    });
  }

  /**
   * Atualiza selectedNeighborhood quando o campo neighborhood é alterado manualmente
   */
  onNeighborhoodChange(): void {
    const neighborhoodValue = this.deliveryForm.get('neighborhood')?.value;
    if (neighborhoodValue) {
      this.selectedNeighborhood = neighborhoodValue;
      // Verificar se o bairro está na lista de zonas de entrega
      const matchingZone = this.deliveryZones.find(zone => 
        zone.nome_bairro.toLowerCase() === neighborhoodValue.toLowerCase() ||
        zone.nome_bairro.toLowerCase().includes(neighborhoodValue.toLowerCase()) ||
        neighborhoodValue.toLowerCase().includes(zone.nome_bairro.toLowerCase())
      );
      
      if (matchingZone) {
        this.selectedNeighborhood = matchingZone.nome_bairro;
        this.deliveryForm.patchValue({ neighborhood: matchingZone.nome_bairro });
      }
      
      // Recalcular frete se houver CEP válido
      const zipcode = this.deliveryForm.get('zipcode')?.value;
      if (zipcode && this.cepService.isValidCep(zipcode)) {
        this.calculateFreteFromCep();
      }
    }
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
   * Calcula o frete a partir do CEP do formulário
   */
  public calculateFreteFromCep(): void {
    const cepControl = this.deliveryForm.get('zipcode');
    if (cepControl && cepControl.valid && cepControl.value) {
      this._fetchFrete(cepControl.value);
    } else {
      this.deliveryFee = 0;
      this.estimatedTime = '';
      this.isDeliveryAreaValid = false;
    }
  }

  // Controle de Steps
  nextStep(): void {
    if (this.currentStep < 4) {
      this.currentStep++;
      this.scrollToTop();
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.scrollToTop();
    }
  }

  /**
   * Faz scroll suave até o topo do container do checkout
   */
  private scrollToTop(): void {
    // Rola suavemente para o topo do container do checkout
    const element = document.querySelector('.checkout-container') || document.body;
    if (element) {
      // Ajuste o 'top' para compensar o Header Fixo (aprox -100px)
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Faz scroll suave até o campo de valor recebido e foca nele
   */
  private scrollToCashInput(): void {
    setTimeout(() => {
      const element = document.getElementById('received-amount-input');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }, 100);
  }

  /**
   * Encontra o primeiro campo inválido e faz scroll até ele
   */
  private scrollToFirstInvalidField(): void {
    setTimeout(() => {
      // Lista de campos do formulário de entrega na ordem de exibição
      const deliveryFields = [
        'zipcode',
        'address',
        'number',
        'neighborhood',
        'complement',
        'city',
        'state',
        'phone',
        'instructions'
      ];

      // Verificar campos do deliveryForm (após markAllAsTouched, todos estarão touched)
      for (const fieldName of deliveryFields) {
        const control = this.deliveryForm.get(fieldName);
        if (control && control.invalid) {
          const element = document.querySelector(`[formControlName="${fieldName}"]`);
          if (element) {
            const inputElement = element as HTMLElement;
            const headerOffset = 100;
            const elementPosition = inputElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
            // Tentar focar no input dentro do mat-form-field
            const input = inputElement.querySelector('input') || inputElement.querySelector('textarea') || inputElement;
            if (input && input.focus) {
              setTimeout(() => input.focus(), 300);
            }
            return;
          }
        }
      }

      // Verificar campos do paymentForm
      const paymentFields = ['method', 'received_amount'];
      for (const fieldName of paymentFields) {
        const control = this.paymentForm.get(fieldName);
        if (control && control.invalid) {
          const element = document.querySelector(`[formControlName="${fieldName}"]`);
          if (element) {
            const inputElement = element as HTMLElement;
            const headerOffset = 100;
            const elementPosition = inputElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
            const input = inputElement.querySelector('input') || inputElement.querySelector('textarea') || inputElement;
            if (input && input.focus) {
              setTimeout(() => input.focus(), 300);
            }
            return;
          }
        }
      }

      // Se não encontrou nenhum campo específico, fazer scroll até o formulário de endereço
      const addressForm = document.querySelector('.address-form-expandable');
      if (addressForm) {
        const headerOffset = 100;
        const elementPosition = (addressForm as HTMLElement).getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  public async onSubmit(): Promise<void> {
    console.log('--- DEBUG CHECKOUT: Início do onSubmit ---');

    // Verificar se a loja está aberta
    const isStoreOpen = this.storeStatusService.getCurrentStatus();
    if (!isStoreOpen) {
      this.toastr.error('Desculpe, a adega está fechada no momento. Não é possível realizar pedidos.', 'Loja Fechada');
      return;
    }

    const currentUser =
      typeof this.authService.getCurrentUser === 'function'
        ? this.authService.getCurrentUser()
        : typeof this.authService.getUser === 'function'
          ? this.authService.getUser()
          : null;

    console.log('Usuário logado (segundo o AuthService):', currentUser);

    if (!currentUser) {
      console.error('ERRO GRAVE: O usuário não está logado no Angular, mas o checkout foi permitido!');
      this.loading = false;
      this.isProcessingPayment = false;
      return;
    }

    // Validação de formulários com feedback visual
    if (!this.isDeliveryFormValid() || this.paymentForm.invalid) {
      // Expandir formulário de endereço se estiver fechado
      if (!this.showAddressForm) {
        this.showAddressForm = true;
      }
      
      // Marcar todos os campos como touched para mostrar erros
      this.deliveryForm.markAllAsTouched();
      this.paymentForm.markAllAsTouched();
      
      // Mostrar toastr de aviso
      this.toastr.warning('Por favor, preencha todos os campos obrigatórios (ex: Telefone, Número).', 'Campos Obrigatórios');
      
      // Aguardar um pouco para o formulário expandir antes de fazer scroll
      setTimeout(() => {
        this.scrollToFirstInvalidField();
      }, 200);
      
      return;
    }

    // Validar se a área de entrega é válida
    if (!this.isDeliveryAreaValid) {
      this.toastr.warning('Infelizmente não entregamos neste endereço. Por favor, escolha outro endereço ou CEP.', 'Fora da Área de Entrega');
      return;
    }

    this.isProcessingPayment = true;
    this.loading = true;
    this.error = null;
    this.checkoutState = 'form';

    try {
      const items = await firstValueFrom(this.cartItems$);

      if (!items || items.length === 0) {
        this.error = 'Seu carrinho está vazio';
        this.isProcessingPayment = false;
        this.loading = false;
        return;
      }

      const cartTotal = await firstValueFrom(this.cartTotal$);
      const normalizedCartTotal = Number.isFinite(cartTotal) ? Number(cartTotal) : 0;
      const orderTotal = normalizedCartTotal + this.deliveryFee;

      const paymentMethodMap: Record<string, string> = {
        cash: 'dinheiro',
        card: 'cartão de débito',
        pix: 'pix'
      };

      const paymentMethodValue = this.paymentForm.value.method || 'cash';
      const mappedPaymentMethod = paymentMethodMap[paymentMethodValue] || 'dinheiro';
      const isCashPayment = mappedPaymentMethod === 'dinheiro';

      // Validação para pagamento em dinheiro
      if (isCashPayment) {
        const receivedValue = this.paymentForm.value.received_amount || this.paymentForm.value.change;
        
        // Verificar se o valor foi preenchido
        if (!receivedValue || receivedValue === '' || receivedValue === null || receivedValue === undefined) {
          this.isProcessingPayment = false;
          this.loading = false;
          this.toastr.warning('Informe o valor para troco', 'Valor Obrigatório');
          this.scrollToCashInput();
          return;
        }

        const parsedReceived = Number(receivedValue);

        // Verificar se o valor é válido e maior ou igual ao total
        if (!Number.isFinite(parsedReceived) || parsedReceived <= 0) {
          this.isProcessingPayment = false;
          this.loading = false;
          this.toastr.warning('Informe um valor válido para troco', 'Valor Inválido');
          this.scrollToCashInput();
          return;
        }

        if (parsedReceived < orderTotal) {
          this.isProcessingPayment = false;
          this.loading = false;
          this.toastr.warning(`O valor informado (R$ ${parsedReceived.toFixed(2)}) é menor que o total do pedido (R$ ${orderTotal.toFixed(2)})`, 'Valor Insuficiente');
          this.scrollToCashInput();
          return;
        }
      }

      let receivedAmount: number | undefined;
      let changeAmount: number | undefined;

      if (isCashPayment) {
        const receivedValue = this.paymentForm.value.received_amount || this.paymentForm.value.change;
        const parsedReceived = Number(receivedValue);

        if (Number.isFinite(parsedReceived) && parsedReceived > 0) {
          receivedAmount = parsedReceived;
          changeAmount = parsedReceived >= orderTotal ? parsedReceived - orderTotal : 0;
        }
      } else {
        receivedAmount = undefined;
        changeAmount = undefined;
      }

      const deliveryData = this.useSavedAddress && this.selectedAddressId
        ? {
            address_id: this.selectedAddressId,
            phone: this.deliveryForm.value.phone,
            instructions: ''
          }
        : {
            name: 'Endereço de Entrega',
            ...this.deliveryForm.value
          };

      const orderPayload = {
        type: 'online',
        delivery: deliveryData,
        payment_method: mappedPaymentMethod,
        customer_name: deliveryData.address,
        customer_phone: deliveryData.phone,
        items: items
          .map(item => {
            if (item.isCombo && item.combo) {
              return {
                combo_id: item.combo.id,
                quantity: item.quantity,
                sale_type: 'garrafa' as const
              };
            }

            if (item.product) {
              return {
                product_id: item.product.id,
                quantity: item.quantity,
                sale_type: 'garrafa' as const
              };
            }

            return null;
          })
          .filter((item): item is {
            combo_id: number;
            quantity: number;
            sale_type: 'garrafa';
          } | {
            product_id: number;
            quantity: number;
            sale_type: 'garrafa';
          } => item !== null),
        delivery_fee: this.deliveryFee,
        received_amount: receivedAmount,
        change_amount: changeAmount
      };

      console.log("Payload que será enviado para 'createOrder':", orderPayload);

      this.orderService.createOrder(orderPayload).subscribe({
        next: (newlyCreatedOrder: Order) => {
          // Limpar carrinho imediatamente após criar o pedido com sucesso
          this.cartService.clearCart();
          
          if (paymentMethodValue !== 'pix') {
            this.loading = false;
            this.isProcessingPayment = false;
            this.toastr.success('Pedido recebido! (Pagamento na entrega)');
            this.router.navigate(['/pedidos']);
            return;
          }

          this.pixQrCodeBase64 = null;
          this.pixCopiaECola = null;
          this.safeQrCodeUrl = null;

          this.orderService.createPixPayment(newlyCreatedOrder.id).subscribe({
            next: (pixData: PixPaymentResponse) => {
              this.pixQrCodeBase64 = pixData.pix_qr_code_base64;
              this.pixCopiaECola = pixData.pix_copia_e_cola;

              if (this.pixQrCodeBase64) {
                this.safeQrCodeUrl = this.sanitizer.bypassSecurityTrustUrl(
                  'data:image/png;base64,' + this.pixQrCodeBase64
                );
              }

              this.checkoutState = 'awaiting_payment';
              this.isProcessingPayment = false;
              this.loading = false;

              this.startPaymentPolling(newlyCreatedOrder.id);
            },
            error: (err: unknown) => {
              console.error('Erro ao gerar PIX:', err);
              this.toastr.error('Erro ao gerar o PIX. Tente novamente.', 'Falha no Pagamento');
              this.isProcessingPayment = false;
              this.loading = false;
              this.checkoutState = 'form';
            }
          });
        },
        error: (err: any) => {
          console.error('Erro ao criar pedido:', err);
          // Extrair mensagem de erro específica do backend
          const errorMessage = err?.error?.error || err?.error?.message || 'Erro ao criar seu pedido. Verifique os dados.';
          this.toastr.error(errorMessage, 'Falha');
          this.isProcessingPayment = false;
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      this.loading = false;
      this.isProcessingPayment = false;
      this.toastr.error('Erro ao processar pedido.', 'Falha');
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

  /**
   * Copia o código PIX para a área de transferência
   */
  public copiarPix(): void {
    if (!this.pixCopiaECola) {
      return;
    }
    this.clipboard.copy(this.pixCopiaECola);
    this.toastr.success('Código PIX copiado!');
  }

  /**
   * Inicia a verificação (polling) do status do pagamento a cada 5 segundos.
   */
  startPaymentPolling(orderId: number): void {
    this.stopPaymentPolling();
    this.loadingMessage = 'Aguardando pagamento...';

    this.paymentPollingSub = timer(0, 5000).pipe(
      switchMap(() => this.orderService.getOrderById(orderId)),
      tap((order: Order) => {
        // O Laravel retorna 'payment' (singular) mesmo sendo HasMany
        const payments = (order as any).payment || order.payments || [];
        const paymentStatus = payments.length > 0 
          ? payments[0].status 
          : 'unknown';
        console.log(`[Polling] Status do pedido: ${order.status}, Status do pagamento: ${paymentStatus}`);
      }),
      takeWhile((order: Order) => {
        // Continua o polling enquanto:
        // 1. O pedido está pendente (aguardando pagamento) E
        // 2. Não há nenhum pagamento com status 'completed', 'failed' ou 'cancelled'
        // O Laravel retorna 'payment' (singular) mesmo sendo HasMany
        const payments = (order as any).payment || order.payments || [];
        const hasFinalStatus = payments.some(
          (payment: any) => ['completed', 'failed', 'cancelled', 'refunded'].includes(payment.status)
        );
        // Para quando o pagamento for completado (status muda para 'processing' ou outro)
        return order.status === 'pending' && !hasFinalStatus;
      }, true)
    ).subscribe({
      next: (order: Order) => {
        // O Laravel retorna 'payment' (singular) mesmo sendo HasMany
        const payments = (order as any).payment || order.payments || [];
        // Pega o primeiro pagamento (ou o único)
        const payment = Array.isArray(payments) ? payments[0] : payments;

        // Verificar se o pagamento foi completado OU se o pedido mudou para 'processing'
        // 'processing' significa que o pagamento foi aprovado e o pedido está aguardando preparo
        if ((payment && payment.status === 'completed') || order.status === 'processing') {
          // 1. PARE O POLLING (MUITO IMPORTANTE)
          this.stopPaymentPolling();
          
          // 2. MOSTRE A MENSAGEM DE SUCESSO
          this.loadingMessage = 'Pagamento Aprovado!';
          this.toastr.success('Pagamento aprovado! Redirecionando...', 'Sucesso!');
          
          // 3. LIMPE O CARRINHO
          this.cartService.clearCart();
          
          // 4. REDIRECIONE O USUÁRIO
          setTimeout(() => {
            this.router.navigate(['/pedidos']);
          }, 2500); // Espera 2.5s para o usuário ler a msg
          
        } else if (payment && (payment.status === 'failed' || payment.status === 'cancelled')) {
          // Se o pagamento falhar ou for cancelado
          this.stopPaymentPolling();
          this.loadingMessage = 'Pagamento não aprovado';
          this.toastr.error('O pagamento falhou ou foi cancelado. Tente novamente.', 'Erro');
          
          // Opcional: redirecionar de volta ao checkout após alguns segundos
          setTimeout(() => {
            this.checkoutState = 'form';
            this.loadingMessage = 'Aguardando pagamento...';
          }, 3000);
        }
      },
      error: (err) => {
        console.error('Erro durante o polling do pagamento', err);
        this.toastr.error('Houve um erro ao verificar seu pagamento. Tente recarregar a página.', 'Erro');
        // Não para o polling em caso de erro, para tentar novamente na próxima iteração
      }
    });
  }

  /**
   * Para o polling (timer)
   */
  stopPaymentPolling(): void {
    if (this.paymentPollingSub) {
      this.paymentPollingSub.unsubscribe();
      this.paymentPollingSub = undefined;
      console.log('[Polling] Verificação de pagamento interrompida.');
    }
  }

  /**
   * Garante que o polling pare se o usuário sair da tela
   */
  ngOnDestroy(): void {
    this.stopPaymentPolling();
  }

}
