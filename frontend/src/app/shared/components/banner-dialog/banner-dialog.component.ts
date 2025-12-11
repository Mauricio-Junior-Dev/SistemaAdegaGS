import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Banner, CreateBannerRequest, UpdateBannerRequest } from '../../../core/services/banner.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-banner-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Editar Banner' : 'Adicionar Banner' }}</h2>
    
    <mat-dialog-content>
      <div class="banner-form">
        <!-- Upload de Imagem Desktop -->
        <div class="image-upload-section">
          <label class="image-label">Imagem Desktop</label>
          <div class="current-image" 
               [class.has-image]="bannerForm.desktop_image"
               (click)="desktopInput.click()">
            <img *ngIf="bannerForm.desktop_image" [src]="getImageUrl(bannerForm.desktop_image)" alt="Preview Desktop">
            <div class="overlay">
              <mat-icon>{{ bannerForm.desktop_image ? 'edit' : 'add_photo_alternate' }}</mat-icon>
              <span>{{ bannerForm.desktop_image ? 'Alterar Imagem Desktop' : 'Adicionar Imagem Desktop' }}</span>
            </div>
          </div>
          
          <input #desktopInput 
                 type="file" 
                 accept="image/*" 
                 (change)="onDesktopImageSelected($event)"
                 style="display: none">
          
          <mat-progress-bar *ngIf="uploadingDesktop" mode="indeterminate"></mat-progress-bar>
        </div>

        <!-- Upload de Imagem Mobile -->
        <div class="image-upload-section">
          <label class="image-label">Imagem Mobile</label>
          <div class="current-image" 
               [class.has-image]="bannerForm.mobile_image"
               (click)="mobileInput.click()">
            <img *ngIf="bannerForm.mobile_image" [src]="getImageUrl(bannerForm.mobile_image)" alt="Preview Mobile">
            <div class="overlay">
              <mat-icon>{{ bannerForm.mobile_image ? 'edit' : 'add_photo_alternate' }}</mat-icon>
              <span>{{ bannerForm.mobile_image ? 'Alterar Imagem Mobile' : 'Adicionar Imagem Mobile' }}</span>
            </div>
          </div>
          
          <input #mobileInput 
                 type="file" 
                 accept="image/*" 
                 (change)="onMobileImageSelected($event)"
                 style="display: none">
          
          <mat-progress-bar *ngIf="uploadingMobile" mode="indeterminate"></mat-progress-bar>
        </div>

        <!-- Formulário -->
        <div class="form-fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Link (opcional)</mat-label>
            <input matInput 
                   [(ngModel)]="bannerForm.link"
                   placeholder="Ex: /produtos ou https://exemplo.com">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Ordem de Exibição</mat-label>
            <input matInput 
                   type="number"
                   [(ngModel)]="bannerForm.order"
                   min="1">
          </mat-form-field>

          <div class="checkbox-container">
            <mat-checkbox [(ngModel)]="bannerForm.is_active">
              Banner Ativo
            </mat-checkbox>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
              <button mat-raised-button 
              color="primary"
              [disabled]="!bannerForm.desktop_image || uploadingDesktop || uploadingMobile"
              (click)="saveBanner()">
        {{ isEdit ? 'Salvar' : 'Adicionar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .banner-form {
      min-width: 500px;
    }

    .image-upload-section {
      margin-bottom: 24px;
    }

    .image-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #555;
    }

    .current-image {
      width: 100%;
      height: 200px;
      border: 2px dashed #ccc;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      background-color: #f9f9f9;
    }

    .current-image.has-image {
      border-style: solid;
      border-color: #4caf50;
    }

    .current-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      color: white;
    }

    .current-image:hover .overlay {
      opacity: 1;
    }

    .overlay mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      margin-bottom: 8px;
    }

    .overlay span {
      font-size: 14px;
      font-weight: 500;
    }

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .checkbox-container {
      margin-top: 8px;
    }

    mat-progress-bar {
      margin-top: 8px;
    }

    @media (max-width: 600px) {
      .banner-form {
        min-width: 300px;
      }

      .current-image {
        height: 150px;
      }
    }
  `]
})
export class BannerDialogComponent implements OnInit {
  bannerForm: {
    link: string;
    desktop_image: string;
    mobile_image: string;
    order: number;
    is_active: boolean;
  } = {
    link: '',
    desktop_image: '',
    mobile_image: '',
    order: 1,
    is_active: true
  };

  uploadingDesktop = false;
  uploadingMobile = false;
  isEdit = false;

  constructor(
    public dialogRef: MatDialogRef<BannerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      banner?: Banner;
      uploadImage: (file: File) => any;
      createBanner: (banner: CreateBannerRequest) => any;
      updateBanner: (banner: UpdateBannerRequest) => any;
    },
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.data.banner) {
      this.isEdit = true;
      this.bannerForm = {
        link: this.data.banner.link || '',
        desktop_image: this.data.banner.desktop_image || '',
        mobile_image: this.data.banner.mobile_image || '',
        order: this.data.banner.order || 1,
        is_active: this.data.banner.is_active
      };
    }
  }

  onDesktopImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.uploadingDesktop = true;
      
      this.data.uploadImage(file).subscribe({
        next: (response: any) => {
          this.bannerForm.desktop_image = response.image_url || response.desktop_image || '';
          this.uploadingDesktop = false;
          this.snackBar.open('Imagem Desktop enviada com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (error: any) => {
          console.error('Erro ao fazer upload da imagem:', error);
          this.snackBar.open('Erro ao fazer upload da imagem Desktop', 'Fechar', { duration: 3000 });
          this.uploadingDesktop = false;
        }
      });
    }
  }

  onMobileImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.uploadingMobile = true;
      
      this.data.uploadImage(file).subscribe({
        next: (response: any) => {
          this.bannerForm.mobile_image = response.image_url || response.mobile_image || '';
          this.uploadingMobile = false;
          this.snackBar.open('Imagem Mobile enviada com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (error: any) => {
          console.error('Erro ao fazer upload da imagem:', error);
          this.snackBar.open('Erro ao fazer upload da imagem Mobile', 'Fechar', { duration: 3000 });
          this.uploadingMobile = false;
        }
      });
    }
  }

  getImageUrl(imageUrl: string): string {
    if (!imageUrl) return '';
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    
    if (imageUrl.startsWith('/storage/')) {
      return baseUrl + imageUrl;
    }
    
    if (imageUrl.startsWith('storage/')) {
      return baseUrl + '/' + imageUrl;
    }
    
    return baseUrl + '/storage/' + imageUrl;
  }

  saveBanner(): void {
    if (!this.bannerForm.desktop_image) {
      this.snackBar.open('Por favor, selecione a imagem Desktop', 'Fechar', { duration: 3000 });
      return;
    }

    // Se não houver imagem mobile, deixa para o backend fazer o fallback (mobile = desktop)

    if (this.isEdit && this.data.banner) {
      const updateData: UpdateBannerRequest = {
        id: this.data.banner.id,
        ...this.bannerForm
      };

      this.data.updateBanner(updateData).subscribe({
        next: (banner: any) => {
          this.snackBar.open('Banner atualizado com sucesso!', 'Fechar', { duration: 3000 });
          this.dialogRef.close(banner);
        },
        error: (error: any) => {
          console.error('Erro ao atualizar banner:', error);
          this.snackBar.open('Erro ao atualizar banner', 'Fechar', { duration: 3000 });
        }
      });
    } else {
      const createData: CreateBannerRequest = {
        ...this.bannerForm
      };

      this.data.createBanner(createData).subscribe({
        next: (banner: any) => {
          this.snackBar.open('Banner criado com sucesso!', 'Fechar', { duration: 3000 });
          this.dialogRef.close(banner);
        },
        error: (error: any) => {
          console.error('Erro ao criar banner:', error);
          this.snackBar.open('Erro ao criar banner', 'Fechar', { duration: 3000 });
        }
      });
    }
  }
}
