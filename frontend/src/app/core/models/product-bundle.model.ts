import { Product } from './product.model';

// Re-exportar Product apenas como tipo (compatível com isolatedModules)
export type { Product };

/**
 * Interface principal para ProductBundle (substitui Combo)
 */
export interface ProductBundle {
  id: number;
  name: string;
  slug: string;
  description?: string;
  bundle_type: 'combo' | 'copao' | 'custom';
  pricing_type: 'fixed' | 'calculated';
  base_price?: number;
  original_price?: number;
  discount_percentage?: number;
  barcode?: string;
  is_active: boolean;
  featured: boolean;
  offers: boolean;
  popular: boolean;
  images?: string[];
  groups?: BundleGroup[]; // Carregado via relacionamento
  created_at: string;
  updated_at: string;
}

/**
 * Grupo de escolha dentro de um Bundle
 */
export interface BundleGroup {
  id: number;
  bundle_id: number;
  name: string;
  description?: string;
  order: number;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  selection_type: 'single' | 'multiple';
  options?: BundleOption[]; // Carregado via relacionamento
  created_at: string;
  updated_at: string;
}

/**
 * Opção (produto) dentro de um Grupo
 */
export interface BundleOption {
  id: number;
  group_id: number;
  product_id: number;
  quantity: number;
  sale_type: 'dose' | 'garrafa';
  price_adjustment: number;
  order: number;
  product?: Product; // Carregado via relacionamento
  created_at: string;
  updated_at: string;
}

/**
 * Dados do formulário para criar/editar Bundle
 */
export interface ProductBundleFormData {
  name: string;
  description?: string;
  bundle_type: 'combo' | 'copao' | 'custom';
  pricing_type: 'fixed' | 'calculated';
  base_price?: number;
  original_price?: number;
  discount_percentage?: number;
  barcode?: string;
  is_active: boolean;
  featured: boolean;
  offers: boolean;
  popular: boolean;
  groups: BundleGroupFormData[];
  images?: File[];
}

/**
 * Dados do formulário para criar/editar Grupo
 */
export interface BundleGroupFormData {
  name: string;
  description?: string;
  order: number;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  selection_type: 'single' | 'multiple';
  options: BundleOptionFormData[];
}

/**
 * Dados do formulário para criar/editar Opção
 */
export interface BundleOptionFormData {
  product_id: number;
  quantity: number;
  sale_type: 'dose' | 'garrafa';
  price_adjustment?: number;
  order?: number;
}

/**
 * Interface de compatibilidade temporária (para não quebrar código existente)
 * @deprecated Use ProductBundle ao invés de Combo
 */
export interface Combo extends Omit<ProductBundle, 'bundle_type' | 'pricing_type' | 'base_price' | 'groups'> {
  price: number; // Alias para base_price quando pricing_type é 'fixed'
  products?: ComboProduct[]; // Mantido para compatibilidade
}

/**
 * Interface de compatibilidade temporária
 * @deprecated Use BundleOption ao invés de ComboProduct
 */
export interface ComboProduct {
  id: number;
  combo_id?: number;
  product_id: number;
  quantity: number;
  sale_type: 'dose' | 'garrafa';
  product?: Product;
}

/**
 * Interface de compatibilidade para formulário antigo
 * @deprecated Use ProductBundleFormData
 */
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
