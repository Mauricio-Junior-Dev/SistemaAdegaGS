export interface Product {
    id: number;
    category_id: number;
    parent_product_id?: number | null;
    stock_multiplier?: number;
    name: string;
    slug: string;
    description?: string;
    price: number;
    original_price?: number;
    cost_price: number;
    current_stock: number;
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