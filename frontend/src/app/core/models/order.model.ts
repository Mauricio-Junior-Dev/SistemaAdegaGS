import { User } from './user.model';
import { Product } from './product.model';

export type OrderStatus = 'pending' | 'pending_pix' | 'processing' | 'preparing' | 'delivering' | 'completed' | 'cancelled';

export interface Order {
    id: number;
    user_id: number;
    order_number: string;
    type: 'local' | 'online';
    status: OrderStatus;
    total_amount: number;
    total?: number; // Para compatibilidade com backend
    delivery_fee?: number;
    discount_amount: number;
    discount_code?: string;
    notes?: string;
    delivery_address?: any;
    delivery_address_id?: number;
    delivery_notes?: string;
    payment_method?: string;
    payment_status?: string;
    payment_details?: any;
    created_at?: string;
    updated_at?: string;
    user?: User;
    items?: OrderItem[];
    payments?: Payment[]; // Plural (para compatibilidade)
    payment?: Payment[]; // Singular (como o Laravel retorna no JSON)
}

export interface OrderItem {
    id: number;
    order_id: number;
    product_id?: number;
    combo_id?: number;
    is_combo?: boolean;
    quantity: number;
    sale_type: 'dose' | 'garrafa';
    unit_price: number;
    total_price: number;
    price?: number; // Para compatibilidade com backend
    subtotal?: number; // Para compatibilidade com backend
    product?: Product;
    combo?: any; // Combo interface
}

export type PaymentStatus = 'pending' | 'pending_pix' | 'processing' | 'approved' | 'completed' | 'declined' | 'failed' | 'refunded' | 'cancelled';

export interface Payment {
    id: number;
    order_id: number;
    transaction_id?: string;
    payment_method: 'credit_card' | 'debit_card' | 'pix' | 'cash' | 'other' | 'dinheiro' | 'cartão de débito' | 'cartão de crédito';
    status: PaymentStatus;
    amount: number;
    payment_details?: any;
    qr_code?: string;
    expires_at?: string;
}

export interface PixPaymentResponse {
    payment_id: string | null;
    pix_copia_e_cola: string | null;
    pix_qr_code_base64: string | null;
}
