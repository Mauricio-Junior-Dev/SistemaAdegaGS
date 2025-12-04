import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTable } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { StockMovementService, StockMovement, MovementFilters } from '../../services/stock-movement.service';
import { ProductService } from '../../services/product.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-movimentacoes',
  standalone: true,
  imports: [
    MatCardModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './movimentacoes.component.html',
  styleUrls: ['./movimentacoes.component.css']
})
export class MovimentacoesComponent implements OnInit, OnDestroy {
  displayedColumns = ['date', 'product', 'user', 'type', 'quantity', 'description', 'unit_cost'];
  movements: StockMovement[] = [];
  totalItems = 0;
  pageSize = 15;
  currentPage = 0;
  loading = true;
  
  // Filtros
  filters: MovementFilters = {};
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  
  // Dados para filtros
  products: any[] = [];
  users: any[] = [];
  
  // Stats do mês
  movementStats: { total_in: number; total_out: number; balance: number } | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatTable) table!: MatTable<StockMovement>;

  private destroy$ = new Subject<void>();

  constructor(
    private stockMovementService: StockMovementService,
    private productService: ProductService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadMovementStats();
    this.loadMovements();
    this.loadFilterData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMovements(): void {
    this.loading = true;

    const params = {
      ...this.filters,
      page: this.currentPage + 1,
      per_page: this.pageSize,
      date_from: this.dateFrom ? this.dateFrom.toISOString().split('T')[0] : undefined,
      date_to: this.dateTo ? this.dateTo.toISOString().split('T')[0] : undefined
    };

    this.stockMovementService.getMovements(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.movements = response.data;
          this.totalItems = response.total;
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar movimentações:', error);
          this.snackBar.open('Erro ao carregar movimentações', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  loadMovementStats(): void {
    const params = {
      date_from: this.dateFrom ? this.dateFrom.toISOString().split('T')[0] : undefined,
      date_to: this.dateTo ? this.dateTo.toISOString().split('T')[0] : undefined
    };

    this.stockMovementService.getMovementStats(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.movementStats = stats;
        },
        error: (error) => {
          console.error('Erro ao carregar estatísticas:', error);
        }
      });
  }

  loadFilterData(): void {
    // Carregar produtos
    this.productService.getProducts({ per_page: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.products = response.data;
        },
        error: (error) => {
          console.error('Erro ao carregar produtos:', error);
        }
      });

    // Carregar usuários
    this.userService.getUsers({ per_page: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.data;
        },
        error: (error) => {
          console.error('Erro ao carregar usuários:', error);
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.loadMovements();
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadMovements();
    this.loadMovementStats();
  }

  clearFilters(): void {
    this.filters = {};
    this.dateFrom = null;
    this.dateTo = null;
    this.currentPage = 0;
    this.loadMovements();
    this.loadMovementStats();
  }

  exportMovements(): void {
    const params = {
      ...this.filters,
      date_from: this.dateFrom ? this.dateFrom.toISOString().split('T')[0] : undefined,
      date_to: this.dateTo ? this.dateTo.toISOString().split('T')[0] : undefined
    };

    this.stockMovementService.exportMovements(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Criar e baixar arquivo CSV
          this.downloadCSV(data.data, 'movimentacoes-estoque.csv');
          this.snackBar.open('Relatório exportado com sucesso', 'Fechar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Erro ao exportar movimentações:', error);
          this.snackBar.open('Erro ao exportar movimentações', 'Fechar', { duration: 3000 });
        }
      });
  }

  private downloadCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('pt-BR');
  }

  getTypeColor(type: string): string {
    return type === 'entrada' ? 'primary' : 'warn';
  }

  getTypeLabel(type: string): string {
    return type === 'entrada' ? 'Entrada' : 'Saída';
  }
}
