import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CategoryService, Category, CreateCategoryDTO } from '../../../services/category.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{isEdit ? 'Editar' : 'Nova'}} Categoria</h2>
    
    <form [formGroup]="categoryForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content>
        <div class="form-container">
          <!-- Imagem -->
          <div class="image-upload">
            <div class="preview" 
                 [class.has-image]="imagePreview"
                 (click)="fileInput.click()">
              <img *ngIf="imagePreview" [src]="resolvePreview(imagePreview)" alt="Preview">
              <mat-icon *ngIf="!imagePreview">add_photo_alternate</mat-icon>
              <div class="overlay">
                <mat-icon>edit</mat-icon>
              </div>
            </div>
            <input #fileInput type="file" 
                   accept="image/*" 
                   (change)="onImageSelected($event)"
                   style="display: none">
            <button *ngIf="imagePreview" 
                    type="button"
                    mat-icon-button 
                    color="warn"
                    (click)="removeImage()">
              <mat-icon>delete</mat-icon>
            </button>
          </div>

          <!-- Informações Básicas -->
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Nome</mat-label>
              <input matInput formControlName="name" required>
              <mat-error *ngIf="categoryForm.get('name')?.hasError('required')">
                Nome é obrigatório
              </mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Descrição</mat-label>
            <textarea matInput formControlName="description" rows="3"></textarea>
          </mat-form-field>

          <!-- Status -->
          <div class="form-row status-row">
            <mat-slide-toggle formControlName="is_active" color="primary">
              Categoria Ativa
            </mat-slide-toggle>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button type="button" 
                mat-button 
                [disabled]="loading"
                (click)="dialogRef.close()">
          Cancelar
        </button>
        <button type="submit"
                mat-raised-button
                color="primary"
                [disabled]="loading">
          <mat-icon *ngIf="loading">
            <mat-spinner diameter="20"></mat-spinner>
          </mat-icon>
          <span *ngIf="!loading">{{isEdit ? 'Salvar' : 'Criar'}}</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row > * {
      flex: 1;
    }

    .status-row {
      margin-top: 8px;
    }

    .image-upload {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .preview {
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

    .preview.has-image {
      border-style: solid;
    }

    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .preview .overlay {
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

    .preview:hover .overlay {
      opacity: 1;
    }

    .preview .overlay mat-icon {
      color: white;
    }

    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .preview {
        width: 100px;
        height: 100px;
      }
    }
  `]
})
export class CategoryFormDialogComponent implements OnInit {
  categoryForm: FormGroup;
  categories: Category[] = [];
  loading = false;
  isEdit = false;
  imagePreview: string | null = null;
  imageFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<CategoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category?: Category }
  ) {
    this.isEdit = !!data.category;
    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      parent_id: [null],
      is_active: [true]
    });

    if (this.isEdit) {
      if (data.category) {
        this.categoryForm.patchValue(data.category);
        this.imagePreview = data.category.image_url || null;
      }
    }
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        // Filtrar a categoria atual e seus filhos para evitar ciclos
        if (this.isEdit) {
          this.categories = categories.filter(cat => 
            cat.id !== this.data.category!.id && 
            !this.isChildCategory(cat, this.data.category!.id)
          );
        } else {
          this.categories = categories;
        }
      },
      error: (error) => {
        console.error('Erro ao carregar categorias:', error);
        this.snackBar.open('Erro ao carregar categorias', 'Fechar', { duration: 3000 });
      }
    });
  }

  private isChildCategory(category: Category, parentId: number): boolean {
    if (!category.parent_id) return false;
    if (category.parent_id === parentId) return true;
    const parent = this.categories.find(cat => cat.id === category.parent_id);
    return parent ? this.isChildCategory(parent, parentId) : false;
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imageFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.imageFile = null;
    this.imagePreview = null;
    if (this.isEdit && this.data.category?.image_url) {
      this.categoryService.deleteImage(this.data.category?.id || 0).subscribe();
    }
  }

  onSubmit(): void {
    this.categoryForm.markAllAsTouched();
    if (!this.categoryForm.valid) {
      this.snackBar.open('Verifique os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }
    this.loading = true;
    const raw = this.categoryForm.value;
      const categoryData: CreateCategoryDTO = {
        name: raw.name,
        description: raw.description || undefined,
        parent_id: (raw.parent_id === null || raw.parent_id === undefined || raw.parent_id === '')
          ? undefined
          : Number(raw.parent_id),
        is_active: !!raw.is_active
      };

      if (this.imageFile) {
        categoryData.image = this.imageFile;
      }

      const request = this.isEdit
        ? this.categoryService.updateCategory({ id: this.data.category!.id, ...categoryData })
        : this.categoryService.createCategory(categoryData);

      request.subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Erro ao salvar categoria:', error);
          const backendMsg = error?.error?.message;
          const validation = error?.error?.errors;
          let msg = 'Erro ao salvar categoria';
          if (backendMsg) msg = backendMsg;
          if (validation) {
            const first = Object.values(validation)[0] as string[];
            if (first && first.length) msg = first[0];
          }
          this.snackBar.open(msg, 'Fechar', { duration: 4000 });
          this.loading = false;
        }
      });
  }

  resolvePreview(previewUrl: string): string {
    if (!previewUrl) return '';
    // data URL (arquivo selecionado)
    if (previewUrl.startsWith('data:')) return previewUrl;
    // URL absoluta
    if (previewUrl.startsWith('http://') || previewUrl.startsWith('https://')) return previewUrl;
    // Caminho do storage gerado pelo backend
    if (previewUrl.startsWith('/storage/') || previewUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = previewUrl.startsWith('/') ? previewUrl : `/${previewUrl}`;
      return `${base}${path}`;
    }
    // Fallback
    return previewUrl;
  }
}
