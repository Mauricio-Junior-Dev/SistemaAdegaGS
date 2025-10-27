import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartItem } from '../../../core/models/cart.model';
import { Product } from '../../../core/models/product.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cart-sidebar',
  templateUrl: './cart-sidebar.component.html',
  styleUrls: ['./cart-sidebar.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class CartSidebarComponent implements OnInit {
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  
  cartItems$ = this.cartService.cartItems$.pipe(
    map(items => items || [])
  );
  cartTotal$ = this.cartItems$.pipe(
    map((items: CartItem[]) => items.reduce((total: number, item: CartItem) => total + (item.quantity * item.price), 0))
  );
  isOpen$ = this.cartService.isCartOpen$;
  itemAdded$ = this.cartService.itemAdded$;

  constructor() {}

  ngOnInit(): void {}

  closeCart(): void {
    this.cartService.closeCart();
  }

  removeItem(item: CartItem): void {
    this.cartService.removeItem(item.id);
  }

  updateQuantity(item: CartItem, change: number): void {
    const newQuantity = item.quantity + change;
    if (newQuantity > 0) {
      this.cartService.updateQuantity(item.id, newQuantity);
    } else {
      this.removeItem(item);
    }
  }

  checkout(): void {
    // Verificar se o usuário está autenticado
    if (!this.authService.isLoggedIn()) {
      // Se não estiver autenticado, redirecionar para login
      this.cartService.closeCart();
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/checkout' }
      });
      return;
    }

    // Fechar o carrinho e navegar para checkout
    this.cartService.closeCart();
    this.router.navigate(['/checkout']);
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
