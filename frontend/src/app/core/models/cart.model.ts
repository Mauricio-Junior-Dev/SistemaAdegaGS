import { Product } from './product.model';
import { Combo } from './combo.model';

export interface CartItem {
  id: number;
  product?: Product;
  combo?: Combo;
  quantity: number;
  price: number;
  isCombo?: boolean;
}

export interface CartState {
  items: CartItem[];
  total: number;
  isOpen: boolean;
}
