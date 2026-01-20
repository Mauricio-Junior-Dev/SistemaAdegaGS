import { Product } from './product.model';
import { Combo } from './combo.model';
import { ProductBundle, BundleOption } from './product-bundle.model';

export interface CartItem {
  id: number;
  product?: Product;
  combo?: Combo | ProductBundle;
  quantity: number;
  price: number;
  isCombo?: boolean;
  // Seleções do usuário para ProductBundle
  bundleSelections?: { [groupId: number]: BundleOption[] };
}

export interface CartState {
  items: CartItem[];
  total: number;
  isOpen: boolean;
}
