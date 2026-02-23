import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
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
import { documentValidator, formatDocument } from '../../../core/validators/document.validator';
import { phoneValidator } from '../../../core/validators/phone.validator';

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
  userDataForm: FormGroup; // Formulário para CPF e Telefone do usuário
  guestUserForm: FormGroup; // Formulário para cadastro de guest user (Nome, CPF, Celular, Email, Senha)
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
  isGuestUser = false; // Flag para indicar se é usuário guest
  
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
  /** Revelação progressiva: detalhes do endereço só aparecem após buscar CEP */
  isAddressDetailsVisible = false;

  @ViewChild('numberInput') numberInputRef!: ElementRef<HTMLInputElement>;
  
  // Flags para campos condicionais do usuário
  needsDocumentNumber = false;
  needsPhone = false;

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
    private route: ActivatedRoute,
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
      instructions: ['']
    });

    this.paymentForm = this.fb.group({
      method: ['cash', Validators.required],
      received_amount: [''],
      change: ['']
    });

    // Formulário para dados do usuário (CPF e Telefone condicionais)
    this.userDataForm = this.fb.group({
      document_number: [''],
      phone: ['']
    });

    // Formulário para guest user (cadastro durante checkout: Nome, CPF, Telefone — sem e-mail)
    this.guestUserForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      document_number: ['', [Validators.required, documentValidator]],
      phone: ['', [Validators.required, phoneValidator()]],
      password: [''] // Opcional - se não preenchido, backend gera senha automática
    });

    // Inicializar observável do status da loja após injeção do serviço
    this.isStoreOpen$ = this.storeStatusService.status$;
  }

  /**
   * Sanitiza o valor de entrada, removendo caracteres não numéricos
   * e convertendo vírgula para ponto
   * Exemplos:
   * - 'R$ 50,00' -> 50.00
   * - '100,50' -> 100.50
   * - '100' -> 100.00
   * - '50.00' -> 50.00
   */
  private sanitizeMoneyValue(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    // Se já for número, retornar como está
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    // Converter para string e remover espaços
    let sanitized = String(value).trim();

    // Remover símbolos de moeda e espaços
    sanitized = sanitized.replace(/[R$\s]/g, '');

    // Substituir vírgula por ponto (formato brasileiro)
    sanitized = sanitized.replace(',', '.');

    // Remover tudo que não for número ou ponto
    sanitized = sanitized.replace(/[^0-9.]/g, '');

    // Garantir que há apenas um ponto decimal
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      // Se houver múltiplos pontos, manter apenas o primeiro
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    // Converter para número
    const parsed = parseFloat(sanitized);

    // Retornar 0 se não for um número válido
    return Number.isFinite(parsed) ? parsed : 0;
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
        const backendMessage =
          (error?.error && typeof error.error === 'object' && (error.error.message || error.error.error)) ||
          null;

        if (error.status === 422) {
          this.snackBar.open(
            backendMessage || 'Infelizmente não realizamos entregas para este CEP específico por restrições logísticas.',
            'Fechar',
            { duration: 5000 }
          );
        } else if (error.status === 404) {
          this.snackBar.open('Infelizmente, ainda não atendemos este CEP.', 'Fechar', { duration: 5000 });
        } else {
          this.snackBar.open('Erro ao calcular frete. Tente novamente.', 'Fechar', { duration: 4000 });
        }
      }
    });
  }


  ngOnInit(): void {
    // Inicializar observables
    this.cartItems$ = this.cartService.cartItems$;
    this.updateCartTotals();
    this.user$ = this.authService.user$;

    // Verificar se é guest user (não logado)
    const currentUser = this.authService.getCurrentUser();
    this.isGuestUser = !currentUser;

    // Guest: formulário usa apenas Nome, CPF e Telefone (sem e-mail)

    // Verificar dados do usuário e configurar campos condicionais
    this.user$.subscribe((user: User | null) => {
      if (user) {
        this.isGuestUser = false;
        
        // Verificar se precisa de CPF
        this.needsDocumentNumber = !user.document_number || user.document_number.trim() === '';
        
        // Verificar se precisa de Telefone
        this.needsPhone = !user.phone || user.phone.trim() === '';
        
        // Se precisar de CPF, adicionar validação obrigatória
        if (this.needsDocumentNumber) {
          this.userDataForm.get('document_number')?.setValidators([
            Validators.required,
            documentValidator
          ]);
        } else {
          this.userDataForm.get('document_number')?.clearValidators();
        }
        
        // Se precisar de Telefone, adicionar validação obrigatória
        if (this.needsPhone) {
          this.userDataForm.get('phone')?.setValidators([
            Validators.required,
            phoneValidator()
          ]);
        } else {
          this.userDataForm.get('phone')?.clearValidators();
        }
        
        // Atualizar validações
        this.userDataForm.get('document_number')?.updateValueAndValidity();
        this.userDataForm.get('phone')?.updateValueAndValidity();
      } else {
        this.isGuestUser = true;
      }
    });

    // Carregar endereços salvos apenas se estiver logado
    if (!this.isGuestUser) {
      this.loadAddresses();
    }
    
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
    this.isAddressDetailsVisible = false; // Reiniciar revelação progressiva
    
    // Telefone não é mais parte do formulário de endereço
    
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


  formatPhoneUserData(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    // Limita a 11 dígitos
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    
    // Formata baseado no tamanho
    if (value.length <= 11) {
      if (value.length <= 10) {
        // Telefone fixo: (XX) XXXX-XXXX
        value = value.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
      } else {
        // Celular: (XX) XXXXX-XXXX
        value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
      }
      this.userDataForm.get('phone')?.setValue(value, { emitEvent: false });
    }
  }

  formatPhoneGuest(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    // Limita a 11 dígitos
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    
    // Formata baseado no tamanho
    if (value.length <= 11) {
      if (value.length <= 10) {
        // Telefone fixo: (XX) XXXX-XXXX
        value = value.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
      } else {
        // Celular: (XX) XXXXX-XXXX
        value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
      }
      this.guestUserForm.get('phone')?.setValue(value, { emitEvent: false });
    }
  }

  formatDocument(event: any): void {
    const value = event.target.value;
    const formatted = formatDocument(value);
    this.userDataForm.get('document_number')?.setValue(formatted, { emitEvent: false });
  }

  /** Formata CPF/CNPJ no formulário de guest (cadastro durante checkout). */
  formatDocumentGuest(event: any): void {
    const value = event.target.value;
    const formatted = formatDocument(value);
    this.guestUserForm.get('document_number')?.setValue(formatted, { emitEvent: false });
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
        
        // Revelação progressiva: mostrar campos de endereço após CEP preenchido
        this.isAddressDetailsVisible = true;
        
        // Dispara a validação de área de entrega e cálculo de frete
        this.calculateFreteFromCep();
        
        this.loading = false;
        this.cdr.detectChanges();
        
        // UX: foco automático no campo Número para o usuário completar rapidamente
        setTimeout(() => this.numberInputRef?.nativeElement?.focus(), 100);
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
  /**
   * Obtém o valor sanitizado do campo received_amount para uso no template
   */
  getSanitizedReceivedAmount(): number {
    const value = this.paymentForm.get('received_amount')?.value;
    return this.sanitizeMoneyValue(value);
  }

  /**
   * Formata o valor ao sair do campo (blur)
   * Sanitiza e formata para exibição
   */
  onReceivedAmountBlur(event: any): void {
    const value = this.paymentForm.get('received_amount')?.value;
    if (value) {
      const sanitized = this.sanitizeMoneyValue(value);
      // Formatar com 2 casas decimais e vírgula (formato brasileiro)
      if (sanitized > 0) {
        const formatted = sanitized.toFixed(2).replace('.', ',');
        this.paymentForm.patchValue({ received_amount: formatted }, { emitEvent: false });
      }
    }
  }

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
   * Define automaticamente o valor exato em dinheiro (total do pedido)
   * para o campo de troco, facilitando quando o cliente não precisa de troco.
   */
  async setExactCashAmount(): Promise<void> {
    const cartTotal = await firstValueFrom(this.cartTotal$);
    const normalizedCartTotal = Number.isFinite(cartTotal) ? Number(cartTotal) : 0;
    const orderTotal = normalizedCartTotal + this.deliveryFee;

    if (orderTotal <= 0) {
      return;
    }

    const formatted = orderTotal.toFixed(2).replace('.', ',');
    this.paymentForm.patchValue({ received_amount: formatted });
    this.paymentForm.get('received_amount')?.markAsDirty();
  }

  /** Retorna CPF ou e-mail atual (guest ou logado) para passar ao login ao redirecionar. */
  private getIdentifierForLogin(): string {
    const raw = this.isGuestUser
      ? this.guestUserForm.get('document_number')?.value
      : (this.userDataForm.get('document_number')?.value || this.authService.getCurrentUser()?.document_number || this.authService.getCurrentUser()?.email);
    return typeof raw === 'string' ? raw.trim() : '';
  }


  /**
   * Encontra o primeiro campo inválido e faz scroll até ele
   * Melhorado para funcionar com Angular Material e múltiplos formulários
   */
  private scrollToFirstInvalidField(): void {
    setTimeout(() => {
      // Prioridade 1: Guest User Form (se for guest)
      if (this.isGuestUser) {
        const guestFields = ['name', 'document_number', 'phone', 'password'];
        for (const fieldName of guestFields) {
          const control = this.guestUserForm.get(fieldName);
          if (control && control.invalid && control.touched) {
            const element = document.querySelector(`[formControlName="${fieldName}"]`);
            if (element) {
              this.scrollToElement(element as HTMLElement);
              return;
            }
          }
        }
      }

      // Prioridade 2: User Data Form (CPF/Telefone condicionais)
      if (this.needsDocumentNumber || this.needsPhone) {
        const userDataFields = ['document_number', 'phone'];
        for (const fieldName of userDataFields) {
          const control = this.userDataForm.get(fieldName);
          if (control && control.invalid && control.touched) {
            const element = document.getElementById(`user-${fieldName}`) || 
                          document.querySelector(`[formControlName="${fieldName}"]`);
            if (element) {
              this.scrollToElement(element as HTMLElement);
              return;
            }
          }
        }
      }

      // Prioridade 3: Delivery Form
      const deliveryFields = [
        'zipcode',
        'address',
        'number',
        'neighborhood',
        'complement',
        'city',
        'state',
        'instructions'
      ];

      for (const fieldName of deliveryFields) {
        const control = this.deliveryForm.get(fieldName);
        if (control && control.invalid && control.touched) {
          const element = document.querySelector(`[formControlName="${fieldName}"]`);
          if (element) {
            this.scrollToElement(element as HTMLElement);
            return;
          }
        }
      }

      // Prioridade 4: Payment Form
      const paymentFields = ['method', 'received_amount'];
      for (const fieldName of paymentFields) {
        const control = this.paymentForm.get(fieldName);
        if (control && control.invalid && control.touched) {
          const element = document.querySelector(`[formControlName="${fieldName}"]`) ||
                         document.getElementById('received-amount-input');
          if (element) {
            this.scrollToElement(element as HTMLElement);
            return;
          }
        }
      }

      // Fallback: Buscar qualquer campo com ng-invalid
      const firstInvalid = document.querySelector('.ng-invalid');
      if (firstInvalid) {
        this.scrollToElement(firstInvalid as HTMLElement);
      }
    }, 150);
  }

  /**
   * Faz scroll suave até um elemento e foca nele
   */
  private scrollToElement(element: HTMLElement): void {
    const headerOffset = 100;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });

    // Tentar focar no input dentro do mat-form-field
    setTimeout(() => {
      const input = element.querySelector('input') || 
                   element.querySelector('textarea') || 
                   element.querySelector('select') ||
                   element;
      
      if (input && typeof (input as any).focus === 'function') {
        (input as any).focus();
      }
    }, 400);
  }

  public async onSubmit(): Promise<void> {
    console.log('--- DEBUG CHECKOUT: Início do onSubmit ---');

    // Verificar se a loja está aberta
    const isStoreOpen = this.storeStatusService.getCurrentStatus();
    if (!isStoreOpen) {
      this.toastr.error('Desculpe, a adega está fechada no momento. Não é possível realizar pedidos.', 'Loja Fechada');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    this.isGuestUser = !currentUser;

    // Se for guest user, validar formulário de cadastro
    if (this.isGuestUser) {
      this.guestUserForm.markAllAsTouched();
      
      if (this.guestUserForm.invalid) {
        this.toastr.warning('Por favor, preencha todos os campos obrigatórios (Nome, CPF e Telefone).', 'Dados Obrigatórios');
        this.scrollToFirstInvalidField();
        return;
      }
    }

    // Validação de formulários com feedback visual
    // Primeiro verificar dados do usuário (CPF e Telefone condicionais)
    if (this.needsDocumentNumber || this.needsPhone) {
      this.userDataForm.markAllAsTouched();
      
      if (this.userDataForm.invalid) {
        this.toastr.warning('Por favor, preencha os dados obrigatórios (CPF e/ou Telefone).', 'Dados Obrigatórios');
        
        setTimeout(() => {
          this.scrollToFirstInvalidField();
        }, 200);
        
        return;
      }
    }
    
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
      }, 300);
      
      return;
    }

    // Validar se a área de entrega é válida
    if (!this.isDeliveryAreaValid) {
      this.toastr.warning('Infelizmente não entregamos neste endereço. Por favor, escolha outro endereço ou CEP.', 'Fora da Área de Entrega');
      return;
    }

    // Verificar antes de criar: se Guest, checar se CPF já existe (evita pedidos fantasmas)
    if (this.isGuestUser) {
      const cpf = (this.guestUserForm.get('document_number')?.value || '').replace(/\D/g, '');
      if (cpf.length !== 11) {
        this.toastr.warning('Informe um CPF válido.', 'Dados Obrigatórios');
        return;
      }
      this.loading = true;
      this.authService.checkUser(cpf).subscribe({
        next: (response) => {
          this.loading = false;
          if (response.exists) {
            this.toastr.info('Este CPF já tem cadastro. Vamos te logar para finalizar.', '', { timeOut: 5000 });
            const cpfLimpo = cpf;
            setTimeout(() => {
              this.router.navigate(['/login'], {
                queryParams: { identifier: cpfLimpo, returnUrl: '/checkout' }
              });
            }, 1500);
            return;
          }
          this.finalizeOrder();
        },
        error: () => {
          this.loading = false;
          this.toastr.error('Erro ao verificar cadastro. Tente novamente.');
        }
      });
      return;
    }

    this.finalizeOrder();
  }

  /** Fluxo de criação do pedido (após validações e, se guest, após checkUser retornar exists: false). */
  private async finalizeOrder(): Promise<void> {
    this.isProcessingPayment = true;
    this.loading = true;
    this.error = null;
    this.checkoutState = 'form';

    const currentUser = this.authService.getCurrentUser();
    this.isGuestUser = !currentUser;

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

        // Sanitizar o valor antes de fazer o parse
        const parsedReceived = this.sanitizeMoneyValue(receivedValue);

        // Verificar se o valor é válido e maior ou igual ao total
        if (parsedReceived <= 0) {
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
        // Sanitizar o valor antes de fazer o parse
        const parsedReceived = this.sanitizeMoneyValue(receivedValue);

        if (parsedReceived > 0) {
          receivedAmount = parsedReceived;
          changeAmount = parsedReceived >= orderTotal ? parsedReceived - orderTotal : 0;
        }
      } else {
        receivedAmount = undefined;
        changeAmount = undefined;
      }

      // Obter dados do usuário (guest ou logado)
      let userPhone: string | null = null;
      let userDocumentNumber: string | null = null;
      let userName: string | null = null;
      let userEmail: string | null = null;
      let userPassword: string | null = null;

      if (this.isGuestUser) {
        // Dados do guest user (Nome, CPF, Telefone — e-mail gerado no backend)
        userName = this.guestUserForm.value.name;
        userDocumentNumber = this.guestUserForm.value.document_number?.replace(/\D/g, '') || null;
        userPhone = this.guestUserForm.value.phone || null;
        userPassword = this.guestUserForm.value.password || null; // Opcional
        userEmail = null; // Backend gera e-mail técnico
      } else {
        // Dados do usuário logado
        userPhone = this.needsPhone && this.userDataForm.value.phone
          ? this.userDataForm.value.phone
          : (currentUser?.phone || null);
        
        userDocumentNumber = this.needsDocumentNumber && this.userDataForm.value.document_number
          ? this.userDataForm.value.document_number.replace(/\D/g, '')
          : null;
        
        userName = currentUser?.name || null;
        userEmail = currentUser?.email || null;
      }

      const deliveryData = this.useSavedAddress && this.selectedAddressId
        ? {
            address_id: this.selectedAddressId,
            phone: userPhone,
            instructions: ''
          }
        : {
            name: 'Endereço de Entrega',
            ...this.deliveryForm.value,
            phone: userPhone
          };

      const orderPayload: any = {
        type: 'online',
        delivery: deliveryData,
        payment_method: mappedPaymentMethod,
        customer_name: userName || deliveryData.address,
        customer_email: userEmail,
        customer_phone: userPhone,
        customer_document: userDocumentNumber,
        items: items
          .map(item => {
            if (item.isCombo && item.combo && item.bundleSelections) {
              const selections: Array<{ bundle_group_id: number; product_id: number; quantity: number; sale_type: 'dose' | 'garrafa'; price: number }> = [];
              for (const groupId of Object.keys(item.bundleSelections)) {
                const opts = item.bundleSelections[+groupId] || [];
                for (const opt of opts) {
                  const unitPrice = opt.sale_type === 'dose'
                    ? (opt.product?.dose_price ?? 0)
                    : (opt.product?.price ?? 0) + (opt.price_adjustment ?? 0);
                  selections.push({
                    bundle_group_id: +groupId,
                    product_id: opt.product_id,
                    quantity: opt.quantity,
                    sale_type: opt.sale_type,
                    price: unitPrice
                  });
                }
              }
              return {
                product_bundle_id: item.combo.id,
                quantity: item.quantity,
                sale_type: 'garrafa' as const,
                price: item.price,
                selections
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
          .filter((item): item is
            | { product_bundle_id: number; quantity: number; sale_type: 'garrafa'; price: number; selections: any[] }
            | { product_id: number; quantity: number; sale_type: 'garrafa' } => item !== null),
        delivery_fee: this.deliveryFee,
        received_amount: receivedAmount,
        change_amount: changeAmount
      };

      // Adicionar dados do guest user se necessário (sem e-mail; backend gera e-mail técnico)
      if (this.isGuestUser) {
        orderPayload.guest_user = {
          name: userName,
          document_number: userDocumentNumber,
          phone: userPhone,
          password: userPassword || undefined // Opcional - backend gera automaticamente se vazio
        };
      } else {
        // Para usuário logado, adicionar document_number e phone se necessário
        if (userDocumentNumber) {
          orderPayload.document_number = userDocumentNumber;
        }
        
        if (this.needsPhone && userPhone) {
          orderPayload.phone = userPhone;
        }
      }

      console.log("Payload que será enviado para 'createOrder':", orderPayload);

      this.orderService.createOrder(orderPayload).subscribe({
        next: (response: any) => {
          // Se a resposta incluir token (guest user criado), fazer auto-login
          if (response.access_token && this.isGuestUser) {
            this.authService.saveAuth({
              access_token: response.access_token,
              token_type: response.token_type || 'Bearer',
              user: response.user
            });
            this.toastr.success('Conta criada com sucesso! Você foi logado automaticamente.', 'Bem-vindo!');
            // Atualizar flag após login
            this.isGuestUser = false;
          }

          // A resposta pode ser Order diretamente ou { order: Order, access_token: ... }
          const newlyCreatedOrder: Order = response.order || response;
          
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

              // Força a tela a ir para o topo para o usuário ver o QR Code
              window.scrollTo({ top: 0, behavior: 'smooth' });

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
          this.isProcessingPayment = false;
          this.loading = false;
          const code = err?.error?.error;
          const status = err?.status;
          if (status === 401 || code === 'user_required' || code === 'user_already_exists') {
            const identifier = this.getIdentifierForLogin();
            const cpf = typeof identifier === 'string' ? identifier.replace(/\D/g, '') : '';
            const cpfParaUrl = cpf.length === 11 ? cpf : (identifier || '');
            this.router.navigate(['/login'], {
              queryParams: { identifier: cpfParaUrl, returnUrl: '/checkout' }
            });
            this.toastr.info(
              code === 'user_already_exists' ? 'Encontramos seu cadastro! Entre para finalizar.' : 'Entre com sua conta para finalizar o pedido.',
              code === 'user_already_exists' ? '' : 'Login necessário'
            );
            return;
          }
          const errorMessage = err?.error?.message ?? err?.error?.error ?? 'Erro ao criar seu pedido. Verifique os dados.';
          const errorTitle = err?.error?.error && err?.error?.error !== errorMessage ? err.error.error : 'Falha';
          this.toastr.error(errorMessage, errorTitle);
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
   * Incrementa a quantidade do item
   */
  increment(item: CartItem): void {
    this.updateQuantity(item, 1);
  }

  /**
   * Decrementa a quantidade do item
   */
  decrement(item: CartItem): void {
    this.updateQuantity(item, -1);
  }

  /**
   * Atualiza a quantidade do item no carrinho
   */
  updateQuantity(item: CartItem, change: number): void {
    const newQuantity = item.quantity + change;
    if (newQuantity > 0) {
      // Validar estoque antes de aumentar (apenas para produtos, não combos)
      if (change > 0 && item.product && !item.isCombo) {
        if (newQuantity > item.product.current_stock) {
          return; // O CartService já mostrará o toastr
        }
      }
      this.cartService.updateQuantity(item.id, newQuantity);
    } else {
      this.removeItem(item);
    }
  }

  /**
   * Remove o item do carrinho
   */
  async removeItem(item: CartItem): Promise<void> {
    this.cartService.removeItem(item.id);
    
    // Verificar se o carrinho ficou vazio após remover
    try {
      const items = await firstValueFrom(this.cartItems$);
      if (!items || items.length === 0) {
        // Se o carrinho ficou vazio, redirecionar para a página inicial ou mostrar mensagem
        this.toastr.info('Seu carrinho está vazio. Redirecionando...', 'Carrinho Vazio');
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao verificar carrinho:', error);
    }
  }

  /**
   * Verifica se pode aumentar a quantidade do item
   */
  canIncreaseQuantity(item: CartItem): boolean {
    if (item.isCombo || !item.product) {
      return true; // Combos não têm limite de estoque
    }
    return item.quantity < item.product.current_stock;
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
