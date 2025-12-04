export interface Combo {
  id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  barcode?: string;
  is_active: boolean;
  featured: boolean;
  offers: boolean;
  popular: boolean;
  images?: string[];
  products?: ComboProduct[];
  created_at: string;
  updated_at: string;
}

export interface ComboProduct {
  id: number;
  combo_id: number;
  product_id: number;
  quantity: number;
  sale_type: 'dose' | 'garrafa';
  product?: Product;
  // Propriedades do produto quando carregado via relacionamento
  name?: string;
  price?: number;
  pivot?: {
    quantity: number;
    sale_type: 'dose' | 'garrafa';
  };
}

export interface Product {
  id: number;
  name: string;
  price: number;
  current_stock: number;
}

export interface ComboFormData {
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  barcode?: string;
  is_active: boolean;
  featured: boolean;
  offers: boolean;
  popular: boolean;
  products: ComboProductFormData[];
  images?: File[];
}

export interface ComboProductFormData {
  product_id: number;
  quantity: number;
  sale_type: 'dose' | 'garrafa';
}

// Interface para dados enviados ao backend (com strings)
export interface ComboFormDataForBackend {
  name: string;
  description?: string;
  price: string;
  original_price?: string;
  discount_percentage?: string;
  barcode?: string;
  is_active: boolean;
  featured: boolean;
  offers: boolean;
  popular: boolean;
  products: ComboProductFormDataForBackend[];
  images?: File[];
}

export interface ComboProductFormDataForBackend {
  product_id: string;
  quantity: string;
  sale_type: 'dose' | 'garrafa';
}

export interface ComboPriceCalculation {
  products: Array<{
    product: Product;
    quantity: number;
    sale_type: 'dose' | 'garrafa';
    unit_price: number;
    subtotal: number;
  }>;
  total_original_price: number;
  discount_percentage: number;
  discount_amount: number;
  final_price: number;
}
