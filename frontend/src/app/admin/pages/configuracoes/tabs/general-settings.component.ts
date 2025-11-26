import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { SystemSettings, SettingsService } from '../../../services/settings.service';
import { BannerService, Banner } from '../../../../core/services/banner.service';
import { BannerDialogComponent } from '../../../../shared/components/banner-dialog/banner-dialog.component';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule
  ],
  template: `
    <div class="settings-section">
      <h2>Informações do Site</h2>

      <!-- Logo -->
      <div class="logo-section">
        <div class="current-logo" 
             [class.has-logo]="settings.logo_url"
             (click)="logoInput.click()">
          <img *ngIf="settings.logo_url" [src]="getLogoUrl(settings.logo_url)" alt="Logo">
          <mat-icon *ngIf="!settings.logo_url">image</mat-icon>
          <div class="overlay">
            <mat-icon>edit</mat-icon>
          </div>
        </div>
        <input #logoInput 
               type="file" 
               accept="image/*" 
               (change)="onLogoSelected($event)"
               style="display: none">
        
        <div class="logo-actions" *ngIf="settings.logo_url">
          <button mat-icon-button 
                  color="warn" 
                  (click)="removeLogo()"
                  matTooltip="Remover Logo">
            <mat-icon>delete</mat-icon>
          </button>
        </div>

        <mat-progress-bar *ngIf="uploading"
                         mode="indeterminate">
        </mat-progress-bar>
      </div>

      <!-- Favicon -->
      <div class="favicon-section">
        <div class="current-favicon"
             [class.has-favicon]="settings.favicon_url"
             (click)="faviconInput.click()">
          <img *ngIf="settings.favicon_url" [src]="getFaviconUrl(settings.favicon_url)" alt="Favicon">
          <mat-icon *ngIf="!settings.favicon_url">favicon</mat-icon>
          <div class="overlay">
            <mat-icon>edit</mat-icon>
          </div>
        </div>
        <input #faviconInput 
               type="file" 
               accept="image/x-icon,image/png" 
               (change)="onFaviconSelected($event)"
               style="display: none">
        
        <div class="favicon-actions" *ngIf="settings.favicon_url">
          <button mat-icon-button 
                  color="warn" 
                  (click)="removeFavicon()"
                  matTooltip="Remover Favicon">
            <mat-icon>delete</mat-icon>
          </button>
        </div>

        <mat-progress-bar *ngIf="uploadingFavicon"
                         mode="indeterminate">
        </mat-progress-bar>
      </div>

      <!-- Informações Básicas -->
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Nome do Site</mat-label>
          <input matInput 
                 [(ngModel)]="settings.site_name"
                 (ngModelChange)="onFieldChange()">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descrição</mat-label>
          <textarea matInput 
                    [(ngModel)]="settings.site_description"
                    (ngModelChange)="onFieldChange()"
                    rows="3">
          </textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>E-mail de Contato</mat-label>
          <input matInput 
                 type="email"
                 [(ngModel)]="settings.contact_email"
                 (ngModelChange)="onFieldChange()">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Telefone de Contato</mat-label>
          <input matInput 
                 [(ngModel)]="settings.contact_phone"
                 (ngModelChange)="onFieldChange()">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Endereço</mat-label>
          <textarea matInput 
                    [(ngModel)]="settings.address"
                    (ngModelChange)="onFieldChange()"
                    rows="3">
          </textarea>
        </mat-form-field>
      </div>

      <h2>SEO</h2>
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Meta Keywords</mat-label>
          <textarea matInput 
                    [(ngModel)]="settings.meta_keywords"
                    (ngModelChange)="onFieldChange()"
                    rows="3"
                    placeholder="Palavras-chave separadas por vírgula">
          </textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Meta Description</mat-label>
          <textarea matInput 
                    [(ngModel)]="settings.meta_description"
                    (ngModelChange)="onFieldChange()"
                    rows="3">
          </textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>ID do Google Analytics</mat-label>
          <input matInput 
                 [(ngModel)]="settings.google_analytics_id"
                 (ngModelChange)="onFieldChange()">
        </mat-form-field>
      </div>

      <h2>Banners do Carrossel</h2>
      <div class="banners-section">
        <div class="banners-header">
          <p>Gerencie os banners que aparecem no carrossel da página inicial</p>
          <button mat-raised-button color="primary" (click)="addBanner()">
            <mat-icon>add</mat-icon>
            Adicionar Banner
          </button>
        </div>

        <div class="banners-grid" *ngIf="banners.length > 0">
          <mat-card *ngFor="let banner of banners; let i = index" class="banner-card">
            <div class="banner-image">
              <img [src]="getBannerImageUrl(banner)" [alt]="banner.title || 'Banner'">
              <div class="banner-overlay">
                <mat-chip [class]="banner.is_active ? 'status-active' : 'status-inactive'">
                  {{ banner.is_active ? 'Ativo' : 'Inativo' }}
                </mat-chip>
              </div>
            </div>
            
            <mat-card-content>
              <h3>{{ banner.title || 'Sem título' }}</h3>
              <p *ngIf="banner.subtitle">{{ banner.subtitle }}</p>
              <p class="banner-order">Ordem: {{ banner.order }}</p>
            </mat-card-content>
            
            <mat-card-actions>
              <button mat-icon-button (click)="editBanner(banner)" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteBanner(banner)" matTooltip="Excluir">
                <mat-icon>delete</mat-icon>
              </button>
              <button mat-icon-button (click)="moveBanner(i, 'up')" [disabled]="i === 0" matTooltip="Mover para cima">
                <mat-icon>keyboard_arrow_up</mat-icon>
              </button>
              <button mat-icon-button (click)="moveBanner(i, 'down')" [disabled]="i === banners.length - 1" matTooltip="Mover para baixo">
                <mat-icon>keyboard_arrow_down</mat-icon>
              </button>
            </mat-card-actions>
          </mat-card>
        </div>

        <div *ngIf="banners.length === 0" class="no-banners">
          <mat-icon>image</mat-icon>
          <p>Nenhum banner cadastrado</p>
          <button mat-raised-button color="primary" (click)="addBanner()">
            Adicionar Primeiro Banner
          </button>
        </div>
      </div>

      <div class="actions">
        <button mat-raised-button
                color="primary"
                [disabled]="!hasChanges"
                (click)="saveChanges()">
          Salvar Alterações
        </button>

        <button mat-stroked-button
                [disabled]="!hasChanges"
                (click)="resetChanges()">
          Cancelar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-section {
      padding: 20px 0;
    }

    h2 {
      margin: 0 0 20px;
      font-size: 18px;
      color: #333;
    }

    .logo-section,
    .favicon-section {
      margin-bottom: 24px;
    }

    .current-logo,
    .current-favicon {
      width: 150px;
      height: 150px;
      border: 2px dashed #ccc;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .current-favicon {
      width: 64px;
      height: 64px;
    }

    .current-logo.has-logo,
    .current-favicon.has-favicon {
      border-style: solid;
    }

    .current-logo img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .current-favicon img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .current-logo mat-icon,
    .current-favicon mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #ccc;
    }

    .current-favicon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .current-logo:hover .overlay,
    .current-favicon:hover .overlay {
      opacity: 1;
    }

    .overlay mat-icon {
      color: white;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .logo-actions,
    .favicon-actions {
      margin-top: 8px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .actions {
      display: flex;
      gap: 16px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    mat-progress-bar {
      margin-top: 8px;
    }

    /* Banners Section */
    .banners-section {
      margin-bottom: 32px;
    }

    .banners-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .banners-header p {
      color: #666;
      margin: 0;
    }

    .banners-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .banner-card {
      position: relative;
    }

    .banner-image {
      position: relative;
      height: 150px;
      overflow: hidden;
    }

    .banner-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .banner-overlay {
      position: absolute;
      top: 10px;
      right: 10px;
    }

    .status-active {
      background-color: #4caf50;
      color: white;
    }

    .status-inactive {
      background-color: #f44336;
      color: white;
    }

    .banner-order {
      font-size: 0.9rem;
      color: #666;
      margin: 8px 0 0 0;
    }

    .no-banners {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .no-banners mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .banners-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .banners-grid {
        grid-template-columns: 1fr;
      }

      .actions {
        flex-direction: column;
      }

      .actions button {
        width: 100%;
      }
    }
  `]
})
export class GeneralSettingsComponent implements OnInit {
  @Input() settings!: SystemSettings;
  @Output() settingsChange = new EventEmitter<Partial<SystemSettings>>();

