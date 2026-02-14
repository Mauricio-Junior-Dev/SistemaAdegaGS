import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, map, catchError } from 'rxjs/operators';

import { CashService } from '../../services/cash.service';
import { StockService } from '../../../core/services/stock.service';
import { OrderService, PaymentMethod, CreateOrderRequest, CreateOrderResponse, Product, Customer, CustomerAddress } from '../../services/order.service';
import { QuickCustomerDialogComponent } from './dialogs/quick-customer-dialog.component';
import { CashStatus, CashTransaction } from '../../models/cash.model';
import { SettingsService, SystemSettings } from '../../../admin/services/settings.service';
import { OpenCashDialogComponent } from './dialogs/open-cash-dialog.component';
import { SangriaDialogComponent, SangriaResult } from './dialogs/sangria-dialog.component';
import { PrintConfirmationDialogComponent } from './dialogs/print-confirmation-dialog.component';
import { CloseCashDialogComponent } from './dialogs/close-cash-dialog.component';
import { CopaoModalComponent, CopaoResult } from './dialogs/copao-modal.component';
import { SaleTypeDialogComponent, SaleTypeResult } from './dialogs/sale-type-dialog.component';
import { ComboSelectionDialogComponent, ComboSelectionResult } from './dialogs/combo-selection-dialog.component';
import { DeliveryZoneService } from '../../../services/delivery-zone.service';
import { AddressService, Address, CreateAddressRequest } from '../../../core/services/address.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface CartItem {
  product?: Product;
  combo?: any; // ProductBundle para combos
  is_combo?: boolean;
  /** Seleções do combo (grupo id -> opções) para envio no pedido e impressão */
  bundleSelections?: { [groupId: number]: Array<{ id: number; group_id: number; product_id: number; quantity: number; sale_type: 'dose' | 'garrafa'; price_adjustment?: number }> };
  quantity: number;
  sale_type: 'dose' | 'garrafa';
  subtotal: number;
}

@Component({
  selector: 'app-caixa',
  templateUrl: './caixa.component.html',
  styleUrls: ['./caixa.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDialogModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule
  ]
})
export class CaixaComponent implements OnInit, OnDestroy {
  // Status do Caixa
  cashStatus: CashStatus | null = null;
  loading = true;

  // Carrinho
  cartItems: CartItem[] = [];
  total = 0;

  // Busca de Produtos
  searchTerm = '';
  searchResults: Product[] = [];
  selectedProduct: Product | null = null;
  quantity = 1;
  saleType: 'dose' | 'garrafa' = 'garrafa';

  // Cliente
  customerName = '';
  customerPhone = '';
  customerEmail = '';
  customerDocument = '';
  selectedCustomer: Customer | null = null;
  customerSearchTerm = '';
  customerSearchResults: Customer[] = [];
  showCustomerSearch = false;

  // Troco (legado - usado quando selectedPaymentMethod único)
  receivedAmount = 0;
  changeAmount = 0;
  showChangeSection = false;
  
  // Pagamentos múltiplos (Split Payment - PDV)
  payments: { method: PaymentMethod; amount: number; received_amount?: number; change?: number }[] = [];
  inputAmount = 0;
  selectedMethod: PaymentMethod = 'dinheiro';
  
  // Controle de visibilidade do valor do caixa
  showCashValue = false;
  // Settings
  settings: SystemSettings | null = null;
  
  // Pagamento na Entrega
  isPayOnDelivery = false;
  // Controle se a taxa de entrega será cobrada no total/pedido
  isDeliveryFeeEnabled = false;
  
  // Método de Pagamento Selecionado
  selectedPaymentMethod: PaymentMethod | null = null;
  
  // Endereços e Frete
  customerAddresses: CustomerAddress[] = [];
  selectedAddressId: number | null = null;
  deliveryFee = 0;
  loadingDeliveryFee = false;
  estimatedDeliveryTime = '';

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private customerSearchSubject = new Subject<string>();

