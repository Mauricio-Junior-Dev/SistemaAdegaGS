import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartItem } from '../../../core/models/cart.model';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.css'
})
export class BottomNavComponent {
  private cartService = inject(CartService);
  private authService = inject(AuthService);

  cartItemCount$ = this.cartService.cartItems$.pipe(
    map((items: CartItem[]) => items.reduce((count: number, item: CartItem) => count + item.quantity, 0))
  );

  user$ = this.authService.user$;

  openCart(): void {
    this.cartService.toggleCart();
  }

  scrollToCategories(): void {
    // Rola para a seção de categorias na home
    const categoriesElement = document.querySelector('.categories-wrapper');
    if (categoriesElement) {
      categoriesElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Se não estiver na home, navega para produtos
      window.location.href = '/produtos';
    }
  }
}
