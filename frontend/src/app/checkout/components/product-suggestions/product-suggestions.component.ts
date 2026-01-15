import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Product } from '../../../core/models/product.model';
import { CartItem } from '../../../core/models/cart.model';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-product-suggestions',
  templateUrl: './product-suggestions.component.html',
  styleUrls: ['./product-suggestions.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ]
})
export class ProductSuggestionsComponent implements OnInit, OnDestroy {
  @Input() cartItems$!: Observable<CartItem[]>;
  
  suggestions: Product[] = [];
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSuggestions(): void {
    this.loading = true;
    
    this.cartItems$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(cartItems => {
      if (cartItems.length === 0) {
        this.suggestions = [];
        this.loading = false;
        return;
      }

      const cartIds = cartItems
        .filter(item => item.product && !item.isCombo)
        .map(item => item.product!.id);
      
      this.productService.getSuggestions(cartIds, 6).subscribe({
        next: (suggestions) => {
          this.suggestions = suggestions;
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar sugestões:', error);
          this.loading = false;
        }
      });
    });
  }

  addToCart(product: Product): void {
    const currentQuantity = this.getCurrentQuantity(product);
    // No e-commerce, sempre usar delivery_price se disponível
    const priceToUse = product.delivery_price ?? product.price;
    this.cartService.addItem(product, 1, priceToUse);
    
    // Mostrar notificação apenas quando a quantidade for de 0 para 1 (primeira adição)
    if (currentQuantity === 0) {
      const productName = product.name;
      const isFeminine = productName.toLowerCase().endsWith('a') || 
                         productName.toLowerCase().endsWith('ão') ||
                         productName.toLowerCase().endsWith('ade');
      const message = isFeminine ? `${productName} adicionada!` : `${productName} adicionado!`;
      
      this.toastr.success(message, '', {
        timeOut: 1500,
        positionClass: 'toast-bottom-center',
        progressBar: false,
        toastClass: 'modern-toast-notification'
      });
    }
  }

  private getCurrentQuantity(product: Product): number {
    const cartState = this.cartService.getCartState();
    const items = cartState?.items || [];
    const existingItem = items.find(item => item.id === product.id);
    return existingItem ? existingItem.quantity : 0;
  }

  getImageUrl(product: Product): string {
    const imageUrl = product.image_url;
    if (!imageUrl) return 'assets/images/no-image.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return `${imageUrl}?v=${encodeURIComponent(product.updated_at || '')}`;
    }
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}?v=${encodeURIComponent(product.updated_at || '')}`;
    }
    return `${imageUrl}?v=${encodeURIComponent(product.updated_at || '')}`;
  }

  hasOffer(product: Product): boolean {
    return this.productService.hasOffer(product);
  }

  getOriginalPrice(product: Product): number {
    return this.productService.getOriginalPrice(product);
  }

  getDiscountPercentage(product: Product): number {
    return this.productService.getDiscountPercentage(product);
  }
}
