import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Product } from '../../../core/models/product.model';
import { CartItem } from '../../../core/models/cart.model';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
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
    MatProgressSpinnerModule,
    MatSnackBarModule
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
    private snackBar: MatSnackBar
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

      const cartIds = cartItems.map(item => item.product.id);
      
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
    this.cartService.addItem(product);
    
    // Animação de confirmação
    this.showAddAnimation(product);
    
    // Snackbar de confirmação
    this.snackBar.open(`${product.name} adicionado ao carrinho!`, 'Fechar', {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  private showAddAnimation(product: Product): void {
    // Criar elemento de animação
    const animationElement = document.createElement('div');
    animationElement.className = 'add-animation';
    animationElement.innerHTML = `
      <div class="animation-content">
        <mat-icon>check_circle</mat-icon>
        <span>Adicionado!</span>
      </div>
    `;
    
    // Adicionar estilos inline
    animationElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #4caf50;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: addToCartAnimation 0.6s ease-out forwards;
    `;
    
    // Adicionar CSS da animação
    if (!document.getElementById('add-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'add-animation-styles';
      style.textContent = `
        @keyframes addToCartAnimation {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(animationElement);
    
    // Remover após animação
    setTimeout(() => {
      if (animationElement.parentNode) {
        animationElement.parentNode.removeChild(animationElement);
      }
    }, 600);
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
