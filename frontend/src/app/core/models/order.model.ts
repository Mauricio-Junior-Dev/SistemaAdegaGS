import { User } from './user.model';
import { Product } from './product.model';

export interface Order {
    id: number;
    user_id: number;
    order_number: string;
    type: 'local' | 'online';
    status: 'pending' | 'delivering' | 'completed' | 'cancelled';
    total_amount: number;
    total?: number; // Para compatibilidade com backend
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
    payments?: Payment[];
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

export interface Payment {
    id: number;
    order_id: number;
    transaction_id?: string;
    payment_method: 'credit_card' | 'debit_card' | 'pix' | 'cash' | 'other';
    status: 'pending' | 'processing' | 'approved' | 'declined' | 'refunded' | 'cancelled';
    amount: number;
    payment_details?: any;
}
