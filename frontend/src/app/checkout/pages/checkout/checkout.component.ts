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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, timer } from 'rxjs';
import { map, switchMap, takeWhile, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
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
    MatTooltipModule,
    ProductSuggestionsComponent
  ]
})
export class CheckoutComponent implements OnInit, OnDestroy {
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

  // --- NOVAS PROPRIEDADES PARA PAGAMENTO PIX ---
  // Controla o que o cliente vê: 'form' (formulário) ou 'awaiting_payment' (QR Code)
  public checkoutState: 'form' | 'awaiting_payment' = 'form';
  public pixQrCodeBase64: string | null = null;
  public pixCopiaECola: string | null = null;
  public isProcessingPayment = false;
  private paymentPollingSub?: Subscription;
  // ---------------------------------------------

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
    private cdr: ChangeDetectorRef,
    private clipboard: Clipboard,
    private toastr: ToastrService
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
      change: [''], // Troco para (legacy, mantido para compatibilidade)
      // Campo condicional para CPF/CNPJ (habilitado apenas se PIX e usuário não tiver documento)
      payerDocument: [{ value: null, disabled: true }]
    });
  }
  // Método central para buscar frete por CEP
  private _fetchFrete(cep: string): void {
    if (!cep || cep.replace(/\D/g, '').length < 8) {
      this.deliveryFee = 0;
      this.estimatedTime = '';
      return;
    }

    this.loadingDeliveryZones = true;
    this.deliveryZoneService.calculateFrete(cep).subscribe({
      next: (response) => {
        // parseFloat garante que '9.90' (string) vire 9.90 (number)
        // Usar || 0 para garantir que NaN ou null virem 0
        const valorFrete = response.valor_frete;
        if (valorFrete === null || valorFrete === undefined) {
          this.deliveryFee = 0;
        } else {
          const parsed = parseFloat(String(valorFrete));
          this.deliveryFee = isNaN(parsed) ? 0 : parsed;
        }
        this.estimatedTime = response.tempo_estimado || '';
        this.loadingDeliveryZones = false;
      },
      error: (error) => {
        console.error('Erro ao calcular frete:', error);
        this.deliveryFee = 0;
        this.estimatedTime = 'Não disponível';
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
    this.cartTotal$ = this.cartItems$.pipe(
      map((items: CartItem[]) => {
        const total = items.reduce((sum: number, item: CartItem) => {
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          return sum + (quantity * price);
        }, 0);
        // Garantir que o resultado seja sempre um number válido
        return isNaN(total) ? 0 : Number(total.toFixed(2));
      })
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

    // Observar mudanças no método de pagamento para habilitar/desabilitar campo de CPF/CNPJ
    this.watchPaymentMethod();
  }

  /**
   * Observa mudanças no método de pagamento e habilita/desabilita o campo de CPF/CNPJ
   */
  private watchPaymentMethod(): void {
    this.paymentForm.get('method')?.valueChanges.subscribe(method => {
      const docControl = this.paymentForm.get('payerDocument');
      const currentUser = this.authService.getUser();

      // Se o método for 'pix' E o usuário não tiver documento salvo...
      if (method === 'pix' && currentUser && !currentUser.document_number) {
        // ...habilite e exija o campo de CPF/CNPJ.
        docControl?.setValidators([Validators.required, Validators.pattern(/^[0-9]{11,14}$/)]);
        docControl?.enable();
      } else {
        // ...senão, desabilite e limpe.
        docControl?.clearValidators();
        docControl?.disable();
        docControl?.setValue(null);
      }
      docControl?.updateValueAndValidity();
    });
  }

  /**
   * Formata o documento (CPF ou CNPJ) durante a digitação
   */
  formatPayerDocument(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    // Formata CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (value.length <= 11) {
      // Formatação CPF: 000.000.000-00
      value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
    } else if (value.length <= 14) {
      // Formatação CNPJ: 00.000.000/0000-00
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    }
    
    this.paymentForm.get('payerDocument')?.setValue(value, { emitEvent: false });
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
   * Calcula o frete a partir do CEP do formulário
   */
  public calculateFreteFromCep(): void {
    const cepControl = this.deliveryForm.get('zipcode');
    if (cepControl && cepControl.valid && cepControl.value) {
      this._fetchFrete(cepControl.value);
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

      // Obter valores do formulário (incluindo campos desabilitados)
      const paymentFormValue = this.paymentForm.getRawValue();

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
        change_amount: isCashPayment ? changeAmount : undefined,
        // Envia o CPF/CNPJ que o cliente digitou, se ele foi habilitado (remove formatação)
        document_number_override: paymentFormValue.payerDocument 
          ? paymentFormValue.payerDocument.replace(/\D/g, '') 
          : undefined
      };

      console.log('Enviando pedido:', orderData);
      console.log('Items processados:', orderData.items);
      console.log('Items originais:', items);

      // Enviar pedido para o backend
      this.orderService.createOrder(orderData).subscribe({
        next: (response) => {
          console.log('Pedido criado com sucesso:', response);

          // Limpar o carrinho
          this.cartService.clearCart();

          // Redirecionar baseado no método de pagamento
          const paymentMethod = this.paymentForm.value.method;
          
          // Se o pagamento NÃO for PIX, o fluxo termina aqui
          if (paymentMethod !== 'pix') {
            this.loading = false;
            if (paymentMethod === 'cash') {
              // Dinheiro na entrega
              this.snackBar.open(`Pedido #${response.order_number} criado com sucesso! Pagamento em dinheiro na entrega.`, 'Fechar', { duration: 5000 });
            } else if (paymentMethod === 'card') {
              // Cartão na entrega
              this.snackBar.open(`Pedido #${response.order_number} criado com sucesso! Pagamento com cartão na entrega.`, 'Fechar', { duration: 5000 });
            }
            this.router.navigate(['/pedidos']);
            return;
          }

          // --- ETAPA 2: Se for PIX, criar o pagamento no Mercado Pago ---
          this.isProcessingPayment = true;
          this.orderService.createPixPayment(response.id).subscribe({
            next: (pixData) => {
              console.log('Pagamento PIX criado:', pixData);
              this.pixQrCodeBase64 = pixData.pix_qr_code_base64;
              this.pixCopiaECola = pixData.pix_copia_e_cola;

              // --- ETAPA 3: Mudar a tela para mostrar o PIX ---
              this.checkoutState = 'awaiting_payment';
              this.isProcessingPayment = false;
              this.loading = false;

              // --- INICIA O POLLING ---
              this.startPaymentPolling(response.id);
            },
            error: (err) => {
              console.error('Erro ao gerar PIX:', err);
              this.snackBar.open('Erro ao gerar o PIX. Tente novamente.', 'Fechar', { duration: 5000 });
              this.isProcessingPayment = false;
              this.loading = false;
            }
          });
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

  /**
   * Copia o código PIX para a área de transferência
   */
  public copiarPix(): void {
    if (!this.pixCopiaECola) {
      return; // Proteção para caso o valor ainda não exista
    }

    // Usa o serviço Clipboard do CDK para copiar o texto
    this.clipboard.copy(this.pixCopiaECola);

    // Dá um feedback visual para o usuário
    this.toastr.success('Código PIX copiado para a área de transferência!');
  }

  /**
   * Inicia a verificação (polling) do status do pagamento a cada 5 segundos.
   */
  startPaymentPolling(orderId: number): void {
    // Começa imediatamente (0), e depois repete a cada 5 segundos (5000)
    this.paymentPollingSub = timer(0, 5000).pipe(
      // switchMap cancela a requisição anterior se uma nova for feita
      switchMap(() => {
        return this.orderService.getOrderById(orderId);
      }),
      // Notifica o status (útil para debug)
      tap(order => console.log(`[Polling] Status do pedido: ${order.status}`)),
      // Continue checando ENQUANTO o status for 'pending'
      takeWhile(order => order.status === 'pending', true)
    ).subscribe({
      next: (order) => {
        // Este 'next' é chamado na última vez (quando o status MUDA)
        if (order.status !== 'pending') {
          this.stopPaymentPolling(); // Para o timer

          // Sucesso!
          this.toastr.success('Seu pagamento foi aprovado!', 'Pagamento Recebido!');

          // Redireciona o cliente para a tela de "meus pedidos"
          this.router.navigate(['/pedidos', order.id]);
        }
      },
      error: (err) => {
        console.error("Erro durante o polling do pagamento", err);
        this.toastr.error('Houve um erro ao verificar seu pagamento.');
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
      console.log("[Polling] Verificação de pagamento interrompida.");
    }
  }

  /**
   * Garante que o polling pare se o usuário sair da tela
   */
  ngOnDestroy(): void {
    this.stopPaymentPolling();
  }

  /**
   * Navega para a página de pedidos
   */
  goToOrders(): void {
    this.stopPaymentPolling();
    this.router.navigate(['/pedidos']);
  }
}
