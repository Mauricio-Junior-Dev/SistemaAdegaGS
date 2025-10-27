import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { Combo } from '../../../core/models/combo.model';

@Component({
  selector: 'app-combo-detail',
  templateUrl: './combo-detail.component.html',
  styleUrls: ['./combo-detail.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule]
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
