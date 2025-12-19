import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule, MatTable } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, startWith, combineLatest } from 'rxjs';

import { ProductService, Product, ProductResponse } from '../../services/product.service';
import { CategoryService, Category } from '../../services/category.service';
import { environment } from '../../../../environments/environment';
import { ProductFormDialogComponent } from './dialogs/product-form-dialog.component';
import { ProductImportDialogComponent } from './dialogs/product-import-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [
    MatCardModule,
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatButtonToggleModule,
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
  styleUrls: ['./produtos.component.scss']
})
export class ProdutosComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns = ['image', 'name', 'category', 'price', 'current_stock', 'status', 'actions'];
  products: Product[] = [];
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  loading = false;
  categories: Category[] = [];
  
  // Formulário único com todos os filtros
  filterForm!: FormGroup;
  
  // Estado de ordenação e paginação
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' | '' = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<Product>;

  private destroy$ = new Subject<void>();

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
      search: [''],
      category_id: [null],
      status: ['active'], // 'all' | 'active' | 'inactive'
      low_stock: [false],
      featured: [false],
      offers: [false],
      is_pack: [false],
      visible_online: [false]
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    // 1. Carregar estado inicial da URL
    this.route.queryParams.pipe(
      takeUntil(this.destroy$),
      startWith(this.route.snapshot.queryParams)
    ).subscribe(queryParams => {
      if (queryParams && Object.keys(queryParams).length > 0) {
        const formState = this.parseQueryParams(queryParams);
        this.filterForm.patchValue(formState, { emitEvent: false });
        
        this.sortColumn = queryParams['sort_by'] || '';
        this.sortDirection = (queryParams['sort_order'] as 'asc' | 'desc' | '') || '';
        this.currentPage = parseInt(queryParams['page'] || '1', 10) - 1;
        this.pageSize = parseInt(queryParams['per_page'] || '10', 10);
      }
    });

    // 2. Pipeline único: form changes -> switchMap -> load products
    // Separar busca (com debounce) dos outros filtros (instantâneos)
    const searchChanges$ = this.filterForm.get('search')!.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      startWith(this.filterForm.get('search')!.value)
    );

    const otherFilters$ = combineLatest([
      this.filterForm.get('category_id')!.valueChanges.pipe(startWith(this.filterForm.get('category_id')!.value)),
      this.filterForm.get('status')!.valueChanges.pipe(startWith(this.filterForm.get('status')!.value)),
      this.filterForm.get('low_stock')!.valueChanges.pipe(startWith(this.filterForm.get('low_stock')!.value)),
      this.filterForm.get('featured')!.valueChanges.pipe(startWith(this.filterForm.get('featured')!.value)),
      this.filterForm.get('offers')!.valueChanges.pipe(startWith(this.filterForm.get('offers')!.value)),
      this.filterForm.get('is_pack')!.valueChanges.pipe(startWith(this.filterForm.get('is_pack')!.value)),
      this.filterForm.get('visible_online')!.valueChanges.pipe(startWith(this.filterForm.get('visible_online')!.value))
    ]);

    combineLatest([searchChanges$, otherFilters$]).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        const params = this.buildApiParams();
        this.updateUrl(params);
        this.loading = true;
        return this.productService.getProducts(params);
      })
    ).subscribe({
      next: (response: ProductResponse) => {
        this.products = response.data || [];
        this.totalItems = response.total || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos:', error);
        this.loading = false;
        this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.sort && this.sortColumn) {
      this.sort.active = this.sortColumn;
      this.sort.direction = this.sortDirection;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.filterForm.updateValueAndValidity({ emitEvent: true });
  }

  onSortChange(sort: Sort): void {
    if (sort.active === this.sortColumn) {
      if (this.sortDirection === 'asc') {
        this.sortDirection = 'desc';
      } else if (this.sortDirection === 'desc') {
        this.sortColumn = '';
        this.sortDirection = '';
      } else {
        this.sortDirection = 'asc';
      }
    } else {
      this.sortColumn = sort.active;
      this.sortDirection = sort.direction || 'asc';
    }
    
    this.currentPage = 0;
    this.filterForm.updateValueAndValidity({ emitEvent: true });
  }

  hasActiveFilters(): boolean {
    const value = this.filterForm.value;
    return !!value.search ||
           !!value.category_id ||
           value.status !== 'active' ||
           value.low_stock ||
           value.featured ||
           value.offers ||
           value.is_pack ||
           value.visible_online;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      category_id: null,
      status: 'active',
      low_stock: false,
      featured: false,
      offers: false,
      is_pack: false,
      visible_online: false
    });
    
    this.sortColumn = '';
    this.sortDirection = '';
    this.currentPage = 0;
    
    if (this.sort) {
      this.sort.active = '';
      this.sort.direction = '';
    }
  }

  // Métodos auxiliares

  private parseQueryParams(params: any): any {
    return {
      search: params['search'] || '',
      category_id: params['category_id'] ? parseInt(params['category_id'], 10) : null,
      status: (params['status'] === 'inactive' || params['status'] === 'all') ? params['status'] : 'active',
      low_stock: params['low_stock'] === 'true' || params['low_stock'] === true,
      featured: params['featured'] === 'true' || params['featured'] === true,
      offers: params['offers'] === 'true' || params['offers'] === true,
      is_pack: params['is_pack'] === 'true' || params['is_pack'] === true,
      visible_online: params['visible_online'] === 'true' || params['visible_online'] === true
    };
  }

  private buildApiParams(): any {
    const formValue = this.filterForm.value;
    const params: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize
    };

    if (formValue.search?.trim()) {
      params.search = formValue.search.trim();
    }

    if (formValue.category_id) {
      params.category_id = formValue.category_id;
    }

    // Status: converter para is_active boolean ou não enviar
    if (formValue.status === 'active') {
      params.is_active = true;
    } else if (formValue.status === 'inactive') {
      params.is_active = false;
    }
    // Se status === 'all', não enviar is_active

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

    if (this.sortColumn && this.sortDirection) {
      params.sort_by = this.sortColumn;
      params.sort_order = this.sortDirection;
    }

    return params;
  }

  private updateUrl(params: any): void {
    const formValue = this.filterForm.value;
    const queryParams: any = {};

    if (params.search) {
      queryParams.search = params.search;
    }

    if (params.category_id) {
      queryParams.category_id = params.category_id;
    }

    // Status: sempre incluir
    queryParams.status = formValue.status;

    if (params.low_stock) {
      queryParams.low_stock = 'true';
    }

    if (params.featured) {
      queryParams.featured = 'true';
    }

    if (params.offers) {
      queryParams.offers = 'true';
    }

    if (params.is_pack) {
      queryParams.is_pack = 'true';
    }

    if (params.visible_online) {
      queryParams.visible_online = 'true';
    }

    if (params.sort_by) {
      queryParams.sort_by = params.sort_by;
      queryParams.sort_order = params.sort_order;
    }

    queryParams.page = params.page;
    queryParams.per_page = params.per_page;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace',
      replaceUrl: true
    });
  }

  // Métodos de UI

  getImageUrl(product: Product): string {
    const imageUrl = product.image_url;
    if (!imageUrl) return 'assets/images/no-image.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return `${imageUrl}?v=${encodeURIComponent(product.updated_at)}`;
    }
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}?v=${encodeURIComponent(product.updated_at)}`;
    }
    return `${imageUrl}?v=${encodeURIComponent(product.updated_at)}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  getStockColor(quantity: number, minQuantity: number): string {
    if (quantity === 0) return '#f44336';
    if (quantity <= minQuantity) return '#ff9800';
    return '#4caf50';
  }

  // Métodos de ações

  openProductDialog(product?: Product): void {
    const dialogRef = this.dialog.open(ProductFormDialogComponent, {
      width: '800px',
      data: { product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.filterForm.updateValueAndValidity({ emitEvent: true });
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
              this.filterForm.updateValueAndValidity({ emitEvent: true });
              this.snackBar.open('Produto excluído com sucesso', 'Fechar', { duration: 3000 });
            },
            error: (error) => {
              console.error('Erro ao excluir produto:', error);
              let errorMessage = 'Erro ao excluir produto';
              
              if (error.error?.error) {
                errorMessage = error.error.error;
              } else if (error.status === 400) {
                errorMessage = 'Não é possível excluir produto com pedidos associados';
              }
              
              this.snackBar.open(errorMessage, 'Fechar', { duration: 5000 });
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
          this.filterForm.updateValueAndValidity({ emitEvent: true });
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
        this.filterForm.updateValueAndValidity({ emitEvent: true });
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
}
