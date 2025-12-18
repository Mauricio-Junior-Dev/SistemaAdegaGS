import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
import { Subject, debounceTime, distinctUntilChanged, takeUntil, skip } from 'rxjs';

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
  categories: Category[] = [];
  
  // Formulário central com todos os filtros
  filterForm!: FormGroup;
  
  // Estado de ordenação (mantido separado do form para controle do MatSort)
  currentSortColumn: string = '';
  currentSortDirection: 'asc' | 'desc' | '' = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<Product>;

  private destroy$ = new Subject<void>();
  private isLoading = false;

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Criar formulário com todos os filtros
    this.filterForm = this.fb.group({
      searchTerm: [''],
      category_id: [null],
      showInactive: [false],
      low_stock: [false],
      featured: [false],
      offers: [false],
      is_pack: [false],
      visible_online: [false]
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
    
    // FLUXO UNIDIRECIONAL: URL → Form → URL → loadProducts
    
    // 1. Ler queryParams da URL e preencher o form
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      // Parsear filtros da URL
      const filterState = this.parseQueryParams(params);
      
      // Atualizar form sem disparar valueChanges
      this.filterForm.patchValue(filterState, { emitEvent: false });
      
      // Atualizar ordenação e paginação
      this.currentSortColumn = params['sort_by'] || '';
      this.currentSortDirection = (params['sort_order'] as 'asc' | 'desc' | '') || '';
      this.currentPage = parseInt(params['page'] || '1', 10) - 1;
      
      // Carregar produtos baseado nos parâmetros da URL
      this.loadProducts();
    });

    // 2. Form valueChanges → Atualizar URL (com debounce)
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => {
        // Comparação profunda para evitar requisições desnecessárias
        return JSON.stringify(prev) === JSON.stringify(curr);
      }),
      skip(1), // Pular o primeiro valor (valor inicial)
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Resetar página ao mudar qualquer filtro
      this.currentPage = 0;
      this.updateUrl();
    });

    // 3. Quando URL mudar (via router.navigate), route.queryParams dispara novamente
    // Isso garante que loadProducts seja chamado
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
    // Evitar requisições simultâneas
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.loading = true;

    // Construir parâmetros a partir do form e estado atual
    const formValue = this.filterForm.value;
    const params: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize
    };

    // Busca
    if (formValue.searchTerm) {
      params.search = formValue.searchTerm;
    }

    // Categoria
    if (formValue.category_id) {
      params.category_id = formValue.category_id;
    }

    // Status ativo/inativo (inverso de showInactive)
    if (!formValue.showInactive) {
      params.is_active = true;
    }

    // Filtros booleanos - só enviar se for true
    if (formValue.low_stock) {
      params.low_stock = true;
    }
    if (formValue.featured) {
      params.featured = true;
    }
    if (formValue.offers) {
      params.offers = true;
    }
    if (formValue.is_pack) {
      params.is_pack = true;
    }
    if (formValue.visible_online) {
      params.visible_online = true;
    }

    // Ordenação
    if (this.currentSortColumn && this.currentSortDirection) {
      params.sort_by = this.currentSortColumn;
      params.sort_order = this.currentSortDirection;
    }

    this.productService.getProducts(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ProductResponse) => {
          this.products = response.data || [];
          this.totalItems = response.total || 0;
          this.loading = false;
          this.isLoading = false;
          
          // Se totalItems mudou para 0 e estamos em página > 0, resetar
          if (this.totalItems === 0 && this.currentPage > 0) {
            this.currentPage = 0;
            // Não recarregar aqui para evitar loop
          }
        },
        error: (error) => {
          console.error('Erro ao carregar produtos:', error);
          
          // Não disparar nova requisição em caso de erro
          this.loading = false;
          this.isLoading = false;
          
          if (error.status !== 429) {
            this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
          } else {
            this.snackBar.open('Muitas requisições. Aguarde um momento...', 'Fechar', { duration: 3000 });
          }
        }
      });
  }

  onPageChange(event: PageEvent): void {
    if (this.isLoading) {
      return;
    }

    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.updateUrl();
  }

  onSortChange(sort: Sort): void {
    if (this.isLoading) {
      return;
    }

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
    this.updateUrl();
  }

  hasActiveFilters(): boolean {
    const formValue = this.filterForm.value;
    return formValue.showInactive ||
           formValue.low_stock ||
           formValue.featured ||
           formValue.offers ||
           formValue.is_pack ||
           formValue.visible_online ||
           !!formValue.searchTerm ||
           !!formValue.category_id;
  }

  clearFilters(): void {
    // Resetar form
    this.filterForm.reset({
      searchTerm: '',
      category_id: null,
      showInactive: false,
      low_stock: false,
      featured: false,
      offers: false,
      is_pack: false,
      visible_online: false
    });
    
    // Resetar ordenação
    this.currentSortColumn = '';
    this.currentSortDirection = '';
    if (this.sort) {
      this.sort.active = '';
      this.sort.direction = '';
    }
    
    // Resetar página
    this.currentPage = 0;
    
    // Atualizar URL (que disparará loadProducts via route.queryParams)
    this.updateUrl();
  }

  // Métodos auxiliares para sincronização URL ↔ Form

  private parseQueryParams(params: any): any {
    return {
      searchTerm: params['search'] || '',
      category_id: params['category_id'] ? parseInt(params['category_id'], 10) : null,
      showInactive: params['show_inactive'] === 'true' || params['show_inactive'] === true,
      low_stock: params['low_stock'] === 'true' || params['low_stock'] === true,
      featured: params['featured'] === 'true' || params['featured'] === true,
      offers: params['offers'] === 'true' || params['offers'] === true,
      is_pack: params['is_pack'] === 'true' || params['is_pack'] === true,
      visible_online: params['visible_online'] === 'true' || params['visible_online'] === true
    };
  }

  private updateUrl(): void {
    const formValue = this.filterForm.value;
    const queryParams: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize
    };

    // Adicionar apenas parâmetros não-vazios
    if (formValue.searchTerm) {
      queryParams.search = formValue.searchTerm;
    }
    if (formValue.category_id) {
      queryParams.category_id = formValue.category_id;
    }
    if (formValue.showInactive) {
      queryParams.show_inactive = 'true';
    }
    if (formValue.low_stock) {
      queryParams.low_stock = 'true';
    }
    if (formValue.featured) {
      queryParams.featured = 'true';
    }
    if (formValue.offers) {
      queryParams.offers = 'true';
    }
    if (formValue.is_pack) {
      queryParams.is_pack = 'true';
    }
    if (formValue.visible_online) {
      queryParams.visible_online = 'true';
    }
    if (this.currentSortColumn && this.currentSortDirection) {
      queryParams.sort_by = this.currentSortColumn;
      queryParams.sort_order = this.currentSortDirection;
    }

    // Navegar atualizando query params (merge preserva outros params)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true // Não adicionar ao histórico para cada mudança
    });
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
