import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { ProductService } from '../../../../core/services/product.service';
import { Product } from '../../../../core/models/product.model';
import { environment } from '../../../../../environments/environment';

export interface CopaoModalData {
  // Dados que podem ser passados para o dialog
}

export interface CopaoResult {
  products: Array<{
    product: Product;
    quantity: number;
    sale_type: 'dose' | 'garrafa';
  }>;
}

@Component({
  selector: 'app-copao-modal',
  templateUrl: './copao-modal.component.html',
  styleUrls: ['./copao-modal.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule
  ]
})
export class CopaoModalComponent implements OnInit {
  currentStep = 1;
  totalSteps = 3;
  
  // Passo 1: Bebida
  doseProducts: Product[] = [];
  selectedBeverage: Product | null = null;
  searchBeverage = '';
  
  // Passo 2: Acompanhamento
  accompanimentProducts: Product[] = [];
  selectedAccompaniment: Product | null = null;
  skipAccompaniment = false;
  searchAccompaniment = '';
  
  // Passo 3: Gelo
  iceProducts: Product[] = [];
  selectedIce: Product | null = null;
  skipIce = false;
  searchIce = '';
  
  loading = false;
  loadingBeverage = false;
  loadingAccompaniment = false;
  loadingIce = false;

  constructor(
    private dialogRef: MatDialogRef<CopaoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CopaoModalData,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.loadDoseProducts();
    this.loadAccompanimentProducts();
    this.loadIceProducts();
  }

  loadDoseProducts(): void {
    this.loadingBeverage = true;
    this.productService.getProducts({ per_page: 100 }).subscribe({
      next: (response) => {
        // Filtrar produtos que podem ser vendidos por dose ou têm "Dose" no nome
        this.doseProducts = response.data.filter(product => 
          product.can_sell_by_dose || 
          product.name.toLowerCase().includes('dose') ||
          (product.category && product.category.name.toLowerCase().includes('dose'))
        );
        this.loadingBeverage = false;
      },
      error: (error) => {
        console.error('Erro ao carregar bebidas:', error);
        this.loadingBeverage = false;
      }
    });
  }

  loadAccompanimentProducts(): void {
    this.loadingAccompaniment = true;
    this.productService.getProducts({ per_page: 100 }).subscribe({
      next: (response) => {
        // Filtrar produtos de categorias: Energéticos, Sucos, Água de Coco, Refrigerantes
        this.accompanimentProducts = response.data.filter(product => {
          if (!product.category) return false;
          const categoryName = product.category.name.toLowerCase();
          return categoryName.includes('energético') ||
                 categoryName.includes('suco') ||
                 categoryName.includes('água') ||
                 categoryName.includes('refrigerante') ||
                 categoryName.includes('bebida');
        });
        this.loadingAccompaniment = false;
      },
      error: (error) => {
        console.error('Erro ao carregar acompanhamentos:', error);
        this.loadingAccompaniment = false;
      }
    });
  }

  loadIceProducts(): void {
    this.loadingIce = true;
    this.productService.getProducts({ per_page: 100 }).subscribe({
      next: (response) => {
        // Filtrar produtos que têm "Gelo" no nome ou categoria
        this.iceProducts = response.data.filter(product => 
          product.name.toLowerCase().includes('gelo') ||
          (product.category && product.category.name.toLowerCase().includes('gelo'))
        );
        this.loadingIce = false;
      },
      error: (error) => {
        console.error('Erro ao carregar gelos:', error);
        this.loadingIce = false;
      }
    });
  }

  getFilteredBeverages(): Product[] {
    if (!this.searchBeverage.trim()) {
      return this.doseProducts;
    }
    const term = this.searchBeverage.toLowerCase();
    return this.doseProducts.filter(product => 
      product.name.toLowerCase().includes(term)
    );
  }

  getFilteredAccompaniments(): Product[] {
    if (!this.searchAccompaniment.trim()) {
      return this.accompanimentProducts;
    }
    const term = this.searchAccompaniment.toLowerCase();
    return this.accompanimentProducts.filter(product => 
      product.name.toLowerCase().includes(term)
    );
  }

  getFilteredIce(): Product[] {
    if (!this.searchIce.trim()) {
      return this.iceProducts;
    }
    const term = this.searchIce.toLowerCase();
    return this.iceProducts.filter(product => 
      product.name.toLowerCase().includes(term)
    );
  }

  selectBeverage(product: Product): void {
    this.selectedBeverage = product;
    // Avançar automaticamente para o passo 2
    setTimeout(() => {
      this.nextStep();
    }, 300);
  }

  selectAccompaniment(product: Product): void {
    this.selectedAccompaniment = product;
    this.skipAccompaniment = false;
  }

  skipAccompanimentStep(): void {
    this.selectedAccompaniment = null;
    this.skipAccompaniment = true;
    this.nextStep();
  }

  selectIce(product: Product): void {
    this.selectedIce = product;
    this.skipIce = false;
  }

  skipIceStep(): void {
    this.selectedIce = null;
    this.skipIce = true;
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.selectedBeverage !== null;
      case 2:
        return this.selectedAccompaniment !== null || this.skipAccompaniment;
      case 3:
        return true; // Sempre pode concluir no passo 3
      default:
        return false;
    }
  }

  finish(): void {
    if (!this.selectedBeverage) {
      return;
    }

    const result: CopaoResult = {
      products: []
    };

    // Adicionar bebida (obrigatória) - sempre como dose
    result.products.push({
      product: this.selectedBeverage,
      quantity: 1,
      sale_type: 'dose'
    });

    // Adicionar acompanhamento (se selecionado)
    if (this.selectedAccompaniment && !this.skipAccompaniment) {
      result.products.push({
        product: this.selectedAccompaniment,
        quantity: 1,
        sale_type: 'garrafa' // Acompanhamentos geralmente são por unidade
      });
    }

    // Adicionar gelo (se selecionado)
    if (this.selectedIce && !this.skipIce) {
      result.products.push({
        product: this.selectedIce,
        quantity: 1,
        sale_type: 'garrafa' // Gelos geralmente são por unidade
      });
    }

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getProductImage(product: Product): string {
    if (product.image_url) {
      if (product.image_url.startsWith('http://') || product.image_url.startsWith('https://')) {
        return product.image_url;
      }
      // Se começa com /storage/ ou storage/, adicionar base URL da API
      if (product.image_url.startsWith('/storage/') || product.image_url.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`;
        return `${base}${path}`;
      }
      return product.image_url;
    }
    return '/assets/images/no-image.png';
  }
}

