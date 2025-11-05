import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ReportService } from '../../services/report.service';
import { forkJoin, Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { MatTabChangeEvent } from '@angular/material/tabs';

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  templateUrl: './relatorios.component.html',
  styleUrls: ['./relatorios.component.css']
})
export class RelatoriosComponent implements OnInit, OnDestroy {
  
  public loading = true; // Começa em estado de loading
  private subscriptions = new Subscription();

  // Propriedades para os dados das 3 abas
  public overviewData: any;
  public productData: any;
  public customerData: any;

  // Propriedades para as instâncias dos gráficos
  private salesChart: any;
  private customerChart: any;

  constructor(private reportService: ReportService) {}

  ngOnInit(): void {
    this.loadAllReports();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Garante que o método destroy() existe antes de chamá-lo
    if (this.salesChart) {
      this.salesChart.destroy();
    }
    if (this.customerChart) {
      this.customerChart.destroy();
    }
  }

  loadAllReports(): void {
    this.loading = true;

    // Filtros de data - últimos 30 dias até hoje
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };

    // forkJoin espera todas as 3 APIs retornarem
    const allReports$ = forkJoin({
      overview: this.reportService.getOverviewReport(filters),
      products: this.reportService.getProductReport(filters),
      customers: this.reportService.getCustomerReport(filters)
    });

    const sub = allReports$.subscribe({
      next: (results) => {
        // 1. Armazena todos os dados
        this.overviewData = results.overview;
        this.productData = results.products;
        this.customerData = results.customers;

        // 2. Desliga o spinner (isso renderiza o HTML)
        this.loading = false;

        // 3. Renderiza o gráfico da primeira aba
        // (Atrasa em 0ms para garantir que o <canvas> exista no DOM)
        setTimeout(() => this.renderSalesChart(), 0);
      },
      error: (err) => {
        console.error('Erro ao carregar relatórios', err);
        this.loading = false;
        // (Adicione um toastr de erro aqui)
      }
    });

    this.subscriptions.add(sub);
  }

  /**
   * Chamado quando o usuário troca de aba.
   * Renderiza o gráfico da aba selecionada (para performance).
   */
  onTabChange(event: MatTabChangeEvent): void {
    // Atraso de 0ms para garantir que a aba esteja visível
    setTimeout(() => {
      if (event.index === 0) { // Aba "Visão Geral"
        this.renderSalesChart();
      } else if (event.index === 2) { // Aba "Clientes"
        this.renderCustomerChart();
      }
      // (Aba 1 "Produtos" não tem gráfico, apenas tabelas)
    }, 0);
  }

  // --- MÉTODOS DE RENDERIZAÇÃO DO CHART.JS ---

  renderSalesChart(): void {
    const ctx = document.getElementById('salesChart') as HTMLCanvasElement;
    if (!ctx || !this.overviewData?.chart) return; // Proteção
    
    // Destrói o gráfico antigo se ele existir (para evitar leaks de memória)
    if (this.salesChart) this.salesChart.destroy(); 

    this.salesChart = new Chart(ctx, {
      type: 'line',
      data: this.overviewData.chart,
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  renderCustomerChart(): void {
    const ctx = document.getElementById('customerChart') as HTMLCanvasElement;
    if (!ctx || !this.customerData?.chart) return; // Proteção

    if (this.customerChart) this.customerChart.destroy();

    this.customerChart = new Chart(ctx, {
      type: 'pie', // Gráfico de Pizza
      data: this.customerData.chart,
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}
