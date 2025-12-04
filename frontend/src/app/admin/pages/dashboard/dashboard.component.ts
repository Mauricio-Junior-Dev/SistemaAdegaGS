import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { AdminDashboardService, AdminDashboardSummary, TopProducts, TopCustomers } from '../../services/admin-dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReportService } from '../../services/report.service';
import { NgChartsModule } from 'ng2-charts';
import { PIE_CHART_OPTIONS, LINE_CHART_OPTIONS, CHART_COLORS } from './chart-config';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    RouterModule,
    NgChartsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = true;
  summary: AdminDashboardSummary | null = null;
  topProducts: TopProducts[] = [];
  topCustomers: TopCustomers[] = [];
  
  // Verificação de tipo de usuário
  isAdmin = false;
  isEmployee = false;

  // Gráfico de vendas
  salesChartData: any = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Vendas',
        backgroundColor: 'rgba(63, 81, 181, 0.2)',
        borderColor: 'rgb(63, 81, 181)',
        pointBackgroundColor: 'rgb(63, 81, 181)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(63, 81, 181)',
        fill: 'origin',
      }
    ]
  };

  salesChartOptions = LINE_CHART_OPTIONS;

  // Gráfico de pizza para pedidos
  ordersPieChartData: any = {
    labels: ['Pendentes', 'Em Entrega', 'Concluídos', 'Cancelados'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: [
        '#ff9800',
        '#2196f3', 
        '#4caf50',
        '#f44336'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  ordersPieChartOptions = PIE_CHART_OPTIONS;

  // Gráfico de pizza para usuários
  usersPieChartData: any = {
    labels: ['Clientes', 'Funcionários', 'Admins'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: [
        '#4caf50',
        '#2196f3',
        '#ff9800'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  usersPieChartOptions = PIE_CHART_OPTIONS;

  // Gráfico de pizza para estoque
  stockPieChartData: any = {
    labels: ['Estoque Normal', 'Estoque Baixo', 'Sem Estoque'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: [
        '#4caf50',
        '#ff9800',
        '#f44336'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  stockPieChartOptions = PIE_CHART_OPTIONS;

  // Gráfico de clientes (Chart.js direto)
  private customerChart: any;

  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: AdminDashboardService,
    private reportService: ReportService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verificar tipo de usuário
    this.isAdmin = this.authService.isAdmin();
    this.isEmployee = this.authService.isEmployee() && !this.authService.isAdmin();
    
    if (this.isEmployee) {
      // Para funcionários, carregar apenas dados operacionais (sem vendas e estoque)
      this.loadEmployeeData();
    } else {
      // Para admin, carregar todos os dados
      this.loadDashboardData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.customerChart) {
      this.customerChart.destroy();
    }
  }

  loadDashboardData(): void {
    this.dashboardService.getDashboardData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.summary = data.summary;
          this.topProducts = data.topProducts;
          this.topCustomers = data.topCustomers;
          this.updateSalesChart(data.salesChart);
          this.updatePieCharts();
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar dados do dashboard:', error);
          this.loading = false;
        }
      });

    // Carregar gráfico de clientes
    const filters = {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    };

    this.reportService.getCustomerSummary(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          setTimeout(() => this.renderCustomerChart(data), 100);
        },
        error: (error) => {
          console.error('Erro ao carregar gráfico de clientes:', error);
        }
      });
  }

  private updateSalesChart(chartData: { labels: string[], data: number[] }): void {
    this.salesChartData.labels = chartData.labels;
    this.salesChartData.datasets[0].data = chartData.data;
  }

  private updatePieCharts(): void {
    if (!this.summary) return;

    // Atualizar gráfico de pedidos
    this.ordersPieChartData = {
      ...this.ordersPieChartData,
      datasets: [{
        ...this.ordersPieChartData.datasets[0],
        data: [
          this.summary.orders.pending,
          this.summary.orders.delivering,
          this.summary.orders.completed,
          this.summary.orders.cancelled
        ]
      }]
    };

    // Atualizar gráfico de usuários
    this.usersPieChartData = {
      ...this.usersPieChartData,
      datasets: [{
        ...this.usersPieChartData.datasets[0],
        data: [
          this.summary.users.customers,
          this.summary.users.employees,
          this.summary.users.admins
        ]
      }]
    };

    // Calcular dados do estoque
    const normalStock = this.summary.stock.total_products - this.summary.stock.low_stock_count - this.summary.stock.out_of_stock_count;
    this.stockPieChartData = {
      ...this.stockPieChartData,
      datasets: [{
        ...this.stockPieChartData.datasets[0],
        data: [
          Math.max(0, normalStock),
          this.summary.stock.low_stock_count,
          this.summary.stock.out_of_stock_count
        ]
      }]
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  getStatusColor(count: number, threshold: number): string {
    if (count === 0) return '#4caf50'; // Verde
    if (count > threshold) return '#f44336'; // Vermelho
    return '#ff9800'; // Laranja
  }

  refresh(): void {
    this.loading = true;
    if (this.isEmployee) {
      this.loadEmployeeData();
    } else {
      this.loadDashboardData();
    }
  }

  loadEmployeeData(): void {
    // Carregar apenas resumo básico (pedidos) sem dados financeiros
    this.dashboardService.getSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Criar summary mínimo apenas com pedidos (sem vendas e estoque)
          this.summary = {
            ...data,
            sales: {
              today: 0,
              week: 0,
              month: 0,
              total_orders: data.orders.pending + data.orders.delivering + data.orders.completed,
              average_ticket: 0,
              by_payment_method: []
            },
            stock: {
              total_products: 0,
              low_stock_count: 0,
              out_of_stock_count: 0,
              total_value: 0,
              categories_count: 0
            }
          };
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar dados do dashboard:', error);
          this.loading = false;
        }
      });
  }

  // Método para forçar atualização dos gráficos
  private forceChartUpdate(): void {
    // Força a detecção de mudanças nos gráficos
    setTimeout(() => {
      this.ordersPieChartData = { ...this.ordersPieChartData };
      this.usersPieChartData = { ...this.usersPieChartData };
      this.stockPieChartData = { ...this.stockPieChartData };
      this.salesChartData = { ...this.salesChartData };
    }, 100);
  }

  // Renderiza o gráfico de pizza de clientes
  renderCustomerChart(data: any): void {
    const ctx = document.getElementById('customerPizzaChart') as HTMLCanvasElement;
    if (!ctx || !data) return;

    if (this.customerChart) {
      this.customerChart.destroy();
    }

    this.customerChart = new Chart(ctx, {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}
