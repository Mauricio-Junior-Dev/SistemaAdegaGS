import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTable } from '@angular/material/table';
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
import { MatTreeModule } from '@angular/material/tree';
import { MatCardModule } from '@angular/material/card';
import { FlatTreeControl } from '@angular/cdk/tree';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { CategoryService, Category, CategoryResponse, CategoryTree } from '../../services/category.service';
import { environment } from '../../../../environments/environment';
import { CategoryFormDialogComponent } from './dialogs/category-form-dialog.component';
import { CategoryStatsDialogComponent } from './dialogs/category-stats-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
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
    MatProgressSpinnerModule,
    MatTreeModule,
    DragDropModule,
    CategoryFormDialogComponent,
    CategoryStatsDialogComponent,
    ConfirmDialogComponent
  ] as const,
  templateUrl: './categorias.component.html',
  styleUrls: ['./categorias.component.css']
})
export class CategoriasComponent implements OnInit, OnDestroy {
  displayedColumns = ['image', 'name', 'products_count', 'status', 'actions'];
  categories: Category[] = [];
  categoryTree: CategoryTree[] = [];
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  loading = true;
  searchTerm = '';
  selectedParent: number | null = null;
  showInactive = false;
  viewMode: 'list' | 'tree' = 'list';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<Category>;
  treeControl = new FlatTreeControl<CategoryTree>(
    (node: CategoryTree) => node.level,
    (node: CategoryTree) => node.expandable
  );
  hasChild = (_: number, node: CategoryTree) => node.expandable;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private categoryService: CategoryService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadCategories();
    });
  }

  getImageUrl(imageUrl?: string): string {
    if (!imageUrl) return 'assets/images/no-image.jpg';
    // Se já vier URL absoluta
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    // Se vier caminho do storage
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}`;
    }
    // Fallback
    return imageUrl;
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadCategoryTree();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.loading = true;

    const params = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      search: this.searchTerm || undefined,
      parent_id: this.selectedParent || undefined,
      is_active: this.showInactive ? undefined : true,
      sort_by: this.sort?.active,
      sort_order: this.sort?.direction || undefined
    };

    this.categoryService.getCategories(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CategoryResponse) => {
          this.categories = response.data;
          this.totalItems = response.total;
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar categorias:', error);
          this.snackBar.open('Erro ao carregar categorias', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  loadCategoryTree(): void {
    this.categoryService.getCategoryTree()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tree) => {
          this.categoryTree = tree;
        },
        error: (error) => {
          console.error('Erro ao carregar árvore de categorias:', error);
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
    this.loadCategories();
  }

  onSortChange(sort: Sort): void {
    this.loadCategories();
  }

  onParentChange(): void {
    this.currentPage = 0;
    this.loadCategories();
  }

  toggleFilters(filter: 'inactive'): void {
    if (filter === 'inactive') {
      this.showInactive = !this.showInactive;
    }
    this.currentPage = 0;
    this.loadCategories();
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'tree' : 'list';
    if (this.viewMode === 'tree') {
      this.loadCategoryTree();
    }
  }

  openCategoryDialog(category?: Category, parentId?: number): void {
    const dialogRef = this.dialog.open(CategoryFormDialogComponent, {
      width: '600px',
      data: { category, parentId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCategories();
        this.loadCategoryTree();
        this.snackBar.open(
          category ? 'Categoria atualizada com sucesso' : 'Categoria criada com sucesso',
          'Fechar',
          { duration: 3000 }
        );
      }
    });
  }

  deleteCategory(category: Category): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmar Exclusão',
        message: `Deseja realmente excluir a categoria "${category.name}"?`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.deleteCategory(category.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadCategories();
              this.loadCategoryTree();
              this.snackBar.open('Categoria excluída com sucesso', 'Fechar', { duration: 3000 });
            },
            error: (error) => {
              console.error('Erro ao excluir categoria:', error);
              this.snackBar.open('Erro ao excluir categoria', 'Fechar', { duration: 3000 });
            }
          });
      }
    });
  }

  toggleStatus(category: Category): void {
    this.categoryService.toggleStatus(category.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadCategories();
          this.loadCategoryTree();
          this.snackBar.open(
            `Categoria ${category.is_active ? 'desativada' : 'ativada'} com sucesso`,
            'Fechar',
            { duration: 3000 }
          );
        },
        error: (error) => {
          console.error('Erro ao alterar status da categoria:', error);
          this.snackBar.open('Erro ao alterar status da categoria', 'Fechar', { duration: 3000 });
        }
      });
  }

  showStats(category: Category): void {
    this.dialog.open(CategoryStatsDialogComponent, {
      width: '500px',
      data: { category }
    });
  }

  onDrop(event: any): void {
    const { previousIndex, currentIndex } = event;
    if (previousIndex === currentIndex) return;

    // Mover o item no array local
    const movedCategory = this.categories[previousIndex];
    this.categories.splice(previousIndex, 1);
    this.categories.splice(currentIndex, 0, movedCategory);

    // Criar array com novas posições baseadas na ordem atual
    const categories = this.categories.map((cat, index) => ({
      id: cat.id,
      position: index + 1 // Posições começam em 1
    }));

    this.categoryService.reorderCategories(categories)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Categorias reordenadas com sucesso!', 'Fechar', { duration: 2000 });
          // Atualizar a lista para refletir as mudanças
          this.loadCategories();
          this.loadCategoryTree();
        },
        error: (error) => {
          console.error('Erro ao reordenar categorias:', error);
          this.snackBar.open('Erro ao reordenar categorias', 'Fechar', { duration: 3000 });
          // Reverter a mudança local em caso de erro
          this.loadCategories();
        }
      });
  }

  moveCategory(category: Category, parentId: number | null): void {
    this.categoryService.moveCategory(category.id, parentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadCategories();
          this.loadCategoryTree();
          this.snackBar.open('Categoria movida com sucesso', 'Fechar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Erro ao mover categoria:', error);
          this.snackBar.open('Erro ao mover categoria', 'Fechar', { duration: 3000 });
        }
      });
  }
}