  uploading = false;
  uploadingFavicon = false;
  hasChanges = false;
  banners: Banner[] = [];
  loadingBanners = false;
  private originalSettings: Partial<SystemSettings> = {};

  constructor(
    private settingsService: SettingsService,
    private bannerService: BannerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.originalSettings = { ...this.settings };
    this.loadBanners();
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.uploading = true;
      this.settingsService.uploadLogo(file).subscribe({
        next: (response) => {
          this.settings.logo_url = response.logo_url;
          this.settingsChange.emit({ logo_url: response.logo_url });
          this.uploading = false;
        },
        error: (error) => {
          console.error('Erro ao fazer upload do logo:', error);
          this.snackBar.open('Erro ao fazer upload do logo', 'Fechar', { duration: 3000 });
          this.uploading = false;
        }
      });
    }
  }

  onFaviconSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.uploadingFavicon = true;
      this.settingsService.uploadFavicon(file).subscribe({
        next: (response) => {
          this.settings.favicon_url = response.favicon_url;
          this.settingsChange.emit({ favicon_url: response.favicon_url });
          this.uploadingFavicon = false;
        },
        error: (error) => {
          console.error('Erro ao fazer upload do favicon:', error);
          this.snackBar.open('Erro ao fazer upload do favicon', 'Fechar', { duration: 3000 });
          this.uploadingFavicon = false;
        }
      });
    }
  }

  removeLogo(): void {
    if (confirm('Tem certeza que deseja remover o logo?')) {
      this.settings.logo_url = undefined;
      this.settingsChange.emit({ logo_url: undefined });
    }
  }

  removeFavicon(): void {
    if (confirm('Tem certeza que deseja remover o favicon?')) {
      this.settings.favicon_url = undefined;
      this.settingsChange.emit({ favicon_url: undefined });
    }
  }

  onFieldChange(): void {
    this.hasChanges = !this.isEqual(this.settings, this.originalSettings);
    console.log('Field changed, hasChanges:', this.hasChanges);
  }

  saveChanges(): void {
    const changes: Partial<SystemSettings> = this.getChanges();
    console.log('Saving changes:', changes);
    this.settingsChange.emit(changes);
    this.originalSettings = { ...this.settings };
    this.hasChanges = false;
  }

  resetChanges(): void {
    Object.assign(this.settings, this.originalSettings);
    this.hasChanges = false;
  }

  private isEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  private getChanges(): Partial<SystemSettings> {
    const changes: Partial<SystemSettings> = {};
    Object.keys(this.settings).forEach(key => {
      if (this.settings[key] !== this.originalSettings[key]) {
        changes[key] = this.settings[key];
      }
    });
    
    // Log para debug
    console.log('Changes to be sent:', changes);
    console.log('Current settings:', this.settings);
    console.log('Original settings:', this.originalSettings);
    
    return changes;
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

  getFaviconUrl(faviconUrl: string | undefined): string {
    if (!faviconUrl) return '';
    
    // Se a URL já é completa, retorna como está
    if (faviconUrl.startsWith('http://') || faviconUrl.startsWith('https://')) {
      return faviconUrl;
    }
    
    // Se é um caminho relativo, adiciona a URL do backend
    if (faviconUrl.startsWith('/storage/')) {
      return 'http://localhost:8000' + faviconUrl;
    }
    
    return faviconUrl;
  }

  // Banner Management Methods
  loadBanners(): void {
    this.loadingBanners = true;
    this.bannerService.getAllBanners().subscribe({
      next: (banners: Banner[]) => {
        this.banners = banners.sort((a: Banner, b: Banner) => a.order - b.order);
        this.loadingBanners = false;
      },
      error: (error: any) => {
        console.error('Erro ao carregar banners:', error);
        this.snackBar.open('Erro ao carregar banners', 'Fechar', { duration: 3000 });
        this.loadingBanners = false;
      }
    });
  }

  getBannerImageUrl(banner: Banner): string {
    const imageUrl = banner.desktop_image || banner.mobile_image || '';
    if (!imageUrl) return '';
    
    // Se a URL já é completa, retorna como está
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // Se é um caminho relativo, adiciona a URL do backend
    if (imageUrl.startsWith('/storage/')) {
      return 'http://localhost:8000' + imageUrl;
    }
    
    // Se começa com storage/, adiciona a URL base
    if (imageUrl.startsWith('storage/')) {
      return 'http://localhost:8000/' + imageUrl;
    }
    
    // Se não tem prefixo, adiciona storage/
    return 'http://localhost:8000/storage/' + imageUrl;
  }

  addBanner(): void {
    const dialogRef = this.dialog.open(BannerDialogComponent, {
      width: '600px',
      data: {
        uploadImage: (file: File) => this.bannerService.uploadBannerImage(file),
        createBanner: (banner: any) => this.bannerService.createBanner(banner),
        updateBanner: (banner: any) => this.bannerService.updateBanner(banner)
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadBanners();
      }
    });
  }

  editBanner(banner: Banner): void {
    const dialogRef = this.dialog.open(BannerDialogComponent, {
      width: '600px',
      data: {
        banner,
        uploadImage: (file: File) => this.bannerService.uploadBannerImage(file),
        createBanner: (banner: any) => this.bannerService.createBanner(banner),
        updateBanner: (banner: any) => this.bannerService.updateBanner(banner)
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadBanners();
      }
    });
  }

  deleteBanner(banner: Banner): void {
    if (confirm(`Tem certeza que deseja excluir o banner "${banner.title || 'Sem título'}"?`)) {
      this.bannerService.deleteBanner(banner.id).subscribe({
        next: () => {
          this.snackBar.open('Banner excluído com sucesso', 'Fechar', { duration: 3000 });
          this.loadBanners();
        },
        error: (error: any) => {
          console.error('Erro ao excluir banner:', error);
          this.snackBar.open('Erro ao excluir banner', 'Fechar', { duration: 3000 });
        }
      });
    }
  }

  moveBanner(index: number, direction: 'up' | 'down'): void {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.banners.length) return;

    // Troca as posições no array
    const banner = this.banners[index];
    this.banners[index] = this.banners[newIndex];
    this.banners[newIndex] = banner;

    // Atualiza a ordem no backend
    const bannerIds = this.banners.map(b => b.id);
    this.bannerService.reorderBanners(bannerIds).subscribe({
      next: () => {
        this.snackBar.open('Ordem dos banners atualizada', 'Fechar', { duration: 3000 });
      },
      error: (error: any) => {
        console.error('Erro ao reordenar banners:', error);
        this.snackBar.open('Erro ao reordenar banners', 'Fechar', { duration: 3000 });
        // Reverte a mudança em caso de erro
        this.loadBanners();
      }
    });
  }
}
