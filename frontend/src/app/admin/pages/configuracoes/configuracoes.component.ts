import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

import { SettingsService, SystemSettings } from '../../services/settings.service';
import { GeneralSettingsComponent } from './tabs/general-settings.component';
// Removidas as abas: Negócio, Pagamentos, Estoque, Pedidos, E-mail
// import { BusinessSettingsComponent } from './tabs/business-settings.component';
// import { PaymentSettingsComponent } from './tabs/payment-settings.component';
// import { StockSettingsComponent } from './tabs/stock-settings.component';
// import { OrderSettingsComponent } from './tabs/order-settings.component';
// import { EmailSettingsComponent } from './tabs/email-settings.component';
import { SecuritySettingsComponent } from './tabs/security-settings.component';
// These components will be implemented later
// import { BackupSettingsComponent } from './tabs/backup-settings.component';
// import { IntegrationSettingsComponent } from './tabs/integration-settings.component';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    GeneralSettingsComponent,
    // Removidas as abas: Negócio, Pagamentos, Estoque, Pedidos, E-mail
    // BusinessSettingsComponent,
    // PaymentSettingsComponent,
    // StockSettingsComponent,
    // OrderSettingsComponent,
    // EmailSettingsComponent,
    SecuritySettingsComponent,
    // These components will be implemented later
    // BackupSettingsComponent,
    // IntegrationSettingsComponent
  ],
  template: `
    <div class="settings-container">
      <h1>Configurações do Sistema</h1>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Carregando configurações...</p>
      </div>

      <!-- Settings Content -->
      <mat-card *ngIf="!loading && settings">
        <mat-card-content>
          <mat-tab-group>
            <mat-tab label="Geral">
              <app-general-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-general-settings>
            </mat-tab>

            <!-- Removidas as abas: Negócio, Pagamentos, Estoque, Pedidos, E-mail -->
            <!-- <mat-tab label="Negócio">
              <app-business-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-business-settings>
            </mat-tab>

            <mat-tab label="Pagamentos">
              <app-payment-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-payment-settings>
            </mat-tab>

            <mat-tab label="Estoque">
              <app-stock-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-stock-settings>
            </mat-tab>

            <mat-tab label="Pedidos">
              <app-order-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-order-settings>
            </mat-tab>

            <mat-tab label="E-mail">
              <app-email-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-email-settings>
            </mat-tab> -->

            <mat-tab label="Segurança">
              <app-security-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-security-settings>
            </mat-tab>

            <!-- These tabs will be implemented later -->
            <!-- <mat-tab label="Backup">
              <app-backup-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-backup-settings>
            </mat-tab>

            <mat-tab label="Integrações">
              <app-integration-settings
                [settings]="settings"
                (settingsChange)="onSettingsChange($event)">
              </app-integration-settings>
            </mat-tab> -->
          </mat-tab-group>
        </mat-card-content>
      </mat-card>

      <!-- Error State -->
      <div *ngIf="!loading && !settings" class="error-container">
        <mat-icon color="warn">error</mat-icon>
        <p>Erro ao carregar configurações</p>
        <button mat-raised-button color="primary" (click)="loadSettings()">
          Tentar Novamente
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 24px;
      background: var(--background);
      min-height: 100vh;
    }

    h1 {
      margin: 0 0 24px;
      font-size: 28px;
      font-weight: 600;
      color: #2c3e50;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }

    .loading-container p,
    .error-container p {
      margin: 16px 0;
      color: #666;
    }

    .error-container mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    /* Card Principal - Estilo Clean */
    mat-card {
      margin-bottom: 20px;
      background: #ffffff !important;
      border-radius: 12px !important;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05) !important;
      border-top: 4px solid var(--primary) !important;
      overflow: hidden;
    }

    mat-card-content {
      background: #ffffff !important;
      padding: 24px !important;
    }

    /* Tabs - Fundo transparente/branco */
    ::ng-deep .mat-mdc-tab-group {
      background: transparent !important;
    }

    ::ng-deep .mat-mdc-tab-header {
      background: transparent !important;
      border-bottom: 1px solid #e0e0e0;
    }

    ::ng-deep .mat-mdc-tab-label {
      background: transparent !important;
      color: #666 !important;
    }

    ::ng-deep .mat-mdc-tab-label-active {
      color: var(--primary) !important;
    }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      padding: 24px 0;
      background: transparent !important;
    }

    ::ng-deep .mat-mdc-tab-body-content {
      background: transparent !important;
    }

    /* Inputs - Garantir legibilidade */
    ::ng-deep .mat-mdc-form-field {
      background: transparent !important;
    }

    ::ng-deep .mat-mdc-text-field-wrapper {
      background: #ffffff !important;
    }

    ::ng-deep .mat-mdc-form-field-input-control {
      color: #333 !important;
    }

    /* Garantir que os campos de texto estejam legíveis */
    ::ng-deep .mdc-text-field--filled:not(.mdc-text-field--disabled) {
      background-color: #ffffff !important;
    }

    ::ng-deep .mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-line-ripple::before {
      border-bottom-color: rgba(0, 0, 0, 0.42) !important;
    }

    ::ng-deep .mdc-text-field--filled:not(.mdc-text-field--disabled):hover .mdc-line-ripple::before {
      border-bottom-color: rgba(0, 0, 0, 0.87) !important;
    }

    ::ng-deep .mdc-text-field--focused:not(.mdc-text-field--disabled) .mdc-line-ripple::after {
      border-bottom-color: var(--primary) !important;
    }

    /* Cards dentro das abas também devem ter fundo branco */
    ::ng-deep .settings-section mat-card {
      background: #ffffff !important;
      border-radius: 12px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
      border-top: 4px solid var(--primary) !important;
    }

    ::ng-deep .settings-section mat-card-content {
      background: #ffffff !important;
    }

    /* Garantir que labels e textos estejam legíveis */
    ::ng-deep .settings-section h2 {
      color: #2c3e50 !important;
    }

    ::ng-deep .settings-section p,
    ::ng-deep .settings-section label {
      color: #333 !important;
    }
  `]
})
export class ConfiguracoesComponent implements OnInit {
  loading = true;
  settings: SystemSettings | null = null;

  constructor(
    private settingsService: SettingsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar configurações:', error);
        this.snackBar.open('Erro ao carregar configurações', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onSettingsChange(settings: Partial<SystemSettings>): void {
    if (!this.settings) return;

    console.log('Updating settings:', settings);
    
    this.settingsService.updateSettings(settings).subscribe({
      next: (updatedSettings) => {
        console.log('Settings updated successfully:', updatedSettings);
        this.settings = updatedSettings;
        this.snackBar.open('Configurações atualizadas com sucesso!', 'Fechar', { duration: 3000 });
      },
      error: (error) => {
        console.error('Erro ao atualizar configurações:', error);
        console.error('Error details:', error);
        this.snackBar.open('Erro ao atualizar configurações', 'Fechar', { duration: 3000 });
      }
    });
  }
}
