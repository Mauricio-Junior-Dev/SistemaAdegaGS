export interface Product {
    id: number;
    category_id: number;
    parent_product_id?: number | null;
    stock_multiplier?: number;
    type?: 'product' | 'bundle';
    is_bundle?: boolean;
    name: string;
    slug: string;
    description?: string;
    price: number;
    base_price?: number;
    min_price?: number;
    delivery_price?: number | null;
    original_price?: number;
    cost_price: number;
    current_stock: number;
    /** Estoque efetivo (virtual): para Packs = floor(estoque pai / multiplier); para unitário = current_stock. Usar na vitrine. */
    effective_stock?: number;
    min_stock: number;
    doses_por_garrafa: number;
    doses_vendidas: number;
    can_sell_by_dose: boolean;
    dose_price?: number;
    barcode?: string;
    is_active: boolean;
    visible_online?: boolean;
    featured: boolean;
    offers?: boolean;
    popular?: boolean;
    images?: string[];
    category?: Category;
    parent_product?: Product;
    low_stock?: boolean;
    image_url?: string;
    updated_at?: string;
    discount_percentage?: number;
    has_discount?: boolean;
}

export interface Category {
    id: number;
    name: string;
    slug: string;
    description?: string;
    is_active: boolean;
    image_url?: string;
    products_count?: number;
    updated_at?: string;
}