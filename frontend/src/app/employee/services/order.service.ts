import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, forkJoin, Subscription } from 'rxjs';
import { switchMap, tap, map, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product as CoreProduct } from '../../core/models/product.model';

export interface OrderSummary {
  total_amount: number;
  total_orders: number;
  pending: number;
  processing: number;
  delivering: number;
  completed: number;
}

export interface OrderResponse {
  data: Order[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

export type OrderStatus = 'pending' | 'processing' | 'preparing' | 'delivering' | 'completed' | 'cancelled';
export type PaymentMethod = 'dinheiro' | 'cartão de débito' | 'cartão de crédito' | 'pix';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Product extends CoreProduct {
  current_stock: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number;
  combo_id?: number;
  is_combo?: boolean;
  product?: Product;
  combo?: any; // Combo interface
  quantity: number;
  sale_type: 'dose' | 'garrafa';
  price: number;
  subtotal: number;
}

export interface Payment {
  id: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  received_amount?: number;
  change_amount?: number;
  created_at: string;
}

export interface Address {
  id: number;
  name?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  notes?: string;
  is_default: boolean;
  is_active: boolean;
  full_address?: string;
  short_address?: string;
}

export interface Order {
  id: number;
  order_number: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  type?: 'local' | 'online';
  payment?: Payment | Payment[]; // Pode ser um objeto ou array
  payment_method?: PaymentMethod;
  /** Status financeiro do pagamento (completed/paid = pago no caixa; pending = pagar na entrega) */
  payment_status?: 'pending' | 'completed' | 'paid';
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: Address;
  delivery_notes?: string;
  delivery_fee?: number;
  created_at: string;
  updated_at: string;
}

/** Item de pagamento para Split Payment (PDV) */
export interface PaymentSplitItem {
  method: 'money' | 'pix' | 'credit_card' | 'debit_card';
  amount: number;
  received_amount?: number;
  change?: number;
}

export interface CreateOrderRequest {
  items: {
    product_id?: number;
    combo_id?: number;
    /** ID do combo/bundle (product_bundles.id) quando o item é um combo com seleções */
    product_bundle_id?: number;
    /** Seleções do combo para o backend: array de { bundle_group_id, product_id, quantity, sale_type, price } */
    selections?: Array<{ bundle_group_id: number; product_id: number; quantity: number; sale_type: 'dose' | 'garrafa'; price?: number }>;
    quantity: number;
    sale_type: 'dose' | 'garrafa';
    price: number;
  }[];
  total: number;
  /** Usado quando E-commerce ou pagamento único */
  payment_method?: PaymentMethod;
  /** Usado quando PDV com pagamentos múltiplos (split) */
  payments?: PaymentSplitItem[];
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  received_amount?: number;
  change_amount?: number;
  status?: 'pending' | 'completed';
  payment_status?: 'pending' | 'completed';
  delivery_fee?: number;
  delivery_address_id?: number;
  delivery?: {
    address?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    phone?: string;
    instructions?: string;
  };
}

export interface CreateOrderResponse extends Order {
  items: (OrderItem & { product_name?: string })[];
  received_amount?: number;
  change_amount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/orders`;
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  private autoRefreshInterval = 15000; // 15 segundos
  private autoRefreshSubscription?: Subscription;

  orders$ = this.ordersSubject.asObservable();

  constructor(private http: HttpClient) {}

  public startAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      return;
    }

    this.autoRefreshSubscription = interval(this.autoRefreshInterval)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchOrders({ status: 'processing' })) // Só buscar pedidos pagos aguardando preparo
      )
      .subscribe({
        error: (error) => {
          console.error('Erro no auto refresh de pedidos:', error);
        }
      });
  }

  public stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = undefined;
    }
  }

  fetchOrders(filters?: { 
    status?: OrderStatus; 
    page?: number; 
    per_page?: number; 
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Observable<OrderResponse> {
    let params: any = {};
    
    if (filters?.status) {
      params.status = filters.status;
    }
    if (filters?.page) {
      params.page = filters.page;
    }
    if (filters?.per_page) {
      params.per_page = filters.per_page;
    }
    if (filters?.search) {
      params.search = filters.search;
    }
    if (filters?.sort_by) {
      params.sort_by = filters.sort_by;
    }
    if (filters?.sort_order) {
      params.sort_order = filters.sort_order;
    }

    return this.http.get<OrderResponse>(this.apiUrl, { params }).pipe(
      tap(response => {
        // Só atualizar o subject se não tivermos filtros específicos
        // (para evitar conflitos com o carregamento local)
        if (!filters?.status && !filters?.search) {
          this.ordersSubject.next(response.data);
        }
      })
    );
  }

  // Método para compatibilidade com código existente
  fetchOrdersLegacy(filters?: { status?: OrderStatus }): Observable<Order[]> {
    return this.fetchOrders(filters).pipe(
      map(response => response.data)
    );
  }

  updateOrderStatus(orderId: number, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/${orderId}/status`, { status }).pipe(
      tap((updatedOrder) => {
        // Atualizar a lista local
        const currentOrders = this.ordersSubject.value;
        const updatedOrders = currentOrders.map(order => 
          order.id === orderId ? updatedOrder : order
        );
        this.ordersSubject.next(updatedOrders);
      })
    );
  }

  /**
   * Imprime um pedido automaticamente via backend
   */
  printOrderAutomatically(orderId: number): Observable<{success: boolean, message: string}> {
    return this.http.post<{success: boolean, message: string}>(`${this.apiUrl}/${orderId}/print`, {});
  }

  completeOrder(orderId: number): Observable<Order> {
    return this.updateOrderStatus(orderId, 'completed');
  }

