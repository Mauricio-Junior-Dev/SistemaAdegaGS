import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Combo } from '../../../core/models/combo.model';
import { ProductBundle } from '../../../core/models/product-bundle.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-combo-card',
  templateUrl: './combo-card.component.html',
  styleUrls: ['./combo-card.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule]
})
export class ComboCardComponent {
  @Input() combo!: Combo | ProductBundle;
  @Output() addToCart = new EventEmitter<Combo | ProductBundle>();

  onAddToCart(): void {
    this.addToCart.emit(this.combo);
  }

  getComboImage(combo: Combo | ProductBundle): string {
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

  formatPrice(price: number | null | undefined): string {
    if (price === null || price === undefined || isNaN(price)) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getComboPrice(combo: Combo | ProductBundle): number {
    // Se for ProductBundle, usar base_price
    if ('base_price' in combo) {
      return combo.base_price || 0;
    }
    // Se for Combo antigo, usar price
    return combo.price || 0;
  }

  getDiscountPercentage(combo: Combo | ProductBundle): number {
    const price = this.getComboPrice(combo);
    if (combo.original_price && combo.original_price > price && price > 0) {
      return Math.round(((combo.original_price - price) / combo.original_price) * 100);
    }
    return 0;
  }

  getComboItemsSummary(): string {
    // Se for ProductBundle, usar groups
    if ('groups' in this.combo && this.combo.groups) {
      const items: string[] = [];
      const maxItems = 3;
      let itemCount = 0;
      
      for (const group of this.combo.groups) {
        if (group.options && group.options.length > 0) {
          for (const option of group.options) {
            if (itemCount >= maxItems) break;
            
            const quantity = option.quantity || 1;
            const productName = option.product?.name || 'Produto';
            items.push(`${quantity}x ${productName}`);
            itemCount++;
          }
        }
        if (itemCount >= maxItems) break;
      }
      
      // Contar total de itens
      const totalItems = this.combo.groups.reduce((sum, group) => {
        return sum + (group.options?.length || 0);
      }, 0);
      
      if (totalItems > maxItems) {
        items.push(`+${totalItems - maxItems} mais`);
      }
      
      return items.join(', ');
    }
    
    // Se for Combo antigo, usar products
    if ('products' in this.combo && this.combo.products && this.combo.products.length > 0) {
      const items: string[] = [];
      const maxItems = 3;
      
      for (let i = 0; i < Math.min(this.combo.products.length, maxItems); i++) {
        const product = this.combo.products[i];
        const quantity = product.pivot?.quantity || product.quantity || 1;
        const name = product.name || product.product?.name || 'Produto';
        items.push(`${quantity}x ${name}`);
      }
      
      if (this.combo.products.length > maxItems) {
        items.push(`+${this.combo.products.length - maxItems} mais`);
      }
      
      return items.join(', ');
    }
    
    return '';
  }
}
