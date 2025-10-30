import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

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

interface CartItem {
  product?: Product;
  combo?: any; // Combo interface
  is_combo?: boolean;
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
    MatSnackBarModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    MatSelectModule
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

  // Troco
  receivedAmount = 0;
  changeAmount = 0;
  showChangeSection = false;
  
  // Controle de visibilidade do valor do caixa
  showCashValue = false;
  // Settings
  settings: SystemSettings | null = null;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private customerSearchSubject = new Subject<string>();

  constructor(
    private cashService: CashService,
    private stockService: StockService,
    private orderService: OrderService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private settingsService: SettingsService
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
      this.snackBar.open('Caixa não está aberto', 'Fechar', { duration: 3000 });
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
          this.snackBar.open('Sangria registrada com sucesso', 'Fechar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Erro ao registrar sangria', 'Fechar', { duration: 3000 });
        }
      });
    });
  }

  ngOnInit(): void {
    this.loadCashStatus();
    // Carregar configurações para habilitar métodos de pagamento
    this.settingsService.getSettings().subscribe({
      next: (s) => this.settings = s,
      error: () => { /* fallback silencioso */ }
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
          this.snackBar.open('Erro ao carregar status do caixa', 'Fechar', { duration: 3000 });
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
              this.snackBar.open('Caixa aberto com sucesso', 'Fechar', { duration: 3000 });
            },
            error: error => {
              console.error('Erro ao abrir caixa:', error);
              this.loading = false;
              this.snackBar.open('Erro ao abrir caixa', 'Fechar', { duration: 3000 });
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
          this.snackBar.open('Erro ao buscar produtos', 'Fechar', { duration: 3000 });
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
          this.snackBar.open('Erro ao buscar clientes: ' + error.message, 'Fechar', { duration: 3000 });
        }
      });
  }

  onCustomerSearch(event: any): void {
    this.customerSearchTerm = event.target.value;
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
  }

  clearCustomer(): void {
    this.selectedCustomer = null;
    this.customerName = '';
    this.customerPhone = '';
    this.customerEmail = '';
    this.customerDocument = '';
    this.customerSearchTerm = '';
    this.customerSearchResults = [];
    this.showCustomerSearch = false;
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
        this.snackBar.open('Cliente criado e selecionado com sucesso!', 'Fechar', { duration: 3000 });
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

    // Verificar disponibilidade baseada no tipo de venda
    if (this.saleType === 'garrafa') {
      if (this.selectedProduct.current_stock <= 0) {
        this.snackBar.open('Produto sem estoque disponível', 'Fechar', { duration: 3000 });
        return;
      }
      if (this.quantity > this.selectedProduct.current_stock) {
        this.snackBar.open('Quantidade excede o estoque disponível', 'Fechar', { duration: 3000 });
        return;
      }
    } else {
      // Para doses, verificar se há garrafas suficientes para converter
      const dosesNecessarias = this.quantity;
      const garrafasNecessarias = Math.ceil(dosesNecessarias / this.selectedProduct.doses_por_garrafa);
      
      if (this.selectedProduct.current_stock < garrafasNecessarias) {
        this.snackBar.open(`Produto não possui garrafas suficientes para as doses solicitadas (necessário: ${garrafasNecessarias} garrafas)`, 'Fechar', { duration: 3000 });
        return;
      }
    }

    // Verificar se já existe item com mesmo produto e tipo de venda
    const existingItem = this.cartItems.find(item => 
      item.product?.id === this.selectedProduct!.id && item.sale_type === this.saleType
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + this.quantity;
      
      // Verificar novamente a disponibilidade
      if (this.saleType === 'garrafa') {
        if (newQuantity > this.selectedProduct.current_stock) {
          this.snackBar.open('Quantidade excede o estoque disponível', 'Fechar', { duration: 3000 });
          return;
        }
      } else {
        const dosesNecessarias = newQuantity;
        const garrafasNecessarias = Math.ceil(dosesNecessarias / this.selectedProduct.doses_por_garrafa);
        if (this.selectedProduct.current_stock < garrafasNecessarias) {
          this.snackBar.open(`Quantidade excede as garrafas disponíveis para conversão`, 'Fechar', { duration: 3000 });
          return;
        }
      }
      
      existingItem.quantity = newQuantity;
      existingItem.subtotal = newQuantity * this.getProductPrice(this.selectedProduct, this.saleType);
    } else {
      this.cartItems.push({
        product: this.selectedProduct,
        quantity: this.quantity,
        sale_type: this.saleType,
        subtotal: this.quantity * this.getProductPrice(this.selectedProduct, this.saleType)
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
    const newQuantity = item.quantity + change;

    if (newQuantity < 1) {
      return;
    }

    // Verificar disponibilidade baseada no tipo de venda
    if (item.sale_type === 'garrafa') {
      if (item.product && newQuantity > item.product.current_stock) {
        return;
      }
    } else {
      // Para doses, verificar se há garrafas suficientes para converter
      if (item.product) {
        const dosesNecessarias = newQuantity;
        const garrafasNecessarias = Math.ceil(dosesNecessarias / item.product.doses_por_garrafa);
        if (item.product.current_stock < garrafasNecessarias) {
          return;
        }
      }
    }

    item.quantity = newQuantity;
    item.subtotal = newQuantity * this.getProductPrice(item.product || item.combo, item.sale_type);
    this.updateTotal();
  }

  updateTotal(): void {
    this.total = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  clearCart(): void {
    this.cartItems = [];
    this.total = 0;
    this.customerName = '';
    this.customerPhone = '';
    this.customerEmail = '';
    this.customerDocument = '';
    this.selectedCustomer = null;
    this.customerSearchTerm = '';
    this.customerSearchResults = [];
    this.showCustomerSearch = false;
    this.receivedAmount = 0;
    this.changeAmount = 0;
    this.showChangeSection = false;
  }

  onReceivedAmountChange(): void {
    if (this.receivedAmount > 0) {
      this.changeAmount = Math.max(0, this.receivedAmount - this.total);
    } else {
      this.changeAmount = 0;
    }
  }

  handleCashPayment(): void {
    if (!this.cartItems.length) {
      this.snackBar.open('Adicione produtos ao carrinho', 'Fechar', { duration: 3000 });
      return;
    }
    this.showChangeSection = true;
  }

  finalizeSale(paymentMethod: PaymentMethod): void {
    // Bloquear se método estiver desabilitado nas configurações
    if (this.settings && Array.isArray(this.settings.accepted_payment_methods)) {
      const map: Record<string, string> = {
        'dinheiro': 'cash',
        'pix': 'pix',
        'cartão de débito': 'debit_card',
        'cartão de crédito': 'credit_card'
      };
      const key = map[paymentMethod];
      const pm = this.settings.accepted_payment_methods.find(m => m.method === key);
      if (pm && pm.enabled === false) {
        this.snackBar.open('Forma de pagamento desabilitada nas configurações', 'Fechar', { duration: 3000 });
        return;
      }
    }
    if (!this.cartItems.length) {
      this.snackBar.open('Adicione produtos ao carrinho', 'Fechar', { duration: 3000 });
      return;
    }

    // Se for pagamento em dinheiro, verificar se tem troco
    if (paymentMethod === 'dinheiro') {
      if (this.receivedAmount < this.total) {
        this.snackBar.open('Valor recebido insuficiente', 'Fechar', { duration: 3000 });
        return;
      }
      this.changeAmount = this.receivedAmount - this.total;
    }

    const order: CreateOrderRequest = {
      items: this.cartItems.map(item => ({
        product_id: item.product?.id,
        combo_id: item.combo?.id,
        quantity: item.quantity,
        sale_type: item.sale_type,
        price: item.product?.price || item.combo?.price || 0
      })),
      total: this.total,
      payment_method: paymentMethod,
      customer_name: this.customerName || undefined,
      customer_phone: this.customerPhone || undefined,
      customer_email: this.customerEmail || undefined,
      customer_document: this.customerDocument || undefined,
      received_amount: paymentMethod === 'dinheiro' ? this.receivedAmount : undefined,
      change_amount: paymentMethod === 'dinheiro' ? this.changeAmount : undefined
    };

    this.orderService.createOrder(order)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CreateOrderResponse) => {
          // Atualizar status do pedido para "completed" automaticamente
          this.orderService.completeOrder(response.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                console.log('Status do pedido atualizado para concluído');
                this.showPrintConfirmation(response, paymentMethod);
              },
              error: (statusError) => {
                console.error('Erro ao atualizar status do pedido:', statusError);
                // Mesmo com erro no status, mostrar confirmação de impressão
                this.showPrintConfirmation(response, paymentMethod);
              }
            });
        },
        error: (error: Error) => {
          console.error('Erro ao finalizar venda:', error);
          this.snackBar.open(error.message || 'Erro ao finalizar venda', 'Fechar', { duration: 3000 });
        }
      });
  }

  showPrintConfirmation(response: CreateOrderResponse, paymentMethod: PaymentMethod): void {
    const dialogData = {
      orderNumber: response.order_number,
      total: response.total,
      paymentMethod: paymentMethod,
      customerName: response.customer_name,
      changeAmount: paymentMethod === 'dinheiro' ? this.changeAmount : undefined,
      receivedAmount: paymentMethod === 'dinheiro' ? this.receivedAmount : undefined
    };

    const dialogRef = this.dialog.open(PrintConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((shouldPrint: boolean) => {
      if (shouldPrint) {
        this.printReceipt(response, paymentMethod);
      }
      // Atualizar valor do caixa após venda
      this.updateCashAmount(response.total, paymentMethod);
      // Limpar carrinho após confirmação (imprimir ou não)
      this.clearCart();
    });
  }

  printReceipt(order: CreateOrderResponse, paymentMethod?: PaymentMethod): void {
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
          'cartao': 'Cartão',
          'pix': 'PIX',
          'credito': 'Cartão de Crédito',
          'debito': 'Cartão de Débito'
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
              ${order.items.map(item => `
                <div class="item">
                  <span class="quantity">${item.quantity}x</span>
                  <span class="name">${item.is_combo && item.combo ? item.combo.name : (item.product?.name || 'Produto não encontrado')}</span>
                  <span class="price">R$ ${safeNumber(item.subtotal).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>

            <div class="total">
              Total: R$ ${safeNumber(order.total).toFixed(2)}
            </div>
            
            <div class="payment-info">
              <p><strong>Forma de Pagamento:</strong> ${formatPaymentMethod(paymentMethod || order.payment_method)}</p>
              ${(paymentMethod || order.payment_method) === 'dinheiro' && this.receivedAmount ? `
                <p><strong>Valor recebido:</strong> R$ ${safeNumber(this.receivedAmount).toFixed(2)}</p>
                <p><strong>TROCO:</strong> R$ ${safeNumber(this.changeAmount).toFixed(2)}</p>
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
      this.snackBar.open('Erro ao imprimir comprovante', 'Fechar', { duration: 3000 });
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

  getProductPrice(product: Product, saleType: 'dose' | 'garrafa'): number {
    if (saleType === 'dose' && product.can_sell_by_dose && product.dose_price) {
      return product.dose_price;
    }
    return product.price; // Preço da garrafa
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
          
          this.snackBar.open('Caixa fechado com sucesso', 'Fechar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Erro ao fechar caixa:', error);
          this.snackBar.open('Erro ao fechar caixa', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  private showClosingReport(report: any): void {
    // Aqui você pode implementar um diálogo para mostrar o relatório de fechamento
    // Por enquanto, vamos apenas logar no console
    console.log('Relatório de fechamento:', report);
  }

  private updateCashAmount(saleAmount: number, paymentMethod: PaymentMethod): void {
    if (!this.cashStatus) return;

    // Garantir números válidos para evitar NaN
    const saleAmountNum = Number(saleAmount) || 0;
    let cashChange = 0;

    switch (paymentMethod) {
      case 'dinheiro':
        // Para dinheiro: adiciona o valor recebido, mas subtrai o troco dado
        const receivedAmount = Number(this.receivedAmount || saleAmountNum) || 0;
        const changeAmount = Number(this.changeAmount) || 0;
        cashChange = receivedAmount - changeAmount;
        break;
      case 'cartão de débito':
      case 'cartão de crédito':
      case 'pix':
        // Para cartão/PIX: o valor vai direto para o caixa
        cashChange = saleAmountNum;
        break;
      default:
        cashChange = saleAmountNum;
    }

    // Criar transação no caixa
    this.cashService.addTransaction({
      type: 'entrada',
      amount: cashChange,
      description: `Venda - ${paymentMethod} - R$ ${this.formatCurrency(saleAmount)}`
    }).subscribe({
      next: () => {
        // Recarregar status para refletir valor atualizado e evitar inconsistência do mock
        this.cashService.getStatus().subscribe(status => {
          this.cashStatus = status;
          console.log('Valor do caixa atualizado:', this.cashStatus?.current_amount);
        });
      },
      error: (error) => {
        console.error('Erro ao atualizar valor do caixa:', error);
      }
    });
  }
}