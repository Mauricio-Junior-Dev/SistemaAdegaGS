import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { Combo } from '../../../core/models/combo.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-combo-detail',
  templateUrl: './combo-detail.component.html',
  styleUrls: ['./combo-detail.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule, MatButtonModule]
})
export class ComboDetailComponent implements OnInit {
  combo: Combo | null = null;
  loading = true;
  error: string | null = null;
  quantity = 1;

  constructor(
    private comboService: ComboService,
    private cartService: CartService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const comboId = +params['id'];
      this.loadCombo(comboId);
    });
  }

  loadCombo(id: number): void {
    this.loading = true;
    this.error = null;

    this.comboService.getCombo(id).subscribe({
      next: (combo) => {
        this.combo = combo;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar combo:', error);
        this.error = 'Combo não encontrado';
        this.loading = false;
      }
    });
  }

  onAddToCart(): void {
    if (this.combo) {
      this.cartService.addComboToCart(this.combo, this.quantity);
    }
  }

  incrementQuantity(): void {
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  getComboImage(combo: Combo): string {
    if (combo.images && combo.images.length > 0) {
      const imageUrl = combo.images[0];
      
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
    return '/assets/images/default-combo.jpg';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getDiscountPercentage(combo: Combo): number {
    if (combo.original_price && combo.original_price > combo.price) {
      return Math.round(((combo.original_price - combo.price) / combo.original_price) * 100);
    }
    return 0;
  }

  getProductName(product: any): string {
    return product.name || product.product?.name || 'Produto';
  }

  getProductPrice(product: any): number {
    return product.price || product.product?.price || 0;
  }

  getProductQuantity(product: any): number {
    return product.pivot?.quantity || product.quantity || 1;
  }

  getProductUnit(product: any): string {
    const saleType = product.pivot?.sale_type || product.sale_type || 'garrafa';
    return saleType === 'dose' ? 'dose(s)' : 'unidade(s)';
  }

  getProductImage(product: any): string {
    const imageUrl = product.image_url || product.product?.image_url || product.images?.[0];
    if (!imageUrl) {
      return '/assets/images/no-image.jpg';
    }
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}`;
    }
    
    return imageUrl;
  }
}
