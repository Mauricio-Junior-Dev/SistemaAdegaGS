import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { CartItem } from '../../../core/models/cart.model';
import { Product } from '../../../core/models/product.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class CartPageComponent {
  private cartService = inject(CartService);
  cartItems$: Observable<CartItem[]> = this.cartService.cartItems$.pipe(
    map(items => items || [])
  );
  cartTotal$ = this.cartItems$.pipe(
    map((items: CartItem[]) => items.reduce((total: number, item: CartItem) => total + (item.quantity * item.price), 0))
  );

  updateQuantity(item: CartItem, change: number): void {
    const newQuantity = item.quantity + change;
    if (newQuantity > 0) {
      // Validar estoque antes de aumentar (apenas para produtos, não combos)
      if (change > 0 && item.product && !item.isCombo) {
        if (newQuantity > item.product.current_stock) {
          return; // O CartService já mostrará o toastr
        }
      }
      this.cartService.updateQuantity(item.id, newQuantity);
    } else {
      this.removeItem(item);
    }
  }

  canIncreaseQuantity(item: CartItem): boolean {
    if (item.isCombo || !item.product) {
      return true; // Combos não têm limite de estoque
    }
    return item.quantity < item.product.current_stock;
  }

  removeItem(item: CartItem): void {
    this.cartService.removeItem(item.id);
  }

  checkout(): void {
    // Implementar checkout
  }

  getImageUrl(product: Product): string {
    const imageUrl = product.image_url;
    if (!imageUrl) return 'assets/images/no-image.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return `${imageUrl}?v=${encodeURIComponent(product.updated_at || '')}`;
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}?v=${encodeURIComponent(product.updated_at || '')}`;
    }
    return `${imageUrl}?v=${encodeURIComponent(product.updated_at || '')}`;
  }
}
