export interface Product {
    id: number;
    category_id: number;
    name: string;
    slug: string;
    description?: string;
    price: number;
    original_price?: number;
    cost_price: number;
    current_stock: number;
    min_stock: number;
    sku: string;
    barcode?: string;
    is_active: boolean;
    featured: boolean;
    offers?: boolean;
    popular?: boolean;
    images?: string[];
    category?: Category;
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