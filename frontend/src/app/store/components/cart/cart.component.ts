import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { CartItem } from '../../../core/models/cart.model';
import { Product } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class CartComponent {
  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  get cartItems$() {
    return this.cartService.cartItems$;
  }

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity > 0) {
      // Para combos, não verificar estoque
      if (item.isCombo) {
        this.cartService.updateQuantity(item.id, newQuantity);
      } else if (item.product && newQuantity <= item.product.current_stock) {
        this.cartService.updateQuantity(item.product.id, newQuantity);
      }
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

  isCombo(item: CartItem): boolean {
    return item.isCombo || false;
  }

  getTotal(): number {
    return this.cartService.getTotal();
  }

  checkout(): void {
    this.router.navigate(['/loja/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/loja']);
  }

  getImageUrl(item: CartItem): string {
    if (item.isCombo && item.combo) {
      // Para combos, usar a primeira imagem ou imagem padrão
      if (item.combo.images && item.combo.images.length > 0) {
        return item.combo.images[0];
      }
      return 'assets/images/default-combo.jpg';
    } else if (item.product) {
      // Para produtos
      const imageUrl = item.product.image_url;
      if (!imageUrl) return 'assets/images/no-image.png';
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return `${imageUrl}?v=${encodeURIComponent(item.product.updated_at || '')}`;
      if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${base}${path}?v=${encodeURIComponent(item.product.updated_at || '')}`;
      }
      return `${imageUrl}?v=${encodeURIComponent(item.product.updated_at || '')}`;
    }
    return 'assets/images/no-image.png';
  }

  getItemName(item: CartItem): string {
    if (item.isCombo && item.combo) {
      return item.combo.name;
    } else if (item.product) {
      return item.product.name;
    }
    return 'Item';
  }
}