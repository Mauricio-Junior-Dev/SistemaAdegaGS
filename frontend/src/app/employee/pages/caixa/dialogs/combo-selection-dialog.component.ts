import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ComboService } from '../../../../core/services/combo.service';
import { ProductBundle, BundleGroup, BundleOption } from '../../../../core/models/product-bundle.model';
import { Product } from '../../../../core/models/product.model';
import { environment } from '../../../../../environments/environment';

export interface ComboSelectionResult {
  bundle: ProductBundle;
  quantity: number;
  selections: { [groupId: number]: BundleOption[] };
  totalPrice: number;
}

@Component({
  selector: 'app-combo-selection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './combo-selection-dialog.component.html',
  styleUrls: ['./combo-selection-dialog.component.css']
})
export class ComboSelectionDialogComponent implements OnInit {
  bundle: ProductBundle | null = null;
  loading = true;
  error: string | null = null;
  quantity = 1;
  selections: { [groupId: number]: BundleOption[] } = {};
  displayedPrice = 0;

  constructor(
    public dialogRef: MatDialogRef<ComboSelectionDialogComponent, ComboSelectionResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: { bundleId: number },
    private comboService: ComboService
  ) {}

  ngOnInit(): void {
    this.comboService.getCombo(this.data.bundleId).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        if (bundle.groups && Array.isArray(bundle.groups)) {
          bundle.groups.forEach((g: BundleGroup) => {
            this.selections[g.id] = [];
          });
        }
        this.calculateTotal();
        this.loading = false;
      },
      error: () => {
        this.error = 'Combo não encontrado';
        this.loading = false;
      }
    });
  }

  calculateTotal(): void {
    if (!this.bundle) {
      this.displayedPrice = 0;
      return;
    }
    let total = 0;
    if (this.bundle.pricing_type === 'fixed') {
      total = parseFloat(String(this.bundle.base_price || 0));
    }
    Object.values(this.selections).forEach((opts) => {
      opts.forEach((opt) => {
        total += parseFloat(String(opt.price_adjustment || 0));
      });
    });
    this.displayedPrice = total;
  }

  canConfirm(): boolean {
    if (!this.bundle?.groups?.length) return true;
    for (const group of this.bundle.groups) {
      if (group.is_required) {
        const n = this.selections[group.id]?.length || 0;
        if (n < group.min_selections) return false;
      }
    }
    return true;
  }

  getTotalPrice(): number {
    return this.displayedPrice * this.quantity;
  }

  confirm(): void {
    if (!this.bundle || !this.canConfirm()) return;
    this.dialogRef.close({
      bundle: this.bundle,
      quantity: this.quantity,
      selections: this.selections,
      totalPrice: this.getTotalPrice()
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  // Selection helpers (same logic as combo-detail)
  isOptionSelected(group: BundleGroup, option: BundleOption): boolean {
    return (this.selections[group.id] || []).some((o) => o.id === option.id);
  }

  getSelectedOption(group: BundleGroup): BundleOption | null {
    const s = this.selections[group.id];
    return s?.length ? s[0] : null;
  }

  getOptionQuantity(group: BundleGroup, option: BundleOption): number {
    return (this.selections[group.id] || []).filter((o) => o.id === option.id).length;
  }

  canSelectMore(group: BundleGroup): boolean {
    return (this.selections[group.id]?.length || 0) < group.max_selections;
  }

  onRadioSelect(group: BundleGroup, option: BundleOption | null): void {
    this.selections[group.id] = option ? [option] : [];
    this.calculateTotal();
  }

  onCheckboxSelect(group: BundleGroup, option: BundleOption, checked: boolean): void {
    if (!this.selections[group.id]) this.selections[group.id] = [];
    if (checked) {
      if (this.selections[group.id].length < group.max_selections) {
        this.selections[group.id].push(option);
      }
    } else {
      this.selections[group.id] = this.selections[group.id].filter((o) => o.id !== option.id);
    }
    this.calculateTotal();
  }

  onQuantityChange(group: BundleGroup, option: BundleOption, delta: number): void {
    if (!this.selections[group.id]) this.selections[group.id] = [];
    const current = this.getOptionQuantity(group, option);
    const newCount = current + delta;
    if (newCount <= 0) {
      this.selections[group.id] = this.selections[group.id].filter((o) => o.id !== option.id);
    } else {
      const others = this.selections[group.id].filter((o) => o.id !== option.id).length;
      if (others + newCount <= group.max_selections) {
        this.selections[group.id] = this.selections[group.id].filter((o) => o.id !== option.id);
        for (let i = 0; i < newCount; i++) this.selections[group.id].push(option);
      }
    }
    this.calculateTotal();
  }

  onOptionClick(group: BundleGroup, option: BundleOption, event: Event): void {
    const target = (event.target as HTMLElement);
    if (target.closest('.option-control') || target.closest('button')) return;
    if (group.max_selections === 1) {
      const cur = this.getSelectedOption(group);
      if (cur?.id === option.id && !group.is_required) this.onRadioSelect(group, null);
      else this.onRadioSelect(group, option);
    } else {
      this.onCheckboxSelect(group, option, !this.isOptionSelected(group, option));
    }
  }

  getGroupInstruction(group: BundleGroup): string {
    if (group.max_selections === 1) return group.is_required ? 'Escolha 1' : 'Escolha até 1 (opcional)';
    if (group.min_selections === group.max_selections) return `Escolha ${group.min_selections}`;
    if (group.min_selections === 0) return `Escolha até ${group.max_selections} (opcional)`;
    return `Escolha de ${group.min_selections} até ${group.max_selections}`;
  }

  isGroupValid(group: BundleGroup): boolean {
    const n = this.selections[group.id]?.length || 0;
    if (group.is_required) return n >= group.min_selections && n <= group.max_selections;
    return n <= group.max_selections;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price ?? 0);
  }

  getProductImage(product: Product | undefined): string {
    if (!product) return 'assets/images/no-image.jpg';
    const url = (product as any).image_url || product.images?.[0];
    if (!url) return 'assets/images/no-image.jpg';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/storage') || url.startsWith('storage')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      return `${base}${url.startsWith('/') ? url : '/' + url}`;
    }
    return url;
  }

  trackByGroupId(_: number, g: BundleGroup): number {
    return g.id;
  }
  trackByOptionId(_: number, o: BundleOption): number {
    return o.id;
  }

  incrementQty(): void {
    this.quantity++;
  }
  decrementQty(): void {
    if (this.quantity > 1) this.quantity--;
  }
}
