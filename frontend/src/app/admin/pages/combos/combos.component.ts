import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ComboService } from '../../services/combo.service';
import { Combo } from '../../../core/models/combo.model';
import { PaginatedResponse } from '../../../core/models/pagination.model';

@Component({
  selector: 'app-combos',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSortModule,
    MatMenuModule,
    MatCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './combos.component.html',
  styleUrls: ['./combos.component.css']
})
export class CombosComponent implements OnInit {
  displayedColumns: string[] = [
    'name', 'sku', 'price', 'original_price', 'discount', 'products_count', 
    'status', 'featured', 'offers', 'popular', 'actions'
  ];
  
  dataSource: Combo[] = [];
  loading = false;
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  
  // Filtros
  searchTerm = '';
  statusFilter = 'all';
  featuredFilter = false;
  offersFilter = false;
  
  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  private comboService = inject(ComboService);

  ngOnInit(): void {
    this.loadCombos();
  }

  loadCombos(): void {
    this.loading = true;
    
    const params: any = {
      per_page: this.pageSize,
      page: this.currentPage + 1
    };
    
    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }
    
    if (this.statusFilter !== 'all') {
      params.is_active = this.statusFilter === 'active';
    }
    
    if (this.featuredFilter) {
      params.featured = true;
    }
    
    if (this.offersFilter) {
      params.offers = true;
    }
    
    this.comboService.getCombos(params).subscribe({
      next: (response: PaginatedResponse<Combo>) => {
        this.dataSource = response.data;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erro ao carregar combos:', error);
        this.snackBar.open('Erro ao carregar combos', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCombos();
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadCombos();
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadCombos();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.featuredFilter = false;
    this.offersFilter = false;
    this.currentPage = 0;
    this.loadCombos();
  }

  toggleStatus(combo: Combo): void {
    this.comboService.toggleStatus(combo.id).subscribe({
      next: (updatedCombo: Combo) => {
        combo.is_active = updatedCombo.is_active;
        this.snackBar.open(
          `Combo ${combo.is_active ? 'ativado' : 'desativado'} com sucesso`,
          'Fechar',
          { duration: 3000 }
        );
      },
      error: (error: any) => {
        console.error('Erro ao alterar status:', error);
        this.snackBar.open('Erro ao alterar status do combo', 'Fechar', { duration: 3000 });
      }
    });
  }

  deleteCombo(combo: Combo): void {
    if (confirm(`Tem certeza que deseja excluir o combo "${combo.name}"?`)) {
      this.comboService.deleteCombo(combo.id).subscribe({
        next: () => {
          this.snackBar.open('Combo excluído com sucesso', 'Fechar', { duration: 3000 });
          this.loadCombos();
        },
        error: (error: any) => {
          console.error('Erro ao excluir combo:', error);
          this.snackBar.open('Erro ao excluir combo', 'Fechar', { duration: 3000 });
        }
      });
    }
  }

  getDiscountText(combo: Combo): string {
    if (combo.discount_percentage) {
      return `${combo.discount_percentage}%`;
    }
    
    if (combo.original_price && combo.original_price > combo.price) {
      const discount = ((combo.original_price - combo.price) / combo.original_price) * 100;
      return `${discount.toFixed(1)}%`;
    }
    
    return '0%';
  }

  getProductsCount(combo: Combo): number {
    return combo.products?.length || 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }
}