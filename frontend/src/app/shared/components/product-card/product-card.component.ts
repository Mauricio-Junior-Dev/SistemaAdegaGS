import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import { Product } from '../../../core/models/product.model';
import { CartService } from '../../../core/services/cart.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule]
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Output() addToCart = new EventEmitter<Product>();

  constructor(
    private cartService: CartService,
    private toastr: ToastrService
  ) {}

  onAddToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Verificar se é um combo adaptado (category_id === 0 e não tem doses_por_garrafa)
    // Se for combo, apenas emitir evento para o componente pai tratar
    const isCombo = this.product.category_id === 0 && 
                    (this.product as any).doses_por_garrafa === 0 && 
                    this.product.current_stock === 999;
    
    if (isCombo) {
      // Para combos, apenas emitir evento - o componente pai vai tratar
      this.addToCart.emit(this.product);
      return;
    }
    
    // Para produtos normais, adicionar diretamente ao carrinho
    const currentQuantity = this.getCurrentQuantity();
    this.cartService.addItem(this.product, 1);
    
    // Mostrar notificação apenas quando a quantidade for de 0 para 1 (primeira adição)
    if (currentQuantity === 0) {
      const productName = this.product.name;
      const isFeminine = productName.toLowerCase().endsWith('a') || 
                         productName.toLowerCase().endsWith('ão') ||
                         productName.toLowerCase().endsWith('ade');
      const message = isFeminine ? `${productName} adicionada!` : `${productName} adicionado!`;
      
      this.toastr.success(message, '', {
        timeOut: 1500,
        positionClass: 'toast-bottom-center',
        progressBar: false
      });
    }
    
    // Emitir evento para compatibilidade (componente pai pode fazer algo adicional se necessário)
    this.addToCart.emit(this.product);
  }

  private getCurrentQuantity(): number {
    const cartState = this.cartService.getCartState();
    const items = cartState?.items || [];
    const existingItem = items.find(item => item.id === this.product.id);
    return existingItem ? existingItem.quantity : 0;
  }

  getImageUrl(product: Product): string {
    const imageUrl = (product as any).image_url as string | undefined;
    if (imageUrl) {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return `${imageUrl}?v=${encodeURIComponent(product.updated_at as any)}`;
      }
      if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${base}${path}?v=${encodeURIComponent(product.updated_at as any)}`;
      }
      return `${imageUrl}?v=${encodeURIComponent(product.updated_at as any)}`;
    }
    const first = product.images?.[0];
    if (first) return first;
    return 'assets/images/no-image.jpg';
  }

  getLowStock(product: Product): boolean {
    const current = (product as any).current_stock ?? 0;
    const min = (product as any).min_stock ?? 0;
    return current <= min;
  }

  hasLowStock(product: Product): boolean {
    const current = product.current_stock ?? 0;
    return current < 5 && current > 0;
  }

  getStockMessage(product: Product): string {
    const current = product.current_stock ?? 0;
    if (current < 5 && current > 0) {
      return `Restam apenas ${current} unidades`;
    }
    return '';
  }

  hasOffer(product: Product): boolean {
    // Verifica se há um preço original maior que o preço atual
    const originalPrice = (product as any).original_price;
    return originalPrice && originalPrice > product.price;
  }

  getOriginalPrice(product: Product): number {
    return (product as any).original_price || product.price;
  }

  getDiscountPercentage(): number {
    const originalPrice = (this.product as any).original_price;
    if (!originalPrice || originalPrice <= this.product.price) return 0;
    return Math.round(((originalPrice - this.product.price) / originalPrice) * 100);
  }
}