  constructor(
    private cashService: CashService,
    private stockService: StockService,
    private orderService: OrderService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private settingsService: SettingsService,
    private deliveryZoneService: DeliveryZoneService,
    private addressService: AddressService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (term) {
        this.searchProducts(term);
      } else {
        this.searchResults = [];
      }
    });

    // Configurar busca de clientes com debounce
    this.customerSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (term && term.length >= 2) {
        this.searchCustomers(term);
      } else {
        this.customerSearchResults = [];
      }
    });
  }

  openSangriaDialog(): void {
    if (!this.cashStatus) {
      this.toastr.warning('Caixa não está aberto', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }

    const dialogRef = this.dialog.open(SangriaDialogComponent, {
      width: '420px',
      data: { currentAmount: this.cashStatus.current_amount }
    });

    dialogRef.afterClosed().subscribe((result: SangriaResult | undefined) => {
      if (!result) return;

      this.cashService.addTransaction({
        type: 'saida',
        amount: result.amount,
        description: `Sangria: ${result.description}`
      }).subscribe({
        next: () => {
          // Atualiza saldo em memória
          if (this.cashStatus) {
            this.cashStatus.current_amount = Math.max(0, this.cashStatus.current_amount - result.amount);
          }
          this.toastr.success('Sangria registrada com sucesso', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        },
        error: () => {
          this.toastr.error('Erro ao registrar sangria', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        }
      });
    });
  }

  ngOnInit(): void {
    this.loadCashStatus();
    // Carregar configurações para habilitar métodos de pagamento
    this.settingsService.getSettings().subscribe({
      next: (s) => this.settings = s,
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCashStatus(): void {
    this.cashService.getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: status => {
          this.cashStatus = status;
          this.loading = false;
        },
        error: error => {
          console.error('Erro ao carregar status do caixa:', error);
          this.toastr.error('Erro ao carregar status do caixa', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
          this.loading = false;
        }
      });
  }

  openCash(): void {
    const dialogRef = this.dialog.open(OpenCashDialogComponent, {
      width: '360px'
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result?: { initialAmount: number }) => {
        if (!result || result.initialAmount === undefined) {
          return;
        }

        this.loading = true;
        this.cashService.openCash(result.initialAmount)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: status => {
              this.cashStatus = status;
              this.loading = false;
              this.toastr.success('Caixa aberto com sucesso', '', {
                toastClass: 'modern-toast-notification',
                positionClass: 'toast-bottom-center',
                timeOut: 3000
              });
            },
            error: error => {
              console.error('Erro ao abrir caixa:', error);
              this.loading = false;
              this.toastr.error('Erro ao abrir caixa', '', {
                toastClass: 'modern-toast-notification',
                positionClass: 'toast-bottom-center',
                timeOut: 3000
              });
            }
          });
      });
  }

  onSearch(event: any): void {
    this.searchSubject.next(event.target.value);
  }

  searchProducts(term: string): void {
    this.stockService.getStock({ search: term })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          // Exibir também produtos com estoque zerado para sinalização visual
          this.searchResults = response.data;
        },
        error: error => {
          console.error('Erro ao buscar produtos:', error);
          this.toastr.error('Erro ao buscar produtos', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        }
      });
  }

  searchCustomers(term: string): void {
    this.orderService.searchCustomers(term)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: customers => {
          this.customerSearchResults = customers;
        },
        error: error => {
          console.error('Erro ao buscar clientes:', error);
          this.toastr.error('Erro ao buscar clientes: ' + error.message, '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        }
      });
  }

  /**
   * Usa o texto digitado como nome de cliente avulso (sem cadastro),
   * preenchendo apenas customer_name e deixando customer_id nulo.
   */
  useQuickCustomerName(): void {
    const name = (this.customerSearchTerm || '').trim();
    if (!name) {
      return;
    }

    // Cliente avulso: apenas nome, sem vincular a um registro de cliente
    this.selectedCustomer = null;
    this.customerName = name;
    this.customerPhone = '';
    this.customerEmail = '';
    this.customerDocument = '';
    this.customerSearchResults = [];
  }

  onCustomerSearch(term: string): void {
    this.customerSearchTerm = term;
    this.customerSearchSubject.next(this.customerSearchTerm);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.customerName = customer.name;
    this.customerPhone = customer.phone || '';
    this.customerEmail = customer.email;
    this.customerDocument = customer.document_number || '';
    this.customerSearchTerm = '';
    this.customerSearchResults = [];
    this.showCustomerSearch = false;
    
    // Carregar endereços do cliente
    this.loadCustomerAddresses().subscribe();
  }
  
  loadCustomerAddresses(selectAddressId?: number): Observable<CustomerAddress[]> {
    if (!this.selectedCustomer) {
      this.customerAddresses = [];
      this.cdr.detectChanges();
      return of([]);
    }
    
    // SEMPRE buscar endereços da API (ignorar selectedCustomer.addresses que pode estar desatualizado)
    return this.http.get<Address[]>(`${environment.apiUrl}/addresses?user_id=${this.selectedCustomer.id}`)
      .pipe(
        takeUntil(this.destroy$),
        map((addresses) => {
          // Criar nova referência do array para forçar detecção de mudança
          this.customerAddresses = addresses.map(addr => ({
            id: addr.id,
            name: addr.name,
            street: addr.street,
            number: addr.number,
            complement: addr.complement,
            neighborhood: addr.neighborhood,
            full_address: this.addressService.formatAddress(addr),
            short_address: this.addressService.formatShortAddress(addr),
            is_default: addr.is_default
          }));
          
          // Selecionar endereço padrão se houver, senão usar o primeiro, ou o ID fornecido
          let addressToSelect: CustomerAddress | undefined;
          if (selectAddressId) {
            addressToSelect = this.customerAddresses.find(addr => addr.id === selectAddressId);
          }
          if (!addressToSelect) {
            addressToSelect = this.customerAddresses.find(addr => addr.is_default) || this.customerAddresses[0];
          }
          
          if (addressToSelect) {
            this.selectedAddressId = addressToSelect.id;
            // Se já está marcado como entrega, calcular frete imediatamente
            if (this.isPayOnDelivery) {
              // Usar setTimeout para garantir que o selectedAddressId foi definido
              setTimeout(() => {
                this.calculateDeliveryFee(addressToSelect!.id);
              }, 100);
            }
          }
          
          // Forçar detecção de mudança para atualizar a view
          this.cdr.detectChanges();
          
          return this.customerAddresses;
        }),
        catchError((error) => {
          console.error('Erro ao carregar endereços:', error);
          this.customerAddresses = [];
          this.cdr.detectChanges();
          return of([]);
        })
      );
  }
  
  onAddressChange(addressId: number | null): void {
    this.selectedAddressId = addressId;
    if (addressId && this.isPayOnDelivery) {
      this.calculateDeliveryFee(addressId);
    } else {
      // Ao limpar endereço ou quando não é entrega, não considerar taxa de entrega
      this.deliveryFee = 0;
      this.estimatedDeliveryTime = '';
      this.updateTotal();
    }
  }
  
  calculateDeliveryFee(addressId: number): void {
    if (!this.isPayOnDelivery || !addressId) {
      this.deliveryFee = 0;
      return;
    }
    
    // Buscar endereço completo para pegar o CEP
    this.http.get<Address>(`${environment.apiUrl}/addresses/${addressId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullAddress) => {
          if (fullAddress.zipcode) {
            this.fetchDeliveryFee(fullAddress.zipcode);
          }
        },
        error: (error) => {
          console.error('Erro ao buscar endereço:', error);
          this.toastr.error('Erro ao buscar dados do endereço', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        }
      });
  }
  
  fetchDeliveryFee(zipcode: string): void {
    this.loadingDeliveryFee = true;
    this.deliveryZoneService.calculateFrete(zipcode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.deliveryFee = parseFloat(String(response?.valor_frete ?? '0')) || 0;
          this.estimatedDeliveryTime = response?.tempo_estimado || '';
          this.loadingDeliveryFee = false;
          this.updateTotal();
        },
        error: (error) => {
          console.error('Erro ao calcular frete:', error);
          this.deliveryFee = 0;
          this.estimatedDeliveryTime = '';
          this.loadingDeliveryFee = false;
          this.updateTotal();
          if (error.status === 404) {
            this.toastr.warning('Infelizmente, ainda não atendemos este CEP.', '', {
              toastClass: 'modern-toast-notification',
              positionClass: 'toast-bottom-center',
              timeOut: 5000
            });
          } else {
            this.toastr.error('Erro ao calcular frete. Tente novamente.', '', {
              toastClass: 'modern-toast-notification',
              positionClass: 'toast-bottom-center',
              timeOut: 3000
            });
          }
        }
      });
  }
  
  onPayOnDeliveryChange(): void {
    if (!this.isPayOnDelivery) {
      // Se desmarcou, limpar endereço e frete
      this.selectedAddressId = null;
      this.deliveryFee = 0;
      this.isDeliveryFeeEnabled = false;
      this.estimatedDeliveryTime = '';
      this.updateTotal();
    } else {
      // Ao marcar entrega, por padrão habilitar a cobrança da taxa de entrega
      this.isDeliveryFeeEnabled = true;
      // Se marcou, verificar se tem cliente selecionado
      if (!this.selectedCustomer) {
        this.toastr.warning('Selecione um cliente antes de marcar "Pagamento na Entrega"', '', {
          toastClass: 'modern-toast-notification',
          positionClass: 'toast-bottom-center',
          timeOut: 3000
        });
        // Desmarcar o checkbox
        setTimeout(() => {
          this.isPayOnDelivery = false;
        }, 100);
        return;
      }
      // Carregar endereços se ainda não carregou
      if (this.customerAddresses.length === 0) {
        this.loadCustomerAddresses().subscribe();
      } else if (this.selectedAddressId) {
        // Se já tem endereço selecionado, calcular frete imediatamente
        this.calculateDeliveryFee(this.selectedAddressId);
      }
    }
  }
  
  openNewAddressDialog(): void {
    if (!this.selectedCustomer) {
      this.toastr.warning('Selecione um cliente antes de adicionar endereço', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }
    
    // Importar dinamicamente o componente do modal
    import('./dialogs/new-address-dialog.component').then(module => {
      const dialogRef = this.dialog.open(module.NewAddressDialogComponent, {
        width: '500px',
        maxWidth: '95vw',
        data: { customerId: this.selectedCustomer!.id }
      });
      
      dialogRef.afterClosed().subscribe((result: Address | null) => {
        if (result) {
          // Recarregar endereços e selecionar o novo automaticamente
          this.loadCustomerAddresses(result.id).subscribe({
            next: (addresses) => {
              // Endereços carregados e novo endereço já selecionado
              // Calcular frete se necessário
              if (this.isPayOnDelivery && this.selectedAddressId) {
                this.calculateDeliveryFee(this.selectedAddressId);
              }
              this.toastr.success('Endereço cadastrado e selecionado com sucesso!', '', {
                toastClass: 'modern-toast-notification',
                positionClass: 'toast-bottom-center',
                timeOut: 3000
              });
            },
            error: (error) => {
              console.error('Erro ao recarregar endereços:', error);
              this.toastr.warning('Endereço cadastrado, mas houve erro ao recarregar a lista', '', {
                toastClass: 'modern-toast-notification',
                positionClass: 'toast-bottom-center',
                timeOut: 3000
              });
            }
          });
        }
      });
    });
  }

  clearCustomer(): void {
    this.selectedCustomer = null;
    this.customerName = '';
    this.customerPhone = '';
    this.customerEmail = '';
    this.customerDocument = '';
    this.customerSearchTerm = '';
    this.customerSearchResults = [];
    this.customerAddresses = [];
    this.selectedAddressId = null;
    this.deliveryFee = 0;
    this.estimatedDeliveryTime = '';
  }

  toggleCustomerSearch(): void {
    this.showCustomerSearch = !this.showCustomerSearch;
    if (this.showCustomerSearch) {
      this.customerSearchTerm = '';
      this.customerSearchResults = [];
    }
  }

  openQuickCustomerDialog(): void {
    const dialogRef = this.dialog.open(QuickCustomerDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe((customer: Customer) => {
      if (customer) {
        // Selecionar o cliente criado automaticamente
        this.selectCustomer(customer);
        this.toastr.success('Cliente criado e selecionado com sucesso!', '', {
          toastClass: 'modern-toast-notification',
          positionClass: 'toast-bottom-center',
          timeOut: 3000
        });
      }
    });
  }


  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.quantity = 1;
    // Se o produto pode ser vendido por dose, permitir seleção
    // Senão, forçar apenas garrafa
    this.saleType = product.can_sell_by_dose ? 'garrafa' : 'garrafa';
    this.searchTerm = '';
    this.searchResults = [];
  }

  addToCart(): void {
    if (!this.selectedProduct || this.quantity < 1) return;

    // Combo/Bundle: abrir modal de seleção de sub-itens em vez de adicionar direto
    if ((this.selectedProduct as any).is_bundle || (this.selectedProduct as any).type === 'bundle') {
      this.openComboSelectionModal(this.selectedProduct);
      return;
    }

    // Se o produto tem delivery_price, mostrar diálogo de escolha
    if (this.selectedProduct.delivery_price && this.selectedProduct.delivery_price > 0) {
      const dialogRef = this.dialog.open(SaleTypeDialogComponent, {
        width: '400px',
        data: { product: this.selectedProduct }
      });

      dialogRef.afterClosed().subscribe((result: SaleTypeResult | null) => {
        if (result) {
          this.addToCartWithPrice(result.price);
        }
      });
      return;
    }

    // Se não tem delivery_price, adicionar direto com o preço normal
    this.addToCartWithPrice(this.selectedProduct.price);
  }

  /**
   * Abre o modal de seleção de itens do combo e, ao confirmar, adiciona o combo ao carrinho do PDV.
   */
  openComboSelectionModal(product: Product): void {
    const bundleId = product.id; // Na busca do PDV, itens bundle têm id = product_bundles.id
    const dialogRef = this.dialog.open(ComboSelectionDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { bundleId }
    });

    dialogRef.afterClosed().subscribe((result: ComboSelectionResult | null) => {
      if (!result) return;
      const { bundle, quantity, selections, totalPrice } = result;
      const unitPrice = totalPrice / quantity;
      this.cartItems.push({
        combo: bundle,
        is_combo: true,
        quantity,
        sale_type: 'garrafa',
        subtotal: totalPrice,
        bundleSelections: selections as CartItem['bundleSelections']
      });
      this.updateTotal();
      this.selectedProduct = null;
      this.quantity = 1;
      this.searchTerm = '';
      this.searchResults = [];
      this.toastr.success(`${bundle.name} adicionado ao carrinho`, '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 2000
      });
    });
  }

  private addToCartWithPrice(priceToUse: number): void {
    if (!this.selectedProduct || this.quantity < 1) return;

    // Verificar disponibilidade baseada no tipo de venda
    if (this.saleType === 'garrafa') {
      if (this.selectedProduct.current_stock <= 0) {
        this.toastr.warning('Produto sem estoque disponível', 'Estoque Insuficiente', {
          toastClass: 'modern-toast-notification',
          timeOut: 3000
        });
        return;
      }
      if (this.quantity > this.selectedProduct.current_stock) {
        this.toastr.warning(`Quantidade excede o estoque disponível. Restam apenas ${this.selectedProduct.current_stock} unidades.`, 'Estoque Insuficiente', {
          toastClass: 'modern-toast-notification',
          timeOut: 3000
        });
        return;
      }
    } else {
      // Para doses, verificar se há garrafas suficientes para converter
      const dosesNecessarias = this.quantity;
      const garrafasNecessarias = Math.ceil(dosesNecessarias / this.selectedProduct.doses_por_garrafa);
      
      if (this.selectedProduct.current_stock < garrafasNecessarias) {
        this.toastr.warning(`Produto não possui garrafas suficientes para as doses solicitadas (necessário: ${garrafasNecessarias} garrafas)`, 'Estoque Insuficiente', {
          toastClass: 'modern-toast-notification',
          timeOut: 3000
        });
        return;
      }
    }

    // Usar o preço escolhido (balcão ou entrega)
    const finalPrice = this.saleType === 'dose' 
      ? (this.selectedProduct.dose_price || 0)
      : priceToUse;

    // Verificar se já existe item com mesmo produto, tipo de venda e preço
    const existingItem = this.cartItems.find(item => 
      item.product?.id === this.selectedProduct!.id && 
      item.sale_type === this.saleType &&
      item.subtotal / item.quantity === finalPrice
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + this.quantity;
      
      // Verificar novamente a disponibilidade
      if (this.saleType === 'garrafa') {
        if (newQuantity > this.selectedProduct.current_stock) {
          this.toastr.warning(`Quantidade excede o estoque disponível. Restam apenas ${this.selectedProduct.current_stock} unidades.`, 'Estoque Insuficiente', {
            toastClass: 'modern-toast-notification',
            timeOut: 3000
          });
          return;
        }
      } else {
        const dosesNecessarias = newQuantity;
        const garrafasNecessarias = Math.ceil(dosesNecessarias / this.selectedProduct.doses_por_garrafa);
        if (this.selectedProduct.current_stock < garrafasNecessarias) {
          this.toastr.warning(`Quantidade excede as garrafas disponíveis para conversão`, 'Estoque Insuficiente', {
            toastClass: 'modern-toast-notification',
            timeOut: 3000
          });
          return;
        }
      }
      
      existingItem.quantity = newQuantity;
      existingItem.subtotal = newQuantity * finalPrice;
    } else {
      this.cartItems.push({
        product: this.selectedProduct,
        quantity: this.quantity,
        sale_type: this.saleType,
        subtotal: this.quantity * finalPrice
      });
    }

    this.updateTotal();
    this.selectedProduct = null;
    this.quantity = 1;
    this.saleType = 'garrafa';
  }

  removeFromCart(index: number): void {
    this.cartItems.splice(index, 1);
    this.updateTotal();
  }

  updateQuantity(index: number, change: number): void {
    const item = this.cartItems[index];
    if (!item) return;

    const newQuantity = item.quantity + change;
    if (newQuantity < 1) return;

    if (item.sale_type === 'garrafa') {
      if (item.product && newQuantity > item.product.current_stock) {
        return;
      }
    } else if (item.product) {
      const dosesNecessarias = newQuantity;
      const garrafasNecessarias = Math.ceil(dosesNecessarias / item.product.doses_por_garrafa);
      if (item.product.current_stock < garrafasNecessarias) {
        return;
      }
    }

    const unitPrice = this.getItemUnitPrice(item);

    item.quantity = newQuantity;
    item.subtotal = newQuantity * unitPrice;

    this.updateTotal();
  }

  updateTotal(): void {
    const itemsTotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    // Somar taxa de entrega apenas se estiver em modo entrega e se a cobrança estiver habilitada
    const appliedDeliveryFee = (this.isPayOnDelivery && this.isDeliveryFeeEnabled) ? this.deliveryFee : 0;
    this.total = itemsTotal + appliedDeliveryFee;
    
    // Recalcular troco automaticamente se o método de pagamento for dinheiro (legado)
    if (this.selectedPaymentMethod === 'dinheiro' && this.receivedAmount > 0) {
      this.changeAmount = Math.max(0, this.receivedAmount - this.total);
    }
    
    // Sincronizar inputAmount com remainingAmount
    this.inputAmount = this.total > 0 ? this.remainingAmount : 0;
  }

  /** Valor restante a pagar (total - soma dos pagamentos) */
  get remainingAmount(): number {
    const paid = this.payments.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, this.total - paid);
  }

  /** Troco total quando há overpayment em dinheiro */
  get totalChange(): number {
    const changePayments = this.payments.filter(p => p.method === 'dinheiro' && (p.change ?? 0) > 0);
    return changePayments.reduce((sum, p) => sum + (p.change ?? 0), 0);
  }

  /** Verifica se pode finalizar (pago totalmente ou com troco) */
  get canFinalize(): boolean {
    return this.remainingAmount <= 0;
  }

  addPayment(): void {
    const val = Number(this.inputAmount) || 0;
    if (val <= 0) {
      this.toastr.warning('Informe um valor maior que zero', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }
    const remaining = this.remainingAmount;
    const amountToApply = Math.min(val, remaining);
    const payment: { method: PaymentMethod; amount: number; received_amount?: number; change?: number } = {
      method: this.selectedMethod,
      amount: amountToApply
    };
    if (this.selectedMethod === 'dinheiro' && val > remaining) {
      payment.received_amount = val;
      payment.change = Math.round((val - remaining) * 100) / 100;
    }
    this.payments.push(payment);
    this.inputAmount = this.remainingAmount;
  }

  removePayment(index: number): void {
    this.payments.splice(index, 1);
    this.inputAmount = this.remainingAmount;
  }

  /**
   * Método chamado quando o toggle de cobrança de taxa de entrega é alterado.
   * Recalcula o total e o troco automaticamente.
   */
  onDeliveryFeeToggleChange(): void {
    // Atualizar o total (que já recalcula o troco automaticamente se for dinheiro)
    this.updateTotal();
  }

  clearCart(): void {
    this.cartItems = [];
    this.total = 0;
    this.customerName = '';
    this.customerPhone = '';
    this.customerEmail = '';
    this.customerDocument = '';
    this.selectedCustomer = null;
    this.customerAddresses = [];
    this.selectedAddressId = null;
    this.deliveryFee = 0;
    this.estimatedDeliveryTime = '';
    this.isPayOnDelivery = false;
    this.isDeliveryFeeEnabled = false;
    this.customerSearchTerm = '';
    this.customerSearchResults = [];
    this.showCustomerSearch = false;
    this.receivedAmount = 0;
    this.changeAmount = 0;
    this.selectedPaymentMethod = null;
    this.payments = [];
    this.inputAmount = 0;
  }

  onReceivedAmountChange(): void {
    if (this.receivedAmount > 0) {
      this.changeAmount = Math.max(0, this.receivedAmount - this.total);
    } else {
      this.changeAmount = 0;
    }
  }

  confirmAndFinalizeSale(): void {
    if (!this.cartItems.length) {
      this.toastr.warning('Adicione produtos ao carrinho', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }
    if (!this.canFinalize || this.payments.length === 0) {
      this.toastr.warning('Adicione os pagamentos até cobrir o total', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }

    const paymentSummary = this.payments.length === 1
      ? this.getPaymentMethodName(this.payments[0].method)
      : `Misto (${this.payments.map(p => `${this.getPaymentMethodName(p.method)}: ${this.formatCurrency(p.amount)}`).join(', ')})`;
    const changeInfo = this.totalChange > 0 ? `\n\nTroco: ${this.formatCurrency(this.totalChange)}` : '';

    if (this.isPayOnDelivery) {
      const dialogRef = this.dialog.open(PrintConfirmationDialogComponent, {
        width: '500px',
        data: {
          orderNumber: null,
          total: this.total,
          paymentMethod: this.payments[0]?.method,
          customerName: this.selectedCustomer?.name || this.customerName,
          changeAmount: this.totalChange > 0 ? this.totalChange : undefined,
          receivedAmount: this.payments.find(p => p.method === 'dinheiro')?.received_amount,
          isDeliveryConfirmation: true,
          deliveryFee: this.deliveryFee,
          confirmMessage: `Pedido de ENTREGA - Total: ${this.formatCurrency(this.total)}\n\nPagamento: ${paymentSummary}${changeInfo}`
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((result: 'pay_on_delivery' | 'already_paid' | false) => {
        if (result === 'pay_on_delivery') {
          this.finalizeSale('pending');
        } else if (result === 'already_paid') {
          this.finalizeSale('completed');
        }
      });
    } else {
      const confirmMessage = `Confirmar recebimento de ${this.formatCurrency(this.total)}\n\n${paymentSummary}${changeInfo}`;
      const dialogRef = this.dialog.open(PrintConfirmationDialogComponent, {
        width: '450px',
        data: {
          orderNumber: null,
          total: this.total,
          paymentMethod: this.payments[0]?.method,
          customerName: this.selectedCustomer?.name || this.customerName,
          changeAmount: this.totalChange > 0 ? this.totalChange : undefined,
          receivedAmount: this.payments.find(p => p.method === 'dinheiro')?.received_amount,
          isConfirmation: true,
          confirmMessage: confirmMessage
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.finalizeSale('completed');
        }
      });
    }
  }

  getPaymentMethodName(method: PaymentMethod): string {
    const names: Record<PaymentMethod, string> = {
      'dinheiro': 'Dinheiro',
      'cartão de débito': 'Cartão de Débito',
      'cartão de crédito': 'Cartão de Crédito',
      'pix': 'PIX'
    };
    return names[method] || method;
  }

  finalizeSale(paymentStatus: 'pending' | 'completed' = 'completed'): void {
    // Bloquear se métodos estiverem desabilitados nas configurações
    if (this.settings && Array.isArray(this.settings.accepted_payment_methods)) {
      const map: Record<string, string> = {
        'dinheiro': 'cash',
        'pix': 'pix',
        'cartão de débito': 'debit_card',
        'cartão de crédito': 'credit_card'
      };
      for (const p of this.payments) {
        const key = map[p.method];
        const pm = this.settings.accepted_payment_methods.find(m => m.method === key);
        if (pm && pm.enabled === false) {
          this.toastr.warning(`Forma de pagamento ${this.getPaymentMethodName(p.method)} desabilitada nas configurações`, '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
          return;
        }
      }
    }
    if (!this.cartItems.length) {
      this.toastr.warning('Adicione produtos ao carrinho', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }

    // Se for pagamento na entrega, verificar se cliente tem endereço
    if (this.isPayOnDelivery) {
      if (this.selectedCustomer) {
        // Verificar se cliente tem endereços cadastrados
        if (!this.selectedCustomer.addresses || this.selectedCustomer.addresses.length === 0) {
          this.toastr.warning('Cliente selecionado não possui endereço cadastrado. Por favor, cadastre um endereço antes de gerar o pedido de entrega.', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 5000
          });
          return;
        }
      } else {
        // Se não há cliente selecionado, verificar se tem dados mínimos para criar endereço
        if (!this.customerName || !this.customerPhone) {
          this.toastr.warning('Para pedidos de entrega, é necessário selecionar um cliente cadastrado ou informar nome e telefone do cliente.', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 5000
          });
          return;
        }
      }
    }

    // Validar entrega antes de continuar
    if (this.isPayOnDelivery) {
      if (!this.selectedCustomer) {
        this.toastr.warning('Para pedidos de entrega, é necessário selecionar um cliente cadastrado.', '', {
          toastClass: 'modern-toast-notification',
          positionClass: 'toast-bottom-center',
          timeOut: 5000
        });
        return;
      }
      
      if (!this.selectedAddressId) {
        this.toastr.warning('Selecione um endereço de entrega para continuar.', '', {
          toastClass: 'modern-toast-notification',
          positionClass: 'toast-bottom-center',
          timeOut: 5000
        });
        return;
      }

      // Validar que o frete foi calculado (pode ser 0 se for frete grátis)
      if (this.deliveryFee === null || this.deliveryFee === undefined) {
        this.toastr.warning('Aguarde o cálculo do frete antes de finalizar.', '', {
          toastClass: 'modern-toast-notification',
          positionClass: 'toast-bottom-center',
          timeOut: 3000
        });
        return;
      }
    }

    // Determinar qual taxa de entrega será efetivamente cobrada
    const appliedDeliveryFee = (this.isPayOnDelivery && this.isDeliveryFeeEnabled) ? (this.deliveryFee || 0) : 0;

    const order: CreateOrderRequest = {
      items: this.cartItems.map(item => {
        const unitPrice = this.getItemUnitPrice(item);
        if (item.is_combo && item.combo && item.bundleSelections) {
          const selections = this.buildBundleSelectionsForOrder(item.bundleSelections, item.quantity);
          return {
            product_bundle_id: item.combo.id,
            quantity: item.quantity,
            sale_type: item.sale_type,
            price: unitPrice,
            selections
          };
        }
        return {
          product_id: item.product?.id,
          quantity: item.quantity,
          sale_type: item.sale_type,
          price: unitPrice
        };
      }),
      total: this.total - appliedDeliveryFee,
      delivery_fee: appliedDeliveryFee,
      customer_name: this.customerName || undefined,
      customer_phone: this.customerPhone || undefined,
      customer_email: this.customerEmail || undefined,
      customer_document: this.customerDocument || undefined,
      status: this.isPayOnDelivery ? 'pending' : 'completed',
      payment_status: paymentStatus,
      delivery_address_id: this.isPayOnDelivery && this.selectedAddressId ? this.selectedAddressId : undefined
    };

    // PDV: enviar payments array (split)
    const methodMap: Record<PaymentMethod, 'money' | 'pix' | 'credit_card' | 'debit_card'> = {
      'dinheiro': 'money',
      'pix': 'pix',
      'cartão de crédito': 'credit_card',
      'cartão de débito': 'debit_card'
    };
    order.payments = this.payments.map(p => ({
      method: methodMap[p.method],
      amount: p.amount,
      received_amount: p.received_amount,
      change: p.change
    }));

    this.orderService.createOrder(order)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CreateOrderResponse) => {
          // Se não for pagamento na entrega, atualizar status para "completed"
          if (!this.isPayOnDelivery) {
            this.orderService.completeOrder(response.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  console.log('Status do pedido atualizado para concluído');
                  this.showPrintConfirmation(response);
                },
                error: (statusError) => {
                  console.error('Erro ao atualizar status do pedido:', statusError);
                  this.showPrintConfirmation(response);
                }
              });
          } else {
            // Se for entrega, apenas mostrar confirmação
            this.toastr.success('Pedido de entrega gerado com sucesso!', '', {
              toastClass: 'modern-toast-notification',
              positionClass: 'toast-bottom-center',
              timeOut: 3000
            });
            this.showPrintConfirmation(response);
          }
        },
        error: (error: Error) => {
          console.error('Erro ao finalizar venda:', error);
          this.toastr.error(error.message || 'Erro ao finalizar venda', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        }
      });
  }

  showPrintConfirmation(response: CreateOrderResponse): void {
    const primaryPayment = this.payments[0];
    
    const dialogData = {
      orderNumber: response.order_number,
      total: response.total,
      paymentMethod: primaryPayment?.method ?? 'dinheiro',
      customerName: response.customer_name,
      changeAmount: this.totalChange > 0 ? this.totalChange : undefined,
      receivedAmount: this.payments.find(p => p.method === 'dinheiro')?.received_amount
    };

    const dialogRef = this.dialog.open(PrintConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((shouldPrint: boolean) => {
      if (shouldPrint) {
        this.printReceipt(response);
      }
      this.updateCashAmountFromPayments(response.total);
      this.clearCart();
    });
  }

  printReceipt(order: CreateOrderResponse): void {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      // Função auxiliar para garantir valores numéricos válidos
      const safeNumber = (value: any): number => {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      };
      
      // Função auxiliar para formatar método de pagamento
      const formatPaymentMethod = (method: any): string => {
        if (!method) return 'Não informado';
        const methods: { [key: string]: string } = {
          'dinheiro': 'Dinheiro',
          'money': 'Dinheiro',
          'cartão de débito': 'Cartão de Débito',
          'debit_card': 'Cartão de Débito',
          'debito': 'Cartão de Débito',
          'cartão de crédito': 'Cartão de Crédito',
          'credit_card': 'Cartão de Crédito',
          'credito': 'Cartão de Crédito',
          'pix': 'PIX',
          'cartao': 'Cartão'
        };
        return methods[method] || method;
      };
      
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Comprovante de Venda #${order.order_number}</title>
            <style>
              @media print {
                @page {
                  size: 80mm 297mm;
                  margin: 0;
                }
              }
              body {
                font-family: 'Courier New', monospace;
                width: 80mm;
                padding: 5mm;
                margin: 0;
                box-sizing: border-box;
              }
              .header {
                text-align: center;
                margin-bottom: 10mm;
              }
              .header h1 {
                font-size: 16pt;
                margin: 0;
              }
              .header p {
                font-size: 10pt;
                margin: 2mm 0;
              }
              .order-info {
                margin-bottom: 5mm;
                font-size: 10pt;
              }
              .customer-info {
                margin-bottom: 5mm;
                font-size: 10pt;
              }
              .items {
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
                padding: 3mm 0;
                margin: 3mm 0;
              }
              .item {
                font-size: 10pt;
                margin: 2mm 0;
              }
              .item .quantity {
                display: inline-block;
                width: 15mm;
              }
              .item .name {
                display: inline-block;
                width: 40mm;
              }
              .item .price {
                display: inline-block;
                width: 20mm;
                text-align: right;
              }
              .item.sub-line .name {
                padding-left: 5mm;
                font-size: 9pt;
              }
              .total {
                text-align: right;
                font-size: 12pt;
                font-weight: bold;
                margin: 5mm 0;
              }
              .payment-info {
                font-size: 10pt;
                margin: 2mm 0;
              }
              .footer {
                text-align: center;
                font-size: 10pt;
                margin-top: 10mm;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>ADEGA GS</h1>
              <p>CNPJ: XX.XXX.XXX/0001-XX</p>
              <p>Rua Exemplo, 123 - Centro</p>
              <p>Tel: (11) 9999-9999</p>
            </div>

            <div class="order-info">
              <p><strong>Pedido:</strong> #${order.order_number}</p>
              <p><strong>Data:</strong> ${dateStr} ${timeStr}</p>
              <p><strong>Vendedor:</strong> ${order.customer_name || 'Balcão'}</p>
            </div>

            ${order.customer_name ? `
              <div class="customer-info">
                <p><strong>Cliente:</strong> ${order.customer_name}</p>
                ${order.customer_phone ? `<p><strong>Telefone:</strong> ${order.customer_phone}</p>` : ''}
              </div>
            ` : ''}
            
            <div class="items">
              ${order.items.map((item: any) => `
                <div class="item">
                  <span class="quantity">${item.quantity}x</span>
                  <span class="name">${item.is_combo && item.combo ? item.combo.name : (item.product?.name || 'Produto não encontrado')}</span>
                  <span class="price">R$ ${safeNumber(item.subtotal).toFixed(2)}</span>
                </div>
                ${(item.sub_lines && item.sub_lines.length) ? item.sub_lines.map((line: string) => `
                <div class="item sub-line">
                  <span class="quantity"></span>
                  <span class="name">${line}</span>
                  <span class="price"></span>
                </div>
                `).join('') : ''}
              `).join('')}
            </div>

            <div class="total">
              Total: R$ ${safeNumber(order.total).toFixed(2)}
            </div>
            
            <div class="payment-info">
              <p><strong>Forma de Pagamento:</strong> ${this.payments.length === 1
                ? formatPaymentMethod(this.payments[0].method)
                : this.payments.map(p => formatPaymentMethod(p.method) + ': R$ ' + safeNumber(p.amount).toFixed(2)).join(' + ')}</p>
              ${this.totalChange > 0 ? `
                <p><strong>Valor recebido (dinheiro):</strong> R$ ${safeNumber(this.payments.find(p => p.method === 'dinheiro')?.received_amount || 0).toFixed(2)}</p>
                <p><strong>TROCO:</strong> R$ ${safeNumber(this.totalChange).toFixed(2)}</p>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>Agradecemos a preferência!</p>
              <p>www.adegags.com.br</p>
            </div>
          </body>
        </html>
      `;

      // Criar janela de impressão
      const printWindow = window.open('', '_blank', 'width=600,height=800');
      
      if (printWindow) {
        // Escrever conteúdo
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Aguardar carregamento e imprimir
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            // Fechar janela após um tempo
            setTimeout(() => {
              printWindow.close();
            }, 1000);
          }, 500);
        };
        
        // Fallback caso onload não funcione
        setTimeout(() => {
          if (!printWindow.closed) {
            printWindow.print();
            setTimeout(() => {
              printWindow.close();
            }, 1000);
          }
        }, 1000);
      } else {
        // Fallback: usar window.print() se não conseguir abrir nova janela
        console.warn('Não foi possível abrir janela de impressão, usando fallback');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = printContent;
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        
        window.print();
        
        setTimeout(() => {
          document.body.removeChild(tempDiv);
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      this.toastr.error('Erro ao imprimir comprovante', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  ceil(value: number): number {
    return Math.ceil(value);
  }

  getProductPrice(product: Product | null | undefined, saleType: 'dose' | 'garrafa'): number {
    if (!product) return 0;
    if (saleType === 'dose' && product.can_sell_by_dose && product.dose_price) {
      return product.dose_price;
    }
    return (product as any).base_price ?? product.price ?? 0;
  }

  /**
   * Sanitiza um valor numérico, convertendo vírgula para ponto e garantindo que seja um número válido
   */
  private sanitizePrice(value: string | number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }
    
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    
    if (typeof value === 'string') {
      // Substituir vírgula por ponto e remover espaços
      const cleaned = value.replace(',', '.').replace(/\s/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }

  /**
   * Converte as seleções do combo (por grupo) no formato esperado pelo backend para criação do pedido.
   * Agrega por (group_id, product_id, sale_type) e soma quantidades (quantity por unidade do bundle).
   */
  private buildBundleSelectionsForOrder(
    bundleSelections: CartItem['bundleSelections'],
    _itemQuantity: number
  ): Array<{ bundle_group_id: number; product_id: number; quantity: number; sale_type: 'dose' | 'garrafa'; price?: number }> {
    if (!bundleSelections) return [];
    const key = (g: number, p: number, s: string) => `${g}-${p}-${s}`;
    const agg = new Map<string, { bundle_group_id: number; product_id: number; quantity: number; sale_type: 'dose' | 'garrafa'; price?: number }>();
    Object.entries(bundleSelections).forEach(([groupId, options]) => {
      const gid = +groupId;
      (options || []).forEach((opt: any) => {
        const qty = opt.quantity ?? 1;
        const st = (opt.sale_type || 'garrafa') as 'dose' | 'garrafa';
        const k = key(gid, opt.product_id, st);
        const existing = agg.get(k);
        if (existing) {
          existing.quantity += qty;
        } else {
          agg.set(k, {
            bundle_group_id: gid,
            product_id: opt.product_id,
            quantity: qty,
            sale_type: st,
            price: opt.price_adjustment ?? 0
          });
        }
      });
    });
    return Array.from(agg.values());
  }

  /**
   * Calcula o preço unitário de um item do carrinho baseado no subtotal e quantidade
   * Garante que o preço enviado ao backend seja o preço real calculado, não o preço padrão do produto
   */
  private getItemUnitPrice(item: CartItem): number {
    if (item.quantity <= 0) {
      return 0;
    }
    
    // Se o subtotal foi calculado corretamente, usar ele dividido pela quantidade
    // Isso garante que o preço enviado seja o preço real (ex: dose_price) e não o preço padrão
    const calculatedPrice = item.subtotal / item.quantity;
    
    // Validar que o preço calculado é válido
    if (isNaN(calculatedPrice) || calculatedPrice <= 0) {
      // Fallback: usar o método getProductPrice se o subtotal não estiver disponível
      if (item.product) {
        return this.getProductPrice(item.product, item.sale_type);
      }
      if (item.combo) {
        return item.combo.price || 0;
      }
      return 0;
    }
    
    return calculatedPrice;
  }

  toggleCashValueVisibility(): void {
    this.showCashValue = !this.showCashValue;
  }

  getDisplayCashValue(): string {
    if (!this.cashStatus) return 'R$ 0,00';
    
    if (this.showCashValue) {
      return this.formatCurrency(this.cashStatus.current_amount);
    } else {
      // Mostrar asteriscos para ocultar o valor
      return '••••••••';
    }
  }

  showCloseCashConfirmation(): void {
    if (!this.cashStatus) return;

    const dialogRef = this.dialog.open(CloseCashDialogComponent, {
      width: '500px',
      data: { cashStatus: this.cashStatus },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.closeCash();
      }
    });
  }

  private closeCash(): void {
    this.loading = true;
    
    this.cashService.closeCash()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.cashStatus = null;
          this.loading = false;
          
          // Mostrar relatório de fechamento
          this.showClosingReport(report);
          
          this.toastr.success('Caixa fechado com sucesso', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
        },
        error: (error) => {
          console.error('Erro ao fechar caixa:', error);
          this.toastr.error('Erro ao fechar caixa', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
          this.loading = false;
        }
      });
  }

  private showClosingReport(report: any): void {
    // Aqui você pode implementar um diálogo para mostrar o relatório de fechamento
    // Por enquanto, vamos apenas logar no console
    console.log('Relatório de fechamento:', report);
  }

  openCopaoModal(): void {
    const dialogRef = this.dialog.open(CopaoModalComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe((result: CopaoResult | null) => {
      if (!result || !result.products || result.products.length === 0) {
        return;
      }

      // Adicionar cada produto do resultado ao carrinho
      result.products.forEach(item => {
        // Verificar se já existe item com mesmo produto e tipo de venda
        const existingItem = this.cartItems.find(cartItem => 
          cartItem.product?.id === item.product.id && cartItem.sale_type === item.sale_type
        );

        if (existingItem) {
          // Atualizar quantidade do item existente
          const newQuantity = existingItem.quantity + item.quantity;
          
          // Verificar disponibilidade
          if (item.sale_type === 'garrafa') {
            if (newQuantity > item.product.current_stock) {
              this.toastr.warning(`Quantidade excede o estoque disponível para ${item.product.name}. Restam apenas ${item.product.current_stock} unidades.`, 'Estoque Insuficiente', {
                toastClass: 'modern-toast-notification',
                timeOut: 3000
              });
              return;
            }
          } else {
            // Para doses, verificar se há garrafas suficientes
            const dosesNecessarias = newQuantity;
            const garrafasNecessarias = Math.ceil(dosesNecessarias / (item.product.doses_por_garrafa || 1));
            if (item.product.current_stock < garrafasNecessarias) {
              this.toastr.warning(`Produto não possui garrafas suficientes para as doses solicitadas de ${item.product.name}`, 'Estoque Insuficiente', {
                toastClass: 'modern-toast-notification',
                timeOut: 3000
              });
              return;
            }
          }
          
          existingItem.quantity = newQuantity;
          existingItem.subtotal = newQuantity * this.getProductPrice(item.product, item.sale_type);
        } else {
          // Adicionar novo item ao carrinho
          // Verificar disponibilidade antes de adicionar
          if (item.sale_type === 'garrafa') {
            if (item.product.current_stock <= 0) {
              this.toastr.warning(`${item.product.name} sem estoque disponível`, 'Estoque Insuficiente', {
                toastClass: 'modern-toast-notification',
                timeOut: 3000
              });
              return;
            }
            if (item.quantity > item.product.current_stock) {
              this.toastr.warning(`Quantidade excede o estoque disponível para ${item.product.name}. Restam apenas ${item.product.current_stock} unidades.`, 'Estoque Insuficiente', {
                toastClass: 'modern-toast-notification',
                timeOut: 3000
              });
              return;
            }
          } else {
            // Para doses, verificar se há garrafas suficientes
            const dosesNecessarias = item.quantity;
            const garrafasNecessarias = Math.ceil(dosesNecessarias / (item.product.doses_por_garrafa || 1));
            if (item.product.current_stock < garrafasNecessarias) {
              this.toastr.warning(`Produto não possui garrafas suficientes para as doses solicitadas de ${item.product.name}`, 'Estoque Insuficiente', {
                toastClass: 'modern-toast-notification',
                timeOut: 3000
              });
              return;
            }
          }

          this.cartItems.push({
            product: item.product,
            quantity: item.quantity,
            sale_type: item.sale_type,
            subtotal: item.quantity * this.getProductPrice(item.product, item.sale_type)
          });
        }
      });

      this.updateTotal();
      this.toastr.success('Copão adicionado ao carrinho!', '', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
    });
  }

  private updateCashAmountFromPayments(saleTotal: number): void {
    if (!this.cashStatus) return;
    const cashPayments = this.payments.filter(p => p.method === 'dinheiro');
    if (cashPayments.length === 0) return;
    const cashTotal = cashPayments.reduce((sum, p) => sum + p.amount, 0);
    this.cashService.addTransaction({
      type: 'entrada',
      amount: cashTotal,
      description: this.payments.length === 1
        ? `Venda - ${this.getPaymentMethodName('dinheiro')} - R$ ${this.formatCurrency(saleTotal)}`
        : `Venda (Misto) - Dinheiro: R$ ${this.formatCurrency(cashTotal)} - Total: R$ ${this.formatCurrency(saleTotal)}`
    }).subscribe({
      next: () => {
        this.cashService.getStatus().subscribe(status => {
          this.cashStatus = status;
        });
      },
      error: (error) => {
        console.error('Erro ao atualizar valor do caixa:', error);
      }
    });
  }

}