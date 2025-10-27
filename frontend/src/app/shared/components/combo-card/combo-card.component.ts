import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Combo } from '../../../core/models/combo.model';

@Component({
  selector: 'app-combo-card',
  templateUrl: './combo-card.component.html',
  styleUrls: ['./combo-card.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class ComboCardComponent {
  @Input() combo!: Combo;
  @Output() addToCart = new EventEmitter<Combo>();

  onAddToCart(): void {
    this.addToCart.emit(this.combo);
  }

  getComboImage(combo: Combo): string {
    if (combo.images && combo.images.length > 0) {
      return combo.images[0];
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
}
