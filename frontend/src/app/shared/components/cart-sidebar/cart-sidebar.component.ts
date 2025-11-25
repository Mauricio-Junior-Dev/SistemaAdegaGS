import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { StoreStatusService } from '../../../core/services/store-status.service';
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
  private storeStatusService = inject(StoreStatusService);
  private router = inject(Router);
  
  cartItems$ = this.cartService.cartItems$.pipe(
    map(items => items || [])
  );
  cartTotal$ = this.cartItems$.pipe(
    map((items: CartItem[]) => items.reduce((total: number, item: CartItem) => total + (item.quantity * item.price), 0))
  );
  isOpen$ = this.cartService.isCartOpen$;
  itemAdded$ = this.cartService.itemAdded$;
  isStoreOpen$ = this.storeStatusService.status$;

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

  checkout(): void {
    // Verificar se a loja está aberta
    if (!this.storeStatusService.getCurrentStatus()) {
      return; // Não fazer nada se a loja estiver fechada
    }

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
      // Para combos, processar a URL da imagem corretamente
      if (item.combo.images && item.combo.images.length > 0) {
        const imageUrl = item.combo.images[0];
        
        // Se já é uma URL completa, retornar como está
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          return imageUrl;
        }
        
        // Se começa com /storage/ ou storage/, adicionar base URL da API
        if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
          const base = environment.apiUrl.replace(/\/api$/, '');
          const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
          return `${base}${path}`;
        }
        
        // Caso contrário, retornar como está
        return imageUrl;
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
