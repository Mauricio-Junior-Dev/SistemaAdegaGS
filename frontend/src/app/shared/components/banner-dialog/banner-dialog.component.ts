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
        <!-- Upload de Imagem -->
        <div class="image-upload-section">
          <div class="current-image" 
               [class.has-image]="bannerForm.image_url"
               (click)="imageInput.click()">
            <img *ngIf="bannerForm.image_url" [src]="getImageUrl(bannerForm.image_url)" alt="Preview">
            <div class="overlay">
              <mat-icon>{{ bannerForm.image_url ? 'edit' : 'add_photo_alternate' }}</mat-icon>
              <span>{{ bannerForm.image_url ? 'Alterar Imagem' : 'Adicionar Imagem' }}</span>
            </div>
          </div>
          
          <input #imageInput 
                 type="file" 
                 accept="image/*" 
                 (change)="onImageSelected($event)"
                 style="display: none">
          
          <mat-progress-bar *ngIf="uploading" mode="indeterminate"></mat-progress-bar>
        </div>

        <!-- Formulário -->
        <div class="form-fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Título</mat-label>
            <input matInput 
                   [(ngModel)]="bannerForm.title"
                   placeholder="Ex: Promoção Especial">
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Subtítulo</mat-label>
            <input matInput 
                   [(ngModel)]="bannerForm.subtitle"
                   placeholder="Ex: Descontos imperdíveis para você">
          </mat-form-field>

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
              [disabled]="!bannerForm.image_url || uploading"
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
    title: string;
    subtitle: string;
    link: string;
    image_url: string;
    order: number;
    is_active: boolean;
  } = {
    title: '',
    subtitle: '',
    link: '',
    image_url: '',
    order: 1,
    is_active: true
  };

  uploading = false;
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
        title: this.data.banner.title || '',
        subtitle: this.data.banner.subtitle || '',
        link: this.data.banner.link || '',
        image_url: this.data.banner.image_url || '',
        order: this.data.banner.order || 1,
        is_active: this.data.banner.is_active
      };
    }
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.uploading = true;
      
      this.data.uploadImage(file).subscribe({
        next: (response: any) => {
          this.bannerForm.image_url = response.image_url;
          this.uploading = false;
          this.snackBar.open('Imagem enviada com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (error: any) => {
          console.error('Erro ao fazer upload da imagem:', error);
          this.snackBar.open('Erro ao fazer upload da imagem', 'Fechar', { duration: 3000 });
          this.uploading = false;
        }
      });
    }
  }

  getImageUrl(imageUrl: string): string {
    if (!imageUrl) return '';
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    if (imageUrl.startsWith('/storage/')) {
      return 'http://localhost:8000' + imageUrl;
    }
    
    if (imageUrl.startsWith('storage/')) {
      return 'http://localhost:8000/' + imageUrl;
    }
    
    return 'http://localhost:8000/storage/' + imageUrl;
  }

  saveBanner(): void {
    if (!this.bannerForm.image_url) {
      this.snackBar.open('Por favor, selecione uma imagem', 'Fechar', { duration: 3000 });
      return;
    }

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
