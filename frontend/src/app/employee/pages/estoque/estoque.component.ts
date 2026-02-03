import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { Subject, takeUntil } from 'rxjs';

import { StockService, StockSummary, StockResponse } from '../../../core/services/stock.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product } from '../../services/order.service';
import { StockMovementDialogComponent } from '../../components/stock-movement-dialog/stock-movement-dialog.component';

@Component({
  selector: 'app-estoque',
  templateUrl: './estoque.component.html',
  styleUrls: ['./estoque.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDialogModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule
  ]
})
export class EstoqueComponent implements OnInit, OnDestroy {
  displayedColumns = ['name', 'category', 'current_stock', 'min_stock', 'price', 'cost_price', 'actions'];
  products: Product[] = [];
  summary: StockSummary | null = null;
  loading = true;
  searchTerm = '';
  showLowStock = false;
  selectedCategory = '';
  stockFilter = 'all';
  categories: any[] = [];

  // Paginação
  totalItems = 0;
  pageSize = 15;
  currentPage = 0;

  // Verificação de tipo de usuário
  isEmployee = false;

  /** Controle de privacidade: valor total em estoque oculto por padrão */
  isValueVisible = false;

  private destroy$ = new Subject<void>();

  constructor(
    private stockService: StockService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Verificar se é funcionário (não admin)
    this.isEmployee = this.authService.isEmployee() && !this.authService.isAdmin();
    
    // Se for funcionário, ajustar colunas e filtros
    if (this.isEmployee) {
      this.displayedColumns = ['name', 'status_badge'];
      // Forçar filtro para mostrar apenas estoque baixo ou zerado
      this.stockFilter = 'low';
      this.showLowStock = true;
    }
    
    if (!this.isEmployee) {
      this.loadSummary();
    }
    this.loadCategories();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleValueVisibility(): void {
    this.isValueVisible = !this.isValueVisible;
  }

  loadSummary(): void {
    this.stockService.getSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary: StockSummary) => this.summary = summary,
        error: (error: Error) => {
          console.error('Erro ao carregar resumo do estoque:', error);
          this.snackBar.open('Erro ao carregar resumo do estoque', 'Fechar', { duration: 3000 });
        }
      });
  }

  loadCategories(): void {
    // Carregar categorias do backend
    this.stockService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Erro ao carregar categorias:', error);
          // Fallback para categorias mockadas
          this.categories = [
            { id: 1, name: 'Pack Cervejas Lata' },
            { id: 2, name: 'Pack Long Neck' },
            { id: 3, name: 'Bebidas Ice' },
            { id: 4, name: 'Energéticos' },
            { id: 5, name: 'Bebidas Quentes' },
            { id: 6, name: 'Refrigerantes' },
            { id: 7, name: 'Sucos' }
          ];
        }
      });
  }

  loadProducts(): void {
    this.loading = true;
    const params: any = {
      search: this.searchTerm,
      page: this.currentPage + 1,
      per_page: this.pageSize,
      category: this.selectedCategory,
      stock_filter: this.stockFilter
    };

    // Se for funcionário, forçar filtro de estoque baixo/zerado
    if (this.isEmployee) {
      params.stock_filter = 'low';
      params.low_stock = true;
    } else if (this.showLowStock) {
      params.low_stock = true;
    }

    console.log('Parâmetros enviados:', params);

    this.stockService.getStock(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: StockResponse) => {
          console.log('Resposta recebida:', response);
          this.products = response.data;
          this.totalItems = response.total;
          this.loading = false;
        },
        error: (error: Error) => {
          console.error('Erro ao carregar produtos:', error);
          this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadProducts();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.loadProducts();
  }

  toggleLowStock(): void {
    this.showLowStock = !this.showLowStock;
    this.currentPage = 0;
    this.loadProducts();
  }

  onCategoryChange(): void {
    this.currentPage = 0;
    this.loadProducts();
  }

  onStockFilterChange(): void {
    // Se for funcionário, não permitir mudar o filtro
    if (this.isEmployee) {
      this.stockFilter = 'low';
      return;
    }
    this.currentPage = 0;
    this.loadProducts();
  }

  refreshData(): void {
    this.loadSummary();
    this.loadProducts();
    this.snackBar.open('Dados atualizados', 'Fechar', { duration: 2000 });
  }

  openStockMovement(product: Product): void {
    const dialogRef = this.dialog.open(StockMovementDialogComponent, {
      width: '500px',
      data: { product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.stockService.updateStock(product.id, result)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.snackBar.open('Estoque atualizado com sucesso', 'Fechar', { duration: 3000 });
              this.loadSummary();
              this.loadProducts();
            },
            error: (error: Error) => {
              console.error('Erro ao atualizar estoque:', error);
              this.snackBar.open('Erro ao atualizar estoque', 'Fechar', { duration: 3000 });
            }
          });
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  getStockColor(quantity: number, minQuantity: number): string {
    if (quantity === 0) return '#f44336'; // Vermelho - Esgotado
    if (quantity <= minQuantity) return '#f9a825'; // Amarelo - Baixo
    return '#4caf50'; // Verde - Normal
  }

  /**
   * Retorna label e cor do badge de status para indicadores visuais claros.
   * Esgotado (vermelho), Baixo (amarelo), Normal (verde).
   */
  getStockBadgeInfo(product: Product): { label: string; color: 'warn' | 'accent' | 'primary' } {
    const stock = product.current_stock ?? 0;
    const minStock = product.min_stock ?? 0;

    if (stock <= 0) {
      return { label: 'Esgotado', color: 'warn' };
    }
    if (stock <= minStock) {
      return { label: 'Baixo', color: 'accent' };
    }
    return { label: 'Normal', color: 'primary' };
  }

  getStockStatus(product: Product): { label: string; color: string } {
    const stock = product.current_stock || 0;
    const minStock = product.min_stock || 0;
    
    if (stock <= 0) {
      return { label: 'ESGOTADO', color: 'warn' };
    } else if (stock <= minStock) {
      return { label: 'BAIXO', color: 'accent' };
    }
    // Se chegou aqui, não deveria aparecer para funcionário, mas retorna BAIXO por segurança
    return { label: 'BAIXO', color: 'accent' };
  }

  viewProductHistory(product: Product): void {
    // Implementar diálogo de histórico de movimentações
    this.stockService.getProductMovements(product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (movements) => {
          // Aqui você pode abrir um diálogo para mostrar o histórico
          console.log('Histórico de movimentações:', movements);
          this.snackBar.open(`Histórico carregado: ${movements.length} movimentações`, 'Fechar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Erro ao carregar histórico:', error);
          this.snackBar.open('Erro ao carregar histórico', 'Fechar', { duration: 3000 });
        }
      });
  }

}