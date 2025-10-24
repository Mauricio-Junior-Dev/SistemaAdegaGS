import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { switchMap, tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product as CoreProduct } from '../../core/models/product.model';

export interface OrderSummary {
  total_amount: number;
  total_orders: number;
  pending: number;
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

export type OrderStatus = 'pending' | 'delivering' | 'completed' | 'cancelled';
export type PaymentMethod = 'dinheiro' | 'cartão de débito' | 'cartão de crédito' | 'pix';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Product extends CoreProduct {
  current_stock: number;
}

export interface OrderItem {
  id: number;
  product: Product;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Payment {
  id: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
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
  payment?: Payment | Payment[]; // Pode ser um objeto ou array
  payment_method?: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: Address;
  delivery_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  items: {
    product_id: number;
    quantity: number;
    price: number;
  }[];
  total: number;
  payment_method: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  received_amount?: number;
  change_amount?: number;
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

  orders$ = this.ordersSubject.asObservable();

  constructor(private http: HttpClient) {
    // Iniciar atualização automática
    this.startAutoRefresh();
  }

  private startAutoRefresh() {
    interval(this.autoRefreshInterval)
      .pipe(
        switchMap(() => this.fetchOrders())
      )
      .subscribe();
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

  completeOrder(orderId: number): Observable<Order> {
    return this.updateOrderStatus(orderId, 'completed');
  }

  createOrder(order: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.apiUrl}/create`, order).pipe(
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
    // Se tiver endpoint específico:
    // return this.http.get<OrderSummary>(`${this.apiUrl}/summary`);

    // Caso contrário, calcular do estado local
    return this.orders$.pipe(
      map(orders => ({
        total_amount: orders.reduce((sum, order) => sum + order.total, 0),
        total_orders: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        delivering: orders.filter(o => o.status === 'delivering').length,
        completed: orders.filter(o => o.status === 'completed').length
      }))
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
            ${item.quantity}x ${item.product.name}
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