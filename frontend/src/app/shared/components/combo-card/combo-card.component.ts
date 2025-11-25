import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Combo } from '../../../core/models/combo.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-combo-card',
  templateUrl: './combo-card.component.html',
  styleUrls: ['./combo-card.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule]
})
export class ComboCardComponent {
  @Input() combo!: Combo;
  @Output() addToCart = new EventEmitter<Combo>();

  onAddToCart(): void {
    this.addToCart.emit(this.combo);
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

  getComboItemsSummary(): string {
    if (!this.combo.products || this.combo.products.length === 0) {
      return '';
    }
    
    const items: string[] = [];
    const maxItems = 3; // Mostrar no máximo 3 itens
    
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
}
