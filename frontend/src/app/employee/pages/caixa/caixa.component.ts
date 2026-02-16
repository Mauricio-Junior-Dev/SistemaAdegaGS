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
import { PrintService } from '../../../core/services/print.service';
import { QuickCustomerDialogComponent } from './dialogs/quick-customer-dialog.component';
import { CashStatus, CashTransaction } from '../../models/cash.model';
import { SettingsService, SystemSettings } from '../../../admin/services/settings.service';
import { OpenCashDialogComponent } from './dialogs/open-cash-dialog.component';
import { SangriaDialogComponent, SangriaResult } from './dialogs/sangria-dialog.component';
import { PrintConfirmationDialogComponent } from './dialogs/print-confirmation-dialog.component';
import { CloseCashDialogComponent } from './dialogs/close-cash-dialog.component';
import { SaleTypeDialogComponent, SaleTypeResult } from './dialogs/sale-type-dialog.component';
import { ComboSelectionDialogComponent, ComboSelectionResult } from './dialogs/combo-selection-dialog.component';
import { DeliveryPhoneDialogComponent, QuickDeliveryData } from './dialogs/delivery-phone-dialog.component';
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

  /** Dados de entrega rápida (cliente não cadastrado): nome, telefone, endereço e frete manual */
  quickDeliveryData: QuickDeliveryData | null = null;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private customerSearchSubject = new Subject<string>();

  constructor(
    private cashService: CashService,
    private stockService: StockService,
    private orderService: OrderService,
    private printService: PrintService,
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
      // Se desmarcou, limpar endereço, frete e dados de entrega rápida
      this.selectedAddressId = null;
      this.deliveryFee = 0;
      this.isDeliveryFeeEnabled = false;
      this.estimatedDeliveryTime = '';
      this.quickDeliveryData = null;
      this.updateTotal();
    } else {
      this.isDeliveryFeeEnabled = true;
      if (this.selectedCustomer) {
        if (this.customerAddresses.length === 0) {
          this.loadCustomerAddresses().subscribe();
        } else if (this.selectedAddressId) {
          this.calculateDeliveryFee(this.selectedAddressId);
        }
      } else if (!this.quickDeliveryData) {
        this.openDeliveryPhoneDialog();
      }
    }
  }

  /**
   * Abre o modal de identificação por telefone (entrega rápida).
   * Se encontrar cliente: seleciona e carrega endereços. Se não: preenche quickDeliveryData.
   */
  openDeliveryPhoneDialog(): void {
    const dialogRef = this.dialog.open(DeliveryPhoneDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe((result: { type: 'found'; customer: Customer } | { type: 'quick'; data: QuickDeliveryData } | null) => {
      if (result === null || result === undefined) {
        if (!this.selectedCustomer && !this.quickDeliveryData) {
          this.isPayOnDelivery = false;
        }
        return;
      }
      if (result.type === 'found') {
        this.selectCustomer(result.customer);
        if (this.customerAddresses.length === 0) {
          this.loadCustomerAddresses().subscribe();
        } else if (this.selectedAddressId) {
          this.calculateDeliveryFee(this.selectedAddressId);
        }
      } else {
        this.quickDeliveryData = result.data;
        this.deliveryFee = result.data.deliveryFeeManual;
        this.isDeliveryFeeEnabled = result.data.deliveryFeeManual > 0;
        this.updateTotal();
        this.cdr.detectChanges();
      }
    });
  }

  clearQuickDeliveryData(): void {
    this.quickDeliveryData = null;
    this.deliveryFee = 0;
    this.isDeliveryFeeEnabled = false;
    this.updateTotal();
  }

  /** Sincroniza o frete editado na tela com quickDeliveryData e recalcula o total. */
  onQuickDeliveryFeeChange(): void {
    if (this.quickDeliveryData) {
      this.quickDeliveryData.deliveryFeeManual = this.deliveryFee ?? 0;
      this.isDeliveryFeeEnabled = this.deliveryFee > 0;
    }
    this.updateTotal();
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
    this.quickDeliveryData = null;
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


  /** Garante quantity >= 1 após edição direta no input (blur/change). */
  normalizeQuantity(): void {
    const n = Number(this.quantity);
    if (!Number.isFinite(n) || n < 1) {
      this.quantity = 1;
    } else {
      this.quantity = Math.floor(n);
    }
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
        timeOut: 3000
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
          timeOut: 5000
        });
        return;
      }
      if (this.quantity > this.selectedProduct.current_stock) {
        this.toastr.warning(`Quantidade excede o estoque disponível. Restam apenas ${this.selectedProduct.current_stock} unidades.`, 'Estoque Insuficiente', {
          toastClass: 'modern-toast-notification',
          timeOut: 5000
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
          timeOut: 5000
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
            timeOut: 5000
          });
          return;
        }
      } else {
        const dosesNecessarias = newQuantity;
        const garrafasNecessarias = Math.ceil(dosesNecessarias / this.selectedProduct.doses_por_garrafa);
        if (this.selectedProduct.current_stock < garrafasNecessarias) {
          this.toastr.warning(`Quantidade excede as garrafas disponíveis para conversão`, 'Estoque Insuficiente', {
            toastClass: 'modern-toast-notification',
            timeOut: 5000
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

  /** Mensagem explicando por que o botão Finalizar/Gerar Pedido está bloqueado (para UX). */
  get finalizeBlockedHint(): string | null {
    if (!this.cartItems.length) return null;
    if (this.payments.length === 0) {
      return 'Adicione ao menos um pagamento: informe o valor e clique em «Adicionar».';
    }
    if (this.remainingAmount > 0) {
      return `Falta cobrir ${this.formatCurrency(this.remainingAmount)}. Adicione outro pagamento ou ajuste o valor.`;
    }
    return null;
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
    this.quickDeliveryData = null;
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

    // Validar entrega: fluxo com cliente cadastrado OU entrega rápida (quickDeliveryData)
    if (this.isPayOnDelivery) {
      if (this.quickDeliveryData) {
        if (!this.quickDeliveryData.customerName?.trim() || !this.quickDeliveryData.customerPhone?.trim()) {
          this.toastr.warning('Dados da entrega rápida incompletos. Clique em "Alterar" para preencher.', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 5000
          });
          return;
        }
        if (this.deliveryFee === null || this.deliveryFee === undefined) {
          this.deliveryFee = this.quickDeliveryData.deliveryFeeManual ?? 0;
        }
      } else if (this.selectedCustomer) {
        if (!this.selectedCustomer.addresses?.length) {
          this.toastr.warning('Cliente selecionado não possui endereço cadastrado. Cadastre um endereço antes de gerar o pedido.', '', {
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
        if (this.deliveryFee === null || this.deliveryFee === undefined) {
          this.toastr.warning('Aguarde o cálculo do frete antes de finalizar.', '', {
            toastClass: 'modern-toast-notification',
            positionClass: 'toast-bottom-center',
            timeOut: 3000
          });
          return;
        }
      } else {
        this.toastr.warning('Informe o cliente/endereço de entrega (clique em "Informar cliente" ou selecione um cliente).', '', {
          toastClass: 'modern-toast-notification',
          positionClass: 'toast-bottom-center',
          timeOut: 5000
        });
        return;
      }
    }

    const appliedDeliveryFee = (this.isPayOnDelivery && this.isDeliveryFeeEnabled) ? (this.deliveryFee || 0) : 0;

    const isQuickDelivery = this.isPayOnDelivery && this.quickDeliveryData;
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
      customer_name: isQuickDelivery ? this.quickDeliveryData!.customerName : (this.customerName || undefined),
      customer_phone: isQuickDelivery ? this.quickDeliveryData!.customerPhone : (this.customerPhone || undefined),
      customer_email: isQuickDelivery ? undefined : (this.customerEmail || undefined),
      customer_document: isQuickDelivery ? undefined : (this.customerDocument || undefined),
      status: this.isPayOnDelivery ? 'pending' : 'completed',
      payment_status: paymentStatus,
      delivery_address_id: this.isPayOnDelivery && !isQuickDelivery && this.selectedAddressId ? this.selectedAddressId : undefined,
      delivery: isQuickDelivery && this.quickDeliveryData ? {
        address: this.quickDeliveryData.street,
        number: this.quickDeliveryData.number,
        neighborhood: this.quickDeliveryData.neighborhood,
        city: this.quickDeliveryData.city,
        state: this.quickDeliveryData.state,
        zipcode: this.quickDeliveryData.zipcode.length >= 8 ? this.quickDeliveryData.zipcode : '00000000'
      } : undefined
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
                  this.showPrintConfirmation(response, paymentStatus);
                },
                error: (statusError) => {
                  console.error('Erro ao atualizar status do pedido:', statusError);
                  this.showPrintConfirmation(response, paymentStatus);
                }
              });
          } else {
            // Se for entrega, apenas mostrar confirmação
            this.toastr.success('Pedido de entrega gerado com sucesso!', '', {
              toastClass: 'modern-toast-notification',
              positionClass: 'toast-bottom-center',
              timeOut: 3000
            });
            this.showPrintConfirmation(response, paymentStatus);
          }
        },
        error: (error: unknown) => {
          console.error('Erro ao finalizar venda:', error);
          this.showApiError(error, 'Erro ao finalizar venda');
        }
      });
  }

  showPrintConfirmation(response: CreateOrderResponse, paymentStatus: 'pending' | 'completed'): void {
    // Enriquecer o pedido com payment_status e payments corretos para impressão via API
    const enrichedOrder = this.buildOrderForPrint(response, paymentStatus);

    // Impressão automática via API (Print Bridge / Backend) - sem diálogo do navegador
    this.printService.printOrderManual(enrichedOrder);

    this.toastr.success('Venda finalizada! Imprimindo comprovante...', '', {
      toastClass: 'modern-toast-notification',
      positionClass: 'toast-bottom-center',
      timeOut: 2000
    });

    this.updateCashAmountFromPayments(response.total);
    this.clearCart();
  }

  /**
   * Constrói o objeto Order enriquecido para impressão via API.
   * Garante payment_status e payments corretos (evita "Pagar na entrega: Misto" quando Pago no Caixa).
   */
  private buildOrderForPrint(response: CreateOrderResponse, paymentStatus: 'pending' | 'completed'): CreateOrderResponse {
    const dinheiroPayment = this.payments.find(p => p.method === 'dinheiro');
    const receivedAmount = dinheiroPayment?.received_amount;
    const changeAmount = this.totalChange > 0 ? this.totalChange : undefined;

    // Mapear payments locais para formato esperado pelo Print Bridge (não enviar 'misto')
    const paymentArray = this.payments.map(p => ({
      payment_method: p.method,
      amount: p.amount,
      received_amount: p.method === 'dinheiro' ? p.received_amount : undefined,
      change_amount: p.method === 'dinheiro' ? p.change : undefined
    }));

    return {
      ...response,
      status: response.status || (paymentStatus === 'completed' ? 'completed' : 'pending'),
      payment_status: paymentStatus,
      payment: paymentArray as any,
      received_amount: receivedAmount,
      change_amount: changeAmount
    };
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

  /**
   * Extrai mensagem humanizada de erro da API (ex.: 422 com body do Laravel)
   * e exibe em toast. Prioridade: err.error.error > err.error.message > err.message > fallback.
   */
  private showApiError(error: unknown, fallback: string): void {
    const err = error as { error?: { error?: string; message?: string }; message?: string };
    const message =
      (err?.error && typeof err.error === 'object' && (err.error.error || err.error.message)) ||
      err?.message ||
      fallback;
    const text = typeof message === 'string' ? message : fallback;
    this.toastr.error(text, '', {
      toastClass: 'modern-toast-notification',
      positionClass: 'toast-bottom-center',
      timeOut: 5000
    });
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