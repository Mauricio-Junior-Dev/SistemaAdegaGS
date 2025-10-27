import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { ComboCardComponent } from '../../../shared/components/combo-card/combo-card.component';
import { Combo } from '../../../core/models/combo.model';

@Component({
  selector: 'app-combos-page',
  templateUrl: './combos-page.component.html',
  styleUrls: ['./combos-page.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, ComboCardComponent, FormsModule]
})
export class CombosPageComponent implements OnInit {
  combos: Combo[] = [];
  loading = true;
  error: string | null = null;
  searchTerm = '';
  sortBy = 'name';
  sortOrder = 'asc';

  constructor(
    private comboService: ComboService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.loadCombos();
  }

  loadCombos(): void {
    this.loading = true;
    this.error = null;

    const params: any = {
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      per_page: 20
    };

    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    this.comboService.getCombos(params).subscribe({
      next: (response) => {
        this.combos = response.data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar combos:', error);
        this.error = 'Erro ao carregar combos';
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.loadCombos();
  }

  onSortChange(): void {
    this.loadCombos();
  }

  onAddToCart(combo: Combo): void {
    // Adicionar combo ao carrinho
    this.cartService.addComboToCart(combo, 1);
  }

  trackByComboId(index: number, combo: Combo): number {
    return combo.id;
  }
}
