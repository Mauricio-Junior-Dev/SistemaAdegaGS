import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, interval } from 'rxjs';

import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { CashService } from '../../services/cash.service';
import { OrderService } from '../../services/order.service';
import { DashboardSummary } from '../../models/dashboard.model';
import { CashStatus } from '../../models/cash.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  summary: DashboardSummary | null = null;
  cashStatus: CashStatus | null = null;
  loading = true;
  error = false;
  isEmployee = false;
  isAdmin = false;
  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService,
    private cashService: CashService,
    private orderService: OrderService
  ) {}

  ngOnInit() {
    // Verificar tipo de usuário
    this.isEmployee = this.authService.isEmployee() && !this.authService.isAdmin();
    this.isAdmin = this.authService.isAdmin();
    
    if (this.isEmployee) {
      // Para funcionários, carregar apenas dados operacionais
      this.loadEmployeeData(true);
    } else {
      // Para admin, carregar todos os dados
      this.loadSummary(true);
    }
    
    // Atualizar os dados a cada 15 segundos para manter os números atualizados
    interval(15000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isEmployee) {
          this.loadEmployeeData(false);
        } else {
          this.loadSummary(false);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSummary(showLoading = true) {
    if (showLoading) {
      this.loading = true;
    }
    this.error = false;

    this.dashboardService.getSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.summary = data;
          if (showLoading) {
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Erro ao carregar dashboard:', error);
          this.error = true;
          if (showLoading) {
            this.loading = false;
          }
        }
      });
  }

  loadEmployeeData(showLoading = true) {
    if (showLoading) {
      this.loading = true;
    }
    this.error = false;

    // Carregar apenas status do caixa e pedidos (sem vendas e estoque)
    this.cashService.getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cash) => {
          this.cashStatus = cash;
          
          // Carregar resumo de pedidos
          this.orderService.getOrdersSummary()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (orders) => {
                // Criar summary mínimo apenas com pedidos
                this.summary = {
                  sales: {
                    total_amount: 0,
                    total_orders: 0
                  },
                  orders: {
                    pending: orders.pending,
                    delivering: orders.delivering,
                    completed: orders.completed
                  },
                  cash: {
                    is_open: cash.is_open,
                    current_amount: cash.current_amount
                  },
                  stock: {
                    total_products: 0,
                    low_stock_count: 0
                  }
                };
                
                if (showLoading) {
                  this.loading = false;
                }
              },
              error: (error) => {
                console.error('Erro ao carregar pedidos:', error);
                this.error = true;
                if (showLoading) {
                  this.loading = false;
                }
              }
            });
        },
        error: (error) => {
          console.error('Erro ao carregar status do caixa:', error);
          this.error = true;
          if (showLoading) {
            this.loading = false;
          }
        }
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}