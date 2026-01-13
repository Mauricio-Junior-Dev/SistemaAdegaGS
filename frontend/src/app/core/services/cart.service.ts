import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { Combo } from '../models/combo.model';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

import { CartItem, CartState } from '../models/cart.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private initialState: CartState = {
    items: [],
    total: 0,
    isOpen: false
  };

  private cartState = new BehaviorSubject<CartState>(this.initialState);

  cartItems$ = this.cartState.pipe(map(state => state.items || []));
  isCartOpen$ = this.cartState.pipe(map(state => state.isOpen));
  itemAdded$ = new BehaviorSubject<boolean>(false);

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private toastr: ToastrService
  ) {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const { items, total } = JSON.parse(savedCart);
        if (Array.isArray(items)) {
          this.cartState.next({ items, total: total || 0, isOpen: false });
        }
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      localStorage.removeItem('cart');
    }

    this.authService.user$.subscribe(user => {
      if (!user) {
        const localCart = localStorage.getItem('cart');
        if (localCart) {
          const { items, total } = JSON.parse(localCart);
          this.cartState.next({ items, total, isOpen: false });
        }
      }
    });
  }

  private saveCart(): void {
    console.log('Saving cart to localStorage');
    const state = this.cartState.value || this.initialState;
    const cartData = {
      items: state.items || [],
      total: state.total || 0
    };
    console.log('Cart data to save:', cartData);
    localStorage.setItem('cart', JSON.stringify(cartData));
  }

  private calculateTotal(items: CartItem[]): number {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  /**
   * Adiciona item ao carrinho
   * @param product Produto a ser adicionado
   * @param quantity Quantidade (padrão: 1)
   * @param overridePrice Preço personalizado (override). Se fornecido, sobrescreve o preço do produto. Útil para POS onde o funcionário escolhe entre preço balcão ou entrega.
   */
  addItem(product: Product, quantity: number = 1, overridePrice?: number): void {
    console.log('CartService.addItem:', { product, quantity, overridePrice });
    
    const currentState = this.cartState.value || this.initialState;
    console.log('Current state:', currentState);
    
    const items = currentState.items || [];
    const existingItem = overridePrice !== undefined 
      ? items.find(item => item.id === product.id && item.price === overridePrice)
      : items.find(item => item.id === product.id && item.price === (product.delivery_price || product.price));
    
    console.log('Existing item:', existingItem);

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newQuantity = currentQuantity + quantity;

    if (newQuantity > product.current_stock) {
      this.toastr.warning(`Estoque máximo atingido para este produto. Restam apenas ${product.current_stock} unidades.`, 'Estoque Insuficiente');
      return;
    }

    const finalPrice = overridePrice !== undefined 
      ? overridePrice 
      : (product.delivery_price ?? product.price);

    let updatedItems;
    if (existingItem) {
      console.log('Updating existing item');
      updatedItems = items.map(item => 
        (item.id === product.id && item.price === finalPrice)
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      console.log('Adding new item');
      const newItem: CartItem = {
        id: product.id,
        product,
        quantity,
        price: finalPrice
      };
      updatedItems = [...items, newItem];
    }

    console.log('Updated items:', updatedItems);
    const total = this.calculateTotal(updatedItems);
    console.log('New total:', total);

    const newState = {
      ...currentState,
      items: updatedItems,
      total,
      isOpen: currentState.isOpen
    };
    console.log('New state:', newState);

    this.cartState.next(newState);
    this.saveCart();
    
    this.itemAdded$.next(true);
    setTimeout(() => this.itemAdded$.next(false), 300);
  }

  addComboToCart(combo: Combo, quantity: number = 1): void {
    console.log('CartService.addComboToCart:', { combo, quantity });
    
    const currentState = this.cartState.value || this.initialState;
    const items = currentState.items || [];
    const existingItem = items.find(item => item.id === combo.id && item.isCombo);
    
    let updatedItems;
    if (existingItem) {
      console.log('Updating existing combo item');
      updatedItems = items.map(item => 
        item.id === combo.id && item.isCombo
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      console.log('Adding new combo item');
      const newItem: CartItem = {
        id: combo.id,
        combo,
        quantity,
        price: combo.price,
        isCombo: true
      };
      updatedItems = [...items, newItem];
    }

    console.log('Updated items:', updatedItems);
    const total = this.calculateTotal(updatedItems);
    console.log('New total:', total);

    const newState = {
      ...currentState,
      items: updatedItems,
      total,
      isOpen: true
    };

    this.cartState.next(newState);
    this.saveCart();
    
    this.itemAdded$.next(true);
    setTimeout(() => this.itemAdded$.next(false), 300);
  }

  removeItem(productId: number): void {
    const currentState = this.cartState.value || this.initialState;
    const items = currentState.items || [];
    const updatedItems = items.filter(item => item.id !== productId);
    
    const total = this.calculateTotal(updatedItems);
    const newState = {
      ...currentState,
      items: updatedItems,
      total
    };

    this.cartState.next(newState);
    this.saveCart();
  }

  updateQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }

    const currentState = this.cartState.value || this.initialState;
    const items = currentState.items || [];
    const item = items.find(i => i.id === productId);
    
    if (item && item.product && !item.isCombo) {
      if (quantity > item.product.current_stock) {
        this.toastr.warning(`Estoque máximo atingido para este produto. Restam apenas ${item.product.current_stock} unidades.`, 'Estoque Insuficiente');
        return;
      }
    }

    const updatedItems = items.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );

    const total = this.calculateTotal(updatedItems);
    const newState = {
      ...currentState,
      items: updatedItems,
      total
    };

    this.cartState.next(newState);
    this.saveCart();
  }

  clearCart(): void {
    this.cartState.next({
      items: [],
      total: 0,
      isOpen: false
    });
    localStorage.removeItem('cart');
  }

  openCart(): void {
    this.cartState.next({
      ...this.cartState.value,
      isOpen: true
    });
  }

  closeCart(): void {
    this.cartState.next({
      ...this.cartState.value,
      isOpen: false
    });
  }

  toggleCart(): void {
    this.cartState.next({
      ...this.cartState.value,
      isOpen: !this.cartState.value.isOpen
    });
  }

  getTotal(): number {
    return this.cartState.value?.total || 0;
  }

  getCartState(): CartState {
    return this.cartState.value || this.initialState;
  }

  async finishOrder(orderData: any): Promise<any> {
    try {
      if (!this.authService.isLoggedIn()) {
        throw new Error('Usuário não autenticado');
      }

      const order = {
        ...orderData,
        items: this.cartState.value.items,
        total: this.cartState.value.total
      };

      const response = await this.http.post('/api/orders', order).toPromise();

      this.clearCart();

      return response;
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      throw error;
    }
  }
}