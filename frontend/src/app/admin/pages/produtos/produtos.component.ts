import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTable } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { ProductService, Product, ProductResponse } from '../../services/product.service';
import { CategoryService, Category } from '../../services/category.service';
import { environment } from '../../../../environments/environment';
import { ProductFormDialogComponent } from './dialogs/product-form-dialog.component';
import { ProductImportDialogComponent } from './dialogs/product-import-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [
    MatCardModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './produtos.component.html',
  styleUrls: ['./produtos.component.css']
})
export class ProdutosComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns = ['image', 'name', 'category', 'price', 'current_stock', 'status', 'actions'];
  products: Product[] = [];
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  loading = true;
  searchTerm = '';
  selectedCategory: number | null = null;
  showInactive = false;
  showLowStock = false;
  filterFeatured = false;
  filterOffers = false;
  filterIsPack = false;
  filterVisibleOnline = false;
  categories: Category[] = [];
  
  // Estado de ordenação manual (para garantir que funciona corretamente)
  currentSortColumn: string = '';
  currentSortDirection: 'asc' | 'desc' | '' = '';
  
  // Flag para evitar loops durante limpeza de filtros
  private isClearingFilters = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<Product>;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadProducts();
    });
  }

  getImageUrl(product: Product): string {
    const imageUrl = product.image_url;
    if (!imageUrl) return 'assets/images/no-image.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return `${imageUrl}?v=${encodeURIComponent(product.updated_at)}`;
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}?v=${encodeURIComponent(product.updated_at)}`;
    }
    return `${imageUrl}?v=${encodeURIComponent(product.updated_at)}`;
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  ngAfterViewInit(): void {
    // Garantir que o MatSort está vinculado corretamente
    if (this.sort) {
      // O MatSort já está vinculado via ViewChild
      // Não precisamos fazer nada adicional, mas garantimos que está disponível
    }
  }

  loadCategories(): void {
    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Erro ao carregar categorias:', error);
          this.snackBar.open('Erro ao carregar categorias', 'Fechar', { duration: 3000 });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts(): void {
    this.loading = true;

    // Construir parâmetros dinamicamente - só enviar se for true
    const params: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize
    };

    // Busca e categoria
    if (this.searchTerm) {
      params.search = this.searchTerm;
    }
    if (this.selectedCategory) {
      params.category_id = this.selectedCategory;
    }

    // Status ativo/inativo
    if (!this.showInactive) {
      params.is_active = true;
    }

    // Filtros booleanos - só enviar se for true
    if (this.showLowStock) {
      params.low_stock = true;
    }
    if (this.filterFeatured) {
      params.featured = true;
    }
    if (this.filterOffers) {
      params.offers = true;
    }
    if (this.filterIsPack) {
      params.is_pack = true;
    }
    if (this.filterVisibleOnline) {
      params.visible_online = true;
    }

    // Ordenação - usar o estado manual que controlamos
    if (this.currentSortColumn && this.currentSortDirection) {
      params.sort_by = this.currentSortColumn;
      params.sort_order = this.currentSortDirection;
    }

    this.productService.getProducts(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ProductResponse) => {
          this.products = response.data;
          this.totalItems = response.total;
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar produtos:', error);
          this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.searchSubject.next(this.searchTerm);
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.loadProducts();
  }

  onSortChange(sort: Sort): void {
    // Lógica de alternância manual
    if (sort.active === this.currentSortColumn) {
      // Mesma coluna - alternar direção
      if (this.currentSortDirection === 'asc') {
        this.currentSortDirection = 'desc';
      } else if (this.currentSortDirection === 'desc') {
        // Terceiro clique - limpar ordenação
        this.currentSortColumn = '';
        this.currentSortDirection = '';
      } else {
        // Primeiro clique nesta coluna
        this.currentSortColumn = sort.active;
        this.currentSortDirection = 'asc';
      }
    } else {
      // Nova coluna - começar com 'asc'
      this.currentSortColumn = sort.active;
      this.currentSortDirection = sort.direction || 'asc';
    }
    
    // Sincronizar com o MatSort
    if (this.sort) {
      this.sort.active = this.currentSortColumn;
      this.sort.direction = this.currentSortDirection;
    }
    
    // Resetar página ao mudar ordenação
    this.currentPage = 0;
    
    // Carregar produtos com nova ordenação
    this.loadProducts();
  }

  onCategoryChange(): void {
    // Ignorar se estiver limpando filtros
    if (this.isClearingFilters) {
      return;
    }
    
    this.currentPage = 0;
    this.loadProducts();
  }

  toggleFilters(filter: 'inactive' | 'lowStock'): void {
    // Ignorar se estiver limpando filtros
    if (this.isClearingFilters) {
      return;
    }
    
    if (filter === 'inactive') {
      this.showInactive = !this.showInactive;
    } else {
      this.showLowStock = !this.showLowStock;
    }
    this.currentPage = 0;
    this.loadProducts();
  }

  onFilterChange(filterType: 'featured' | 'offers' | 'is_pack' | 'visible_online', event: any): void {
    // Ignorar se estiver limpando filtros
    if (this.isClearingFilters) {
      return;
    }
    
    const isSelected = event.selected;
    
    switch (filterType) {
      case 'featured':
        this.filterFeatured = isSelected;
        break;
      case 'offers':
        this.filterOffers = isSelected;
        break;
      case 'is_pack':
        this.filterIsPack = isSelected;
        break;
      case 'visible_online':
        this.filterVisibleOnline = isSelected;
        break;
    }
    
    this.currentPage = 0;
    this.loadProducts();
  }

  hasActiveFilters(): boolean {
    return this.showInactive ||
           this.showLowStock ||
           this.filterFeatured ||
           this.filterOffers ||
           this.filterIsPack ||
           this.filterVisibleOnline ||
           !!this.searchTerm ||
           !!this.selectedCategory;
  }

  clearFilters(): void {
    // Ativar flag para evitar que event listeners disparem durante o reset
    this.isClearingFilters = true;
    
    // Reset em lote - todas as variáveis de uma vez
    this.searchTerm = '';
    this.selectedCategory = null;
    this.showInactive = false;
    this.showLowStock = false;
    this.filterFeatured = false;
    this.filterOffers = false;
    this.filterIsPack = false;
    this.filterVisibleOnline = false;
    this.currentPage = 0;
    
    // Limpar ordenação também
    this.currentSortColumn = '';
    this.currentSortDirection = '';
    if (this.sort) {
      this.sort.active = '';
      this.sort.direction = '';
    }
    
    // Aguardar um tick para garantir que todas as mudanças foram processadas
    // e os event listeners não serão disparados
    setTimeout(() => {
      this.isClearingFilters = false;
      
      // Forçar detecção de mudanças para atualizar a UI
      this.cdr.detectChanges();
      
      // Chamar loadProducts() apenas uma vez no final
      this.loadProducts();
    }, 0);
  }

  openProductDialog(product?: Product): void {
    const dialogRef = this.dialog.open(ProductFormDialogComponent, {
      width: '800px',
      data: { product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadProducts();
        this.snackBar.open(
          product ? 'Produto atualizado com sucesso' : 'Produto criado com sucesso',
          'Fechar',
          { duration: 3000 }
        );
      }
    });
  }

  deleteProduct(product: Product): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmar Exclusão',
        message: `Deseja realmente excluir o produto "${product.name}"?`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.productService.deleteProduct(product.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadProducts();
              this.snackBar.open('Produto excluído com sucesso', 'Fechar', { duration: 3000 });
            },
            error: (error) => {
              console.error('Erro ao excluir produto:', error);
              
              let errorMessage = 'Erro ao excluir produto';
              
              if (error.error && error.error.error) {
                errorMessage = error.error.error;
              } else if (error.status === 400) {
                errorMessage = 'Não é possível excluir produto com pedidos associados';
              } else if (error.status === 403) {
                errorMessage = 'Acesso não autorizado';
              } else if (error.status === 404) {
                errorMessage = 'Produto não encontrado';
              }
              
              this.snackBar.open(errorMessage, 'Fechar', { 
                duration: 5000,
                panelClass: ['error-snackbar']
              });
            }
          });
      }
    });
  }

  toggleStatus(product: Product): void {
    this.productService.toggleStatus(product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadProducts();
          this.snackBar.open(
            `Produto ${product.is_active ? 'desativado' : 'ativado'} com sucesso`,
            'Fechar',
            { duration: 3000 }
          );
        },
        error: (error) => {
          console.error('Erro ao alterar status do produto:', error);
          this.snackBar.open('Erro ao alterar status do produto', 'Fechar', { duration: 3000 });
        }
      });
  }

  openImportDialog(): void {
    const dialogRef = this.dialog.open(ProductImportDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadProducts();
      }
    });
  }

  exportProducts(format: 'csv' | 'xlsx'): void {
    this.productService.exportProducts(format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `produtos.${format}`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Erro ao exportar produtos:', error);
          this.snackBar.open('Erro ao exportar produtos', 'Fechar', { duration: 3000 });
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
    if (quantity === 0) return '#f44336'; // Vermelho
    if (quantity <= minQuantity) return '#ff9800'; // Laranja
    return '#4caf50'; // Verde
  }
}