  createOrder(order: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.apiUrl}`, order).pipe(
      tap(() => {
        // Recarregar a lista de pedidos após criar um novo
        this.fetchOrders().subscribe();
      })
    );
  }

  createManualOrder(order: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.apiUrl}/manual`, order).pipe(
      tap(() => {
        // Recarregar a lista de pedidos após criar um novo
        this.fetchOrders().subscribe();
      })
    );
  }

  getOrdersSummary(): Observable<OrderSummary> {
    // Fazer chamadas reais à API para obter os totais atualizados por status
    // Similar ao que o componente de pedidos faz no método loadStats()
    const pendingRequest = this.fetchOrders({ page: 1, per_page: 1, status: 'pending' });
    const processingRequest = this.fetchOrders({ page: 1, per_page: 1, status: 'processing' });
    const deliveringRequest = this.fetchOrders({ page: 1, per_page: 1, status: 'delivering' });
    const completedRequest = this.fetchOrders({ page: 1, per_page: 1, status: 'completed' });
    
    // Buscar pedidos completos de hoje para calcular vendas do dia
    const todayCompletedRequest = this.fetchOrders({ 
      page: 1, 
      per_page: 100, // Buscar mais para calcular vendas do dia
      status: 'completed'
    });

    return forkJoin({
      pending: pendingRequest,
      processing: processingRequest,
      delivering: deliveringRequest,
      completed: completedRequest,
      todayCompleted: todayCompletedRequest
    }).pipe(
      map(({ pending, processing, delivering, completed, todayCompleted }) => {
        // Calcular vendas do dia (pedidos completos de hoje)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayOrders = todayCompleted.data.filter(order => {
          const orderDate = new Date(order.created_at);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === today.getTime();
        });
        
        const totalAmount = todayOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrdersToday = todayOrders.length;

        // Retornar summary com dados atualizados
        return {
          total_amount: totalAmount, // Vendas do dia
          total_orders: totalOrdersToday, // Pedidos completos de hoje
          pending: pending.total, // Todos os pedidos pendentes
          processing: processing.total, // Todos os pedidos em processamento (pagos, aguardando preparo)
          delivering: delivering.total, // Todos os pedidos em entrega
          completed: completed.total // Todos os pedidos completos
        };
      })
    );
  }

  generateOrderPrint(orderId: number): Observable<string> {
    // Aqui você pode implementar a lógica de geração do HTML para impressão
    // ou chamar um endpoint específico do backend se existir
    return this.http.get<Order>(`${this.apiUrl}/${orderId}`).pipe(
      map(order => this.generatePrintHTML(order))
    );
  }

  private generatePrintHTML(order: Order): string {
    // Template básico para impressão
    return `
      <div style="font-family: monospace; width: 300px; padding: 10px;">
        <h2>ADEGA GS - Pedido #${order.order_number}</h2>
        <p>Data: ${new Date(order.created_at).toLocaleString()}</p>
        <p>Cliente: ${order.user.name}</p>
        <hr>
        ${order.items.map(item => `
          <div>
            ${item.quantity}x ${item.is_combo && item.combo ? item.combo.name : (item.product?.name || 'Produto não encontrado')}
            <span style="float: right">R$ ${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
        <hr>
        <p style="text-align: right; font-weight: bold;">
          Total: R$ ${order.total.toFixed(2)}
        </p>
        <p>Forma de pagamento: ${this.getPaymentMethodFromOrder(order)}</p>
        <p>Status: ${this.getStatusLabel(order.status)}</p>
      </div>
    `;
  }

  private getStatusLabel(status: OrderStatus): string {
    const labels = {
      pending: 'Pendente',
      processing: 'Em Processamento',
      preparing: 'Preparando',
      delivering: 'Em Entrega',
      completed: 'Concluído',
      cancelled: 'Cancelado'
    };
    return labels[status];
  }

  private getPaymentMethodFromOrder(order: Order): string {
    // Primeiro tenta o payment_method direto do order
    if (order.payment_method) {
      return this.formatPaymentMethod(order.payment_method);
    }
    
    // Depois tenta o payment_method do objeto payment (pode ser array ou objeto)
    if (order.payment) {
      if (Array.isArray(order.payment) && order.payment.length > 0) {
        // Se é array, pega o primeiro payment
        return this.formatPaymentMethod(order.payment[0].payment_method);
      } else if (!Array.isArray(order.payment)) {
        // Se é objeto único
        return this.formatPaymentMethod(order.payment.payment_method);
      }
    }
    
    return 'Não informado';
  }

  private formatPaymentMethod(method: string): string {
    const methods: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'cartao': 'Cartão',
      'pix': 'PIX',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito'
    };
    return methods[method] || method;
  }

  searchCustomers(searchTerm: string): Observable<Customer[]> {
    return this.http.get<{customers: Customer[]}>(`${this.apiUrl.replace('/orders', '')}/customers/search`, {
      params: { search: searchTerm }
    }).pipe(
      map(response => response.customers)
    );
  }

  createQuickCustomer(customerData: QuickCustomerRequest): Observable<Customer> {
    return this.http.post<{customer: Customer}>(`${this.apiUrl.replace('/orders', '')}/customers/quick`, customerData).pipe(
      map(response => response.customer)
    );
  }

}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  document_number?: string;
  addresses: CustomerAddress[];
}

export interface CustomerAddress {
  id: number;
  name?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  full_address: string;
  short_address: string;
  is_default: boolean;
}

export interface QuickCustomerRequest {
  name: string;
  phone?: string;
  email?: string;
  document_number?: string;
  address?: {
    name: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipcode?: string;
    notes?: string;
  };
}