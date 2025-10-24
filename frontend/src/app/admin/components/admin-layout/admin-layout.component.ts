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
import { SettingsService, SystemSettings } from '../../services/settings.service';
import { Subscription } from 'rxjs';

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
    MatTooltipModule
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
          <a routerLink="/admin/relatorios" routerLinkActive="active" class="nav-item">
            <mat-icon>assessment</mat-icon>
            <span>Relatórios</span>
          </a>
          <a routerLink="/admin/configuracoes" routerLinkActive="active" class="nav-item">
            <mat-icon>settings</mat-icon>
            <span>Configurações</span>
          </a>
          <a routerLink="/admin/delivery-zones" routerLinkActive="active" class="nav-item">
            <mat-icon>local_shipping</mat-icon>
            <span>Zonas de Entrega</span>
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
          <span class="user-info">{{userName}}</span>
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
      background-color: #f5f5f5;
    }

    .admin-sidenav {
      width: 280px;
      background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
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

    .brand mat-icon { color: #60a5fa; }
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

    .active { background: #3498db; color: #ffffff; }
    .active span { color: #ffffff; }
    .active mat-icon { color: #ffffff; }

    .sidenav-footer {
      position: absolute;
      bottom: 0;
      width: 100%;
      padding: 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .logout-btn { width: 100%; justify-content: center; }

    mat-toolbar {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .toolbar-spacer {
      flex: 1 1 auto;
    }

    .user-info {
      font-size: 0.9em;
      margin-right: 16px;
    }

    .admin-content {
      padding: 20px;
      height: calc(100vh - 64px);
      overflow-y: auto;
    }

    /* Removido estilo antigo de ativo que gerava fundo branco */

    mat-nav-list a {
      height: 48px;
    }

    mat-nav-list mat-icon {
      margin-right: 16px;
    }

    /* Garantir maior especificidade para o estado ativo do menu */
    .nav .nav-item.active { background: #3498db; color: #ffffff; }
    .nav .nav-item.active mat-icon, .nav .nav-item.active span { color: #ffffff; }
  `]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  userName = '';
  pageTitle = 'Dashboard';
  settings: SystemSettings | null = null;
  private settingsSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService
  ) {
    const user = this.authService.getUser();
    this.userName = user?.name || 'Admin';
  }

  ngOnInit(): void {
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
  }

  ngOnDestroy(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
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
        window.location.href = '/login';
      },
      error: (error) => {
        console.error('Erro ao fazer logout:', error);
        window.location.href = '/login';
      }
    });
  }
}
