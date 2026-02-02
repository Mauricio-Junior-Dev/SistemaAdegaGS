import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { OrderPollingService } from '../../../core/services/order-polling.service';
import { SettingsService, SystemSettings } from '../../services/settings.service';
import { StoreStatusService } from '../../../core/services/store-status.service';
import { Subscription } from 'rxjs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  template: `
    <mat-sidenav-container class="admin-container">
      <mat-sidenav mode="side" opened class="admin-sidenav">
        <div class="sidenav-header">
          <div class="brand">
            <img *ngIf="settings?.logo_url" 
                 [src]="getLogoUrl(settings?.logo_url)" 
                 alt="Logo" 
                 class="brand-logo">
            <mat-icon *ngIf="!settings?.logo_url">local_bar</mat-icon>
            <span>{{settings?.site_name || 'ADEGA GS'}}</span>
          </div>
          <small>Painel Admin</small>
        </div>

        <nav class="nav">
          <a routerLink="/admin/dashboard" routerLinkActive="active" class="nav-item">
            <mat-icon>dashboard</mat-icon>
            <span>Dashboard</span>
          </a>
          <a routerLink="/admin/produtos" routerLinkActive="active" class="nav-item">
            <mat-icon>inventory_2</mat-icon>
            <span>Produtos</span>
          </a>
          <a routerLink="/admin/combos" routerLinkActive="active" class="nav-item">
            <mat-icon>inventory</mat-icon>
            <span>Combos</span>
          </a>
          <a routerLink="/admin/categorias" routerLinkActive="active" class="nav-item">
            <mat-icon>category</mat-icon>
            <span>Categorias</span>
          </a>
          <a routerLink="/admin/usuarios" routerLinkActive="active" class="nav-item">
            <mat-icon>people</mat-icon>
            <span>Usuários</span>
          </a>
          <a routerLink="/admin/movimentacoes" routerLinkActive="active" class="nav-item">
            <mat-icon>swap_horiz</mat-icon>
            <span>Movimentações</span>
          </a>
          <a routerLink="/admin/caixa" routerLinkActive="active" class="nav-item" matTooltip="Gerenciar Caixa (sessões e transações)">
            <mat-icon>account_balance_wallet</mat-icon>
            <span>Caixa</span>
          </a>
          <a routerLink="/admin/configuracoes" routerLinkActive="active" class="nav-item">
            <mat-icon>settings</mat-icon>
            <span>Configurações</span>
          </a>
          <a routerLink="/admin/delivery-zones" routerLinkActive="active" class="nav-item">
            <mat-icon>local_shipping</mat-icon>
            <span>Zonas de Entrega</span>
          </a>
          <a routerLink="/funcionario/caixa" routerLinkActive="active" class="nav-item" matTooltip="Abrir PDV (Caixa do Funcionário)">
            <mat-icon>point_of_sale</mat-icon>
            <span>Caixa PDV</span>
          </a>
          <a routerLink="/funcionario/pedidos" routerLinkActive="active" class="nav-item" matTooltip="Ver Pedidos do PDV">
            <mat-icon>receipt_long</mat-icon>
            <span>Pedidos PDV</span>
          </a>
        </nav>

        <div class="sidenav-footer">
          <button mat-stroked-button color="warn" (click)="logout()" class="logout-btn">
            <mat-icon>logout</mat-icon>
            Sair
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <span>{{pageTitle}}</span>
          <span class="toolbar-spacer"></span>
          <div class="toolbar-actions">
            <!-- Toggle Impressão Automática (apenas Admin) -->
            <div class="admin-auto-print-toggle">
              <mat-icon>print</mat-icon>
              <span class="status-label">Impressão Auto</span>
              <mat-slide-toggle
                [checked]="adminAutoPrint"
                (change)="toggleAdminAutoPrint($event.checked)"
                color="primary"
                matTooltip="Imprimir automaticamente novos pedidos neste computador">
              </mat-slide-toggle>
            </div>
            <!-- Toggle Status da Loja -->
            <div class="store-status-toggle">
              <mat-icon [class.store-open]="isStoreOpen" [class.store-closed]="!isStoreOpen">
                {{isStoreOpen ? 'store' : 'store_mall_directory'}}
              </mat-icon>
              <span class="status-label">{{isStoreOpen ? 'Loja Aberta' : 'Loja Fechada'}}</span>
              <mat-slide-toggle
                [checked]="isStoreOpen"
                (change)="toggleStoreStatus($event.checked)"
                [disabled]="updatingStoreStatus"
                color="primary">
              </mat-slide-toggle>
            </div>
            <span class="user-info">{{userName}}</span>
          </div>
        </mat-toolbar>

        <div class="admin-content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .admin-container {
      height: 100vh;
      background-color: var(--background);
      margin: 0;
      padding: 0;
    }

    .admin-sidenav {
      width: 280px;
      background: var(--secondary);
      color: #e5e7eb;
    }

    .sidenav-header {
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      letter-spacing: .5px;
    }

    .brand mat-icon { color: var(--primary); }
    .brand span { color: #fff; }
    
    .brand-logo {
      width: 32px;
      height: 32px;
      object-fit: contain;
      margin-right: 8px;
    }

    .nav { display: flex; flex-direction: column; padding: 8px; gap: 4px; }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 44px;
      padding: 0 12px;
      color: #cbd5e1;
      border-radius: 8px;
      text-decoration: none;
      transition: background .2s, color .2s;
    }

    .nav-item mat-icon { color: #9ca3af; }

    .nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
    .nav-item:hover mat-icon { color: #fff; }

    .active { background: var(--primary); color: var(--secondary); }
    .active span { color: var(--secondary); }
    .active mat-icon { color: var(--secondary); }

    .sidenav-footer {
      position: absolute;
      bottom: 0;
      width: 100%;
      padding: 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .logout-btn { width: 100%; justify-content: center; }

    mat-sidenav-content {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
    }

    mat-toolbar {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      width: 100%;
      margin: 0;
      padding: 0 16px;
    }

    .toolbar-spacer {
      flex: 1 1 auto;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .admin-auto-print-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      font-size: 0.85em;
    }

    .admin-auto-print-toggle mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      opacity: 0.9;
    }

    .store-status-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .store-status-toggle mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .store-status-toggle .store-open {
      color: #4caf50;
    }

    .store-status-toggle .store-closed {
      color: #f44336;
    }

    .status-label {
      font-size: 0.9em;
      font-weight: 500;
    }

    .user-info {
      font-size: 0.9em;
      margin-right: 16px;
    }

    .admin-content {
      padding: 20px;
      height: calc(100vh - 64px);
      overflow-y: auto;
      margin: 0;
    }

    /* Removido estilo antigo de ativo que gerava fundo branco */

    mat-nav-list a {
      height: 48px;
    }

    mat-nav-list mat-icon {
      margin-right: 16px;
    }

    /* Garantir maior especificidade para o estado ativo do menu */
    .nav .nav-item.active { background: var(--primary); color: var(--secondary); }
    .nav .nav-item.active mat-icon, .nav .nav-item.active span { color: var(--secondary); }
  `]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  userName = '';
  pageTitle = 'Dashboard';
  settings: SystemSettings | null = null;
  isStoreOpen = true;
  updatingStoreStatus = false;
  adminAutoPrint = false;
  private settingsSubscription?: Subscription;
  private storeStatusSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private orderPollingService: OrderPollingService,
    private settingsService: SettingsService,
    private storeStatusService: StoreStatusService
  ) {
    const user = this.authService.getUser();
    this.userName = user?.name || 'Admin';
  }

  ngOnInit(): void {
    // Carregar preferência de impressão automática do Admin (localStorage)
    this.adminAutoPrint = localStorage.getItem('admin_auto_print') === 'true';

    // Carregar configurações iniciais
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
      },
      error: (error) => {
        console.error('Erro ao carregar configurações:', error);
      }
    });

    // Observar mudanças nas configurações
    this.settingsSubscription = this.settingsService.watchSettings().subscribe(settings => {
      this.settings = settings;
    });

    // Observar status da loja
    this.storeStatusSubscription = this.storeStatusService.status$.subscribe(isOpen => {
      this.isStoreOpen = isOpen;
    });
  }

  ngOnDestroy(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
    if (this.storeStatusSubscription) {
      this.storeStatusSubscription.unsubscribe();
    }
  }

  toggleAdminAutoPrint(enabled: boolean): void {
    this.adminAutoPrint = enabled;
    localStorage.setItem('admin_auto_print', String(enabled));
  }

  toggleStoreStatus(isOpen: boolean): void {
    this.updatingStoreStatus = true;
    this.storeStatusService.updateStoreStatus(isOpen).subscribe({
      next: () => {
        this.isStoreOpen = isOpen;
        this.updatingStoreStatus = false;
      },
      error: (error) => {
        console.error('Erro ao atualizar status da loja:', error);
        this.updatingStoreStatus = false;
        // Reverter o toggle em caso de erro
        this.isStoreOpen = !isOpen;
      }
    });
  }

  getLogoUrl(logoUrl: string | undefined): string {
    if (!logoUrl) return '';
    
    // Se a URL já é completa, retorna como está
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return logoUrl;
    }
    
    // Se é um caminho relativo, adiciona a URL do backend
    if (logoUrl.startsWith('/storage/')) {
      return 'http://localhost:8000' + logoUrl;
    }
    
    return logoUrl;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        // Parar polling de pedidos
        this.orderPollingService.stopPolling();
        this.orderPollingService.clearPrintedCache();
        window.location.href = '/login';
      },
      error: (error) => {
        console.error('Erro ao fazer logout:', error);
        // Parar polling mesmo com erro
        this.orderPollingService.stopPolling();
        this.orderPollingService.clearPrintedCache();
        window.location.href = '/login';
      }
    });
  }
}
