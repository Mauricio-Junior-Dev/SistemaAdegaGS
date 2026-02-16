import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';

import { ProductService, Product, CreateProductDTO } from '../../../services/product.service';
import { CategoryService, Category } from '../../../services/category.service';
import { CategoryFormDialogComponent } from '../../categorias/dialogs/category-form-dialog.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-product-form-dialog',
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
    MatSnackBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatAutocompleteModule
  ],
  template: `
    <h2 mat-dialog-title>{{isEdit ? 'Editar' : 'Novo'}} Produto</h2>
    
    <form [formGroup]="productForm" (ngSubmit)="onSubmit()">
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
              <mat-error *ngIf="productForm.get('name')?.hasError('required')">
                Nome é obrigatório
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoria</mat-label>
              <input matInput
                     [matAutocomplete]="categoryAuto"
                     [formControl]="categoryFilterCtrl"
                     placeholder="Digite para buscar (ex: whi para Whisk)">
              <button
                mat-icon-button
                matSuffix
                type="button"
                matTooltip="Nova Categoria"
                (click)="openNewCategoryDialog($event)">
                <mat-icon>add</mat-icon>
              </button>
              <mat-autocomplete #categoryAuto="matAutocomplete"
                               (optionSelected)="onCategorySelected($event)">
                <mat-option *ngFor="let category of filteredCategories$ | async" [value]="category">
                  {{ category.name }}
                </mat-option>
              </mat-autocomplete>
              <mat-error *ngIf="productForm.get('category_id')?.hasError('required')">
                Categoria é obrigatória
              </mat-error>
            </mat-form-field>
          </div>

          <!-- Código de Barras -->
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Código de Barras</mat-label>
              <input matInput formControlName="barcode">
              <mat-error *ngIf="productForm.get('barcode')?.hasError('barcodeExists')">
                Código de barras já existe
              </mat-error>
            </mat-form-field>

            <!-- Preço de Venda (Essencial - sempre visível) -->
            <mat-form-field appearance="outline">
              <mat-label>
                <span class="label-with-help">
                  Preço de Venda (Final)
                  <mat-icon matTooltip="Este é o preço padrão cobrado no Balcão para retirada. Se não houver preço de entrega definido, este valor também será usado no site." 
                            matTooltipPosition="above"
                            class="help-icon">help_outline</mat-icon>
                </span>
              </mat-label>
              <input matInput 
                     type="number" 
                     formControlName="price" 
                     required
                     min="0"
                     step="0.01">
              <span matPrefix>R$&nbsp;</span>
              <mat-hint>Valor que o cliente pagará</mat-hint>
              <mat-error *ngIf="productForm.get('price')?.hasError('required')">
                Preço é obrigatório
              </mat-error>
              <mat-error *ngIf="productForm.get('price')?.hasError('min')">
                Preço deve ser maior que zero
              </mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Descrição</mat-label>
            <textarea matInput formControlName="description" rows="3"></textarea>
          </mat-form-field>

          <!-- Estoque -->
          <div class="form-row">
            <mat-form-field *ngIf="!productForm.get('is_pack')?.value" appearance="outline">
              <mat-label>Quantidade em Estoque</mat-label>
              <input matInput 
                     type="number" 
                     formControlName="current_stock" 
                     required
                     min="0">
              <mat-error *ngIf="productForm.get('current_stock')?.hasError('required')">
                Quantidade é obrigatória
              </mat-error>
              <mat-error *ngIf="productForm.get('current_stock')?.hasError('min')">
                Quantidade não pode ser negativa
              </mat-error>
            </mat-form-field>

            <mat-form-field *ngIf="!productForm.get('is_pack')?.value" appearance="outline">
              <mat-label>Estoque Mínimo</mat-label>
              <input matInput 
                     type="number" 
                     formControlName="min_stock" 
                     required
                     min="0">
              <mat-error *ngIf="productForm.get('min_stock')?.hasError('required')">
                Estoque mínimo é obrigatório
              </mat-error>
              <mat-error *ngIf="productForm.get('min_stock')?.hasError('min')">
                Estoque mínimo não pode ser negativo
              </mat-error>
            </mat-form-field>
          </div>

          <!-- Painel de Configurações Avançadas -->
          <mat-expansion-panel #advancedPanel [expanded]="false" class="advanced-settings-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                ⚙️ Configurações Avançadas
              </mat-panel-title>
              <mat-panel-description>
                Preços de entrega, custos, packs e doses
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="advanced-settings-content">
              <!-- Precificação Extra -->
              <div class="advanced-section">
                <h4 class="section-title">Precificação Extra</h4>
                <div class="form-row">
                  <mat-form-field appearance="outline">
                    <mat-label>
                      <span class="label-with-help">
                        Preço para Entrega (Opcional)
                        <mat-icon matTooltip="Opcional. Preencha APENAS se o valor para entrega/site for mais caro que o balcão (Ex: Água, Gás). O site mostrará este valor automaticamente." 
                                  matTooltipPosition="above"
                                  class="help-icon">help_outline</mat-icon>
                      </span>
                    </mat-label>
                    <input matInput 
                           type="number" 
                           formControlName="delivery_price" 
                           min="0"
                           step="0.01"
                           placeholder="Ex: R$ 12,00">
                    <span matPrefix>R$&nbsp;</span>
                    <mat-hint>Preencha apenas se for diferente do preço normal (Balcão)</mat-hint>
                    <mat-error *ngIf="productForm.get('delivery_price')?.hasError('min')">
                      Preço de entrega deve ser maior que zero
                    </mat-error>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>
                      <span class="label-with-help">
                        Preço Original / Tabela
                        <mat-icon matTooltip="Use para promoções (Preço 'De'). Se preenchido, o site mostrará este valor riscado (De R$ 20,00 por R$ 15,00)." 
                                  matTooltipPosition="above"
                                  class="help-icon">help_outline</mat-icon>
                      </span>
                    </mat-label>
                    <input matInput 
                           type="number" 
                           formControlName="original_price" 
                           min="0"
                           step="0.01"
                           placeholder="Ex: De R$ 100,00">
                    <span matPrefix>R$&nbsp;</span>
                    <mat-hint>Preço antes do desconto (opcional)</mat-hint>
                    <mat-error *ngIf="productForm.get('original_price')?.hasError('min')">
                      Preço original deve ser maior que zero
                    </mat-error>
                    <mat-error *ngIf="productForm.get('original_price')?.hasError('mustBeGreaterThanPrice')">
                      O preço original deve ser maior que o preço de venda
                    </mat-error>
                  </mat-form-field>
                </div>

                <!-- Feedback Visual de Desconto -->
                <div class="discount-feedback" *ngIf="discountInfo.show">
                  <div class="feedback-success" *ngIf="discountInfo.isValid">
                    <mat-icon>check_circle</mat-icon>
                    <span>
                      <strong>Desconto de {{ discountInfo.percentage }}% aplicado!</strong>
                      O cliente verá: de <del>R$ {{ discountInfo.originalPrice | number:'1.2-2' }}</del> por R$ {{ discountInfo.finalPrice | number:'1.2-2' }}
                    </span>
                  </div>
                  <div class="feedback-error" *ngIf="!discountInfo.isValid">
                    <mat-icon>error</mat-icon>
                    <span>
                      <strong>Erro:</strong> O preço original deve ser maior que o preço de venda
                    </span>
                  </div>
                </div>
              </div>

              <mat-divider></mat-divider>

              <!-- Configuração de Pack -->
              <div class="advanced-section">
                <h4 class="section-title">Configuração de Pack (Caixa/Fardo)</h4>
                <p class="pack-warning">
                  <mat-icon>info</mat-icon>
                  Use esta opção apenas para Caixas/Fardos.
                </p>
                
                <mat-slide-toggle formControlName="is_pack" color="primary">
                  Este produto é um Pack (desconta estoque do produto pai)
                </mat-slide-toggle>

                <div *ngIf="productForm.get('is_pack')?.value" class="pack-config">
                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Produto Pai (Unidade Base)</mat-label>
                      <mat-select formControlName="parent_product_id" required>
                        <mat-option [value]="null">Selecione o produto base</mat-option>
                        <mat-option *ngFor="let parentProduct of availableParentProducts" [value]="parentProduct.id">
                          {{parentProduct.name}}
                        </mat-option>
                      </mat-select>
                      <mat-error *ngIf="productForm.get('parent_product_id')?.hasError('required')">
                        Produto pai é obrigatório para Caixa/Fardo
                      </mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Quantidade por Caixa/Fardo</mat-label>
                      <input matInput 
                             type="number" 
                             formControlName="stock_multiplier" 
                             required
                             min="2"
                             [disabled]="!productForm.get('is_pack')?.value">
                      <mat-hint>Quantas unidades do produto pai equivalem a 1 Caixa/Fardo</mat-hint>
                      <mat-error *ngIf="productForm.get('stock_multiplier')?.hasError('required')">
                        Quantidade por Caixa/Fardo é obrigatória
                      </mat-error>
                      <mat-error *ngIf="productForm.get('stock_multiplier')?.hasError('min')">
                        Quantidade por Caixa/Fardo deve ser maior que 1
                      </mat-error>
                    </mat-form-field>
                  </div>
                </div>
              </div>

              <mat-divider *ngIf="!productForm.get('is_pack')?.value"></mat-divider>

              <!-- Configurações de Dose -->
              <div *ngIf="!productForm.get('is_pack')?.value" class="advanced-section">
                <h4 class="section-title">Configuração de Venda por Dose</h4>
                
                <div class="form-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Doses por Garrafa</mat-label>
                    <input matInput 
                           type="number" 
                           formControlName="doses_por_garrafa" 
                           required
                           min="1">
                    <mat-error *ngIf="productForm.get('doses_por_garrafa')?.hasError('required')">
                      Doses por garrafa é obrigatório
                    </mat-error>
                    <mat-error *ngIf="productForm.get('doses_por_garrafa')?.hasError('min')">
                      Deve ser pelo menos 1 dose por garrafa
                    </mat-error>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Preço da Dose</mat-label>
                    <input matInput 
                           type="number" 
                           formControlName="dose_price" 
                           min="0"
                           step="0.01">
                    <span matPrefix>R$&nbsp;</span>
                    <mat-error *ngIf="productForm.get('dose_price')?.hasError('min')">
                      Preço da dose deve ser maior que zero
                    </mat-error>
                  </mat-form-field>
                </div>

                <mat-slide-toggle formControlName="can_sell_by_dose" color="primary">
                  Permitir venda por dose
                </mat-slide-toggle>
              </div>
            </div>
          </mat-expansion-panel>

          <!-- Status -->
          <div class="form-row status-row">
            <div class="toggle-wrapper">
              <mat-slide-toggle formControlName="is_active" color="primary">
                Produto Ativo
              </mat-slide-toggle>
              <mat-icon 
                matTooltip="Se desligado, o produto some de todo o sistema (Site e Caixa). Use para itens fora de linha."
                matTooltipPosition="right"
                class="info-icon">
                help_outline
              </mat-icon>
            </div>
            
            <div class="toggle-wrapper">
              <mat-slide-toggle formControlName="visible_online" color="primary">
                Visível no Site/App
              </mat-slide-toggle>
              <mat-icon 
                matTooltip="Se desligado, o produto fica oculto no site (Ecommerce), mas continua disponível para venda no Caixa (Balcão)."
                matTooltipPosition="right"
                class="info-icon">
                help_outline
              </mat-icon>
            </div>
            
            <div class="toggle-wrapper">
              <mat-slide-toggle formControlName="featured" color="accent">
                Produto em Destaque
              </mat-slide-toggle>
              <mat-icon 
                matTooltip="Exibe o produto na seção principal 'Destaques' da página inicial."
                matTooltipPosition="right"
                class="info-icon">
                help_outline
              </mat-icon>
            </div>
            
            <div class="toggle-wrapper">
              <mat-slide-toggle formControlName="offers" color="warn">
                Produto em Oferta
              </mat-slide-toggle>
              <mat-icon 
                matTooltip="Adiciona uma etiqueta de promoção e exibe na seção de ofertas especiais."
                matTooltipPosition="right"
                class="info-icon">
                help_outline
              </mat-icon>
            </div>
            
            <div class="toggle-wrapper">
              <mat-slide-toggle formControlName="popular" color="primary">
                Exibir como Sugestão no Checkout
              </mat-slide-toggle>
              <mat-icon 
                matTooltip="Estes produtos aparecerão na lista 'Não esqueceu de nada?' na hora de finalizar a compra."
                matTooltipPosition="right"
                class="info-icon">
                help_outline
              </mat-icon>
            </div>
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
      background-color: transparent !important;
    }

    .toggle-wrapper {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
    }

    .toggle-wrapper mat-slide-toggle {
      flex: 1;
    }

    .info-icon {
      color: #999;
      font-size: 18px;
      width: 18px;
      height: 18px;
      cursor: help;
      flex-shrink: 0;
      margin-left: 4px;
    }

    .info-icon:hover {
      color: var(--primary, #673ab7);
    }

    .label-with-help {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .help-icon {
      color: #999;
      font-size: 16px;
      width: 16px;
      height: 16px;
      cursor: help;
      flex-shrink: 0;
      vertical-align: middle;
    }

    .help-icon:hover {
      color: var(--primary, #673ab7);
    }

    /* Remover qualquer fundo amarelo dos toggles/checkboxes */
    :host ::ng-deep .status-row mat-slide-toggle {
      background-color: transparent !important;
    }

    :host ::ng-deep .status-row .mat-mdc-slide-toggle {
      background-color: transparent !important;
    }

    :host ::ng-deep .status-row .mdc-switch {
      background-color: transparent !important;
    }

    .pack-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      padding: 12px;
      background-color: #fff;
      border-left: 4px solid var(--primary, #673ab7);
      border-radius: 4px;
      color: #666;
      font-size: 14px;
    }

    .pack-warning mat-icon {
      color: var(--primary, #673ab7);
    }

    .pack-config {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
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

    /* Forçar fundo branco nos campos do modal */
    :host ::ng-deep mat-dialog-content .mat-mdc-form-field {
      background-color: #ffffff !important;
    }

    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mat-mdc-text-field-wrapper {
      background-color: #ffffff !important;
    }

    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mat-mdc-text-field-wrapper .mat-mdc-form-field-flex {
      background-color: #ffffff !important;
    }

    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mat-mdc-form-field-focus-overlay {
      background-color: #ffffff !important;
    }

    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mat-mdc-form-field-input-control input,
    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mat-mdc-form-field-input-control textarea {
      background-color: #ffffff !important;
    }

    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mdc-notched-outline {
      border-color: rgba(0, 0, 0, 0.12) !important;
    }

    :host ::ng-deep mat-dialog-content .mat-mdc-form-field .mdc-notched-outline__notch {
      border-color: rgba(0, 0, 0, 0.12) !important;
    }

    /* Adicionar sombra suave para destacar os campos */
    :host ::ng-deep mat-dialog-content .mat-mdc-form-field {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
      border-radius: 4px;
    }

    .price-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .discount-feedback {
      margin-top: 8px;
      padding: 12px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .feedback-success {
      background-color: #e8f5e9;
      color: #2e7d32;
      border-left: 4px solid #4caf50;
    }

    .feedback-success mat-icon {
      color: #4caf50;
    }

    .feedback-success del {
      color: #666;
      margin: 0 4px;
    }

    .feedback-error {
      background-color: #ffebee;
      color: #c62828;
      border-left: 4px solid #f44336;
    }

    .feedback-error mat-icon {
      color: #f44336;
    }

    .discount-feedback mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Painel de Configurações Avançadas - Estilo Moderno */
    .advanced-settings-panel {
      margin-top: 16px;
      box-shadow: none !important;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    :host ::ng-deep .advanced-settings-panel .mat-expansion-panel {
      box-shadow: none !important;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    :host ::ng-deep .advanced-settings-panel .mat-expansion-panel-header {
      background-color: #f8f9fa;
      padding: 16px 24px;
      border-radius: 8px 8px 0 0;
    }

    :host ::ng-deep .advanced-settings-panel .mat-expansion-panel-header:hover {
      background-color: #f0f1f2;
    }

    :host ::ng-deep .advanced-settings-panel.mat-expanded .mat-expansion-panel-header {
      border-radius: 8px 8px 0 0;
    }

    :host ::ng-deep .advanced-settings-panel .mat-expansion-panel-body {
      padding: 16px 24px;
    }

    .advanced-settings-panel mat-panel-title {
      font-weight: 500;
      color: #212529;
      font-size: 15px;
    }

    .advanced-settings-panel mat-panel-description {
      color: #6c757d;
      font-size: 13px;
    }

    .advanced-settings-content {
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .advanced-section {
      padding: 16px 0;
    }

    .advanced-section:first-child {
      padding-top: 0;
    }

    .advanced-section:last-child {
      padding-bottom: 0;
    }

    .section-title {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 15px;
      font-weight: 500;
    }

    :host ::ng-deep .advanced-settings-panel mat-divider {
      margin: 16px 0;
    }

    /* Garantir que os campos dentro do painel tenham fundo branco */
    :host ::ng-deep .advanced-settings-panel .mat-mdc-form-field {
      background-color: #ffffff !important;
    }

    :host ::ng-deep .advanced-settings-panel .mat-mdc-slide-toggle {
      background-color: transparent !important;
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
export class ProductFormDialogComponent implements OnInit {
  @ViewChild('advancedPanel') advancedPanel!: MatExpansionPanel;

  private static normalizeForSearch(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }
  productForm: FormGroup;
  allCategories: Category[] = [];
  categoryFilterCtrl = new FormControl<string>('');
  filteredCategories$!: Observable<Category[]>;
  availableParentProducts: Product[] = [];
  loading = false;
  isEdit = false;
  imagePreview: string | null = null;
  imageFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<ProductFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product?: Product }
  ) {
    this.isEdit = !!data.product;
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      category_id: ['', Validators.required],
      barcode: [''],
      price: ['', [Validators.required, Validators.min(0)]],
      delivery_price: ['', [Validators.min(0)]],
      original_price: ['', [Validators.min(0)]],
      current_stock: ['', [Validators.required, Validators.min(0)]],
      min_stock: ['', [Validators.required, Validators.min(0)]],
      doses_por_garrafa: [5, [Validators.required, Validators.min(1)]],
      can_sell_by_dose: [false],
      dose_price: ['', [Validators.min(0)]],
      is_pack: [false],
      parent_product_id: [null], // Sem validators na inicialização
      stock_multiplier: [1], // Sem validators na inicialização
      is_active: [true],
      visible_online: [true],
      featured: [false],
      offers: [false],
      popular: [false]
    });

    if (this.isEdit) {
      if (data.product) {
        const isPack = !!(data.product.parent_product_id && data.product.stock_multiplier && data.product.stock_multiplier > 1);
        this.productForm.patchValue({
          ...data.product,
          is_pack: isPack
        });
        
        // Se for Pack, desabilitar campo de estoque
        if (isPack) {
          const currentStockControl = this.productForm.get('current_stock');
          if (currentStockControl) {
            currentStockControl.disable();
            currentStockControl.setValue(0);
          }
        }
        
        this.imagePreview = data.product.image_url || null;
      }
    }
  }

  ngOnInit(): void {
    this.filteredCategories$ = this.categoryFilterCtrl.valueChanges.pipe(
      startWith(''),
      map(term => this.filterCategories(term || ''))
    );
    this.categoryFilterCtrl.valueChanges.subscribe(value => {
      if (!value?.trim()) this.productForm.get('category_id')?.setValue(null, { emitEvent: false });
    });
    this.loadCategories();
    this.loadParentProducts();
    this.setupValidators();
    this.setupPackValidators();
    this.setupPriceValidation();
    
    // Garantir que os validators de Pack estejam corretos na inicialização
    const isPackControl = this.productForm.get('is_pack');
    if (isPackControl && !isPackControl.value) {
      // Se não for Pack, garantir que os campos de Pack não tenham validators
      const parentProductControl = this.productForm.get('parent_product_id');
      const stockMultiplierControl = this.productForm.get('stock_multiplier');
      
      if (parentProductControl && stockMultiplierControl) {
        parentProductControl.clearValidators();
        stockMultiplierControl.clearValidators();
        parentProductControl.updateValueAndValidity({ emitEvent: false });
        stockMultiplierControl.updateValueAndValidity({ emitEvent: false });
      }
    }
  }

  private loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (data) => {
        this.allCategories = data;
        this.categoryFilterCtrl.setValue(this.categoryFilterCtrl.value ?? '');
        if (this.isEdit && this.data.product?.category_id) {
          const cat = this.allCategories.find(c => c.id === this.data.product!.category_id);
          if (cat) this.categoryFilterCtrl.setValue(cat.name);
        }
      },
      error: (error) => {
        console.error('Erro ao carregar categorias:', error);
        this.snackBar.open('Erro ao carregar categorias', 'Fechar', { duration: 3000 });
      }
    });
  }

  private filterCategories(term: string): Category[] {
    const normalized = ProductFormDialogComponent.normalizeForSearch(term);
    if (!normalized) return this.allCategories.slice();
    return this.allCategories.filter(c =>
      ProductFormDialogComponent.normalizeForSearch(c.name).includes(normalized)
    );
  }

  /**
   * Abre o diálogo de Nova Categoria sem sair do formulário de Produto.
   * Após salvar, recarrega as categorias e limpa o filtro para exibir a nova.
   */
  openNewCategoryDialog(event: MouseEvent): void {
    event.stopPropagation();

    const dialogRef = this.dialog.open(CategoryFormDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe((result) => {
      // O CategoryFormDialogComponent atualmente retorna apenas true/false
      if (result) {
        this.loadCategories();
        // UX: limpar o filtro para mostrar toda a lista, incluindo a recém-criada
        this.categoryFilterCtrl.setValue('', { emitEvent: true });
      }
    });
  }

  onCategorySelected(event: { option: { value: Category } }): void {
    const category = event.option.value;
    this.productForm.get('category_id')?.setValue(category.id);
    this.categoryFilterCtrl.setValue(category.name);
  }

  private loadParentProducts(): void {
    // Carregar produtos que podem ser pais (excluindo o produto atual se estiver editando)
    this.productService.getProducts({ per_page: 1000, is_active: true }).subscribe({
      next: (response) => {
        this.availableParentProducts = response.data.filter(p => 
          !this.isEdit || p.id !== this.data.product?.id
        );
      },
      error: (error) => {
        console.error('Erro ao carregar produtos para Pack:', error);
      }
    });
  }

  private setupPackValidators(): void {
    const isPackControl = this.productForm.get('is_pack');
    const parentProductControl = this.productForm.get('parent_product_id');
    const stockMultiplierControl = this.productForm.get('stock_multiplier');
    const currentStockControl = this.productForm.get('current_stock');

    if (isPackControl && parentProductControl && stockMultiplierControl && currentStockControl) {
      // Obter referências aos controles de dose e estoque mínimo
      const dosesPorGarrafaControl = this.productForm.get('doses_por_garrafa');
      const dosePriceControl = this.productForm.get('dose_price');
      const canSellByDoseControl = this.productForm.get('can_sell_by_dose');
      const minStockControl = this.productForm.get('min_stock');
      
      isPackControl.valueChanges.subscribe(isPack => {
        if (isPack) {
          // Ativar validações de Pack
          parentProductControl.setValidators([Validators.required]);
          stockMultiplierControl.setValidators([Validators.required, Validators.min(2)]);
          
          // Zerar e limpar campos que não se aplicam a Packs
          currentStockControl.setValue(0);
          currentStockControl.clearValidators();
          currentStockControl.setValidators([Validators.min(0)]);
          
          // Zerar campos de dose
          if (dosesPorGarrafaControl) {
            dosesPorGarrafaControl.setValue(5);
            dosesPorGarrafaControl.clearValidators();
            dosesPorGarrafaControl.setValidators([Validators.min(1)]);
            dosesPorGarrafaControl.updateValueAndValidity({ emitEvent: false });
          }
          
          if (dosePriceControl) {
            dosePriceControl.setValue(null);
            dosePriceControl.clearValidators();
            dosePriceControl.updateValueAndValidity({ emitEvent: false });
          }
          
          if (canSellByDoseControl) {
            canSellByDoseControl.setValue(false);
          }
          
          if (minStockControl) {
            minStockControl.setValue(0);
            minStockControl.clearValidators();
            minStockControl.setValidators([Validators.min(0)]);
            minStockControl.updateValueAndValidity({ emitEvent: false });
          }
        } else {
          // Desativar validações de Pack - remover todos os validators
          parentProductControl.clearValidators();
          stockMultiplierControl.clearValidators();
          parentProductControl.setValue(null);
          stockMultiplierControl.setValue(1);
          
          // Reabilitar estoque e restaurar validação
          currentStockControl.clearValidators();
          currentStockControl.setValidators([Validators.required, Validators.min(0)]);
          
          // Restaurar validações de dose
          if (dosesPorGarrafaControl) {
            dosesPorGarrafaControl.clearValidators();
            dosesPorGarrafaControl.setValidators([Validators.required, Validators.min(1)]);
            dosesPorGarrafaControl.updateValueAndValidity({ emitEvent: false });
          }
          
          if (minStockControl) {
            minStockControl.clearValidators();
            minStockControl.setValidators([Validators.required, Validators.min(0)]);
            minStockControl.updateValueAndValidity({ emitEvent: false });
          }
        }
        
        // Atualizar validação de todos os controles
        parentProductControl.updateValueAndValidity({ emitEvent: false });
        stockMultiplierControl.updateValueAndValidity({ emitEvent: false });
        currentStockControl.updateValueAndValidity({ emitEvent: false });
      });
      
      // Executar validação inicial baseada no estado atual
      const initialIsPack = isPackControl.value;
      if (!initialIsPack) {
        // Garantir que os validators estão limpos na inicialização
        parentProductControl.clearValidators();
        stockMultiplierControl.clearValidators();
        parentProductControl.updateValueAndValidity({ emitEvent: false });
        stockMultiplierControl.updateValueAndValidity({ emitEvent: false });
      }
    }
  }

  private setupValidators(): void {
    const barcodeControl = this.productForm.get('barcode');

    if (barcodeControl) {
      barcodeControl.valueChanges.subscribe(value => {
        if (value) {
          this.productService.validateBarcode(value, this.data.product?.id).subscribe({
            next: (response) => {
              if (!response.valid) {
                barcodeControl.setErrors({ barcodeExists: true });
              }
            }
          });
        }
      });
    }
  }

  private setupPriceValidation(): void {
    const priceControl = this.productForm.get('price');
    const originalPriceControl = this.productForm.get('original_price');

    if (priceControl && originalPriceControl) {
      // Validação customizada: original_price deve ser maior que price quando preenchido
      const validatePriceRelation = () => {
        const price = parseFloat(priceControl.value);
        const originalPrice = parseFloat(originalPriceControl.value);

        if (originalPrice && !isNaN(originalPrice) && !isNaN(price) && originalPrice <= price) {
          originalPriceControl.setErrors({ mustBeGreaterThanPrice: true });
        } else if (originalPriceControl.hasError('mustBeGreaterThanPrice')) {
          originalPriceControl.updateValueAndValidity({ emitEvent: false });
        }
      };

      // Validar quando qualquer um dos preços mudar
      priceControl.valueChanges.subscribe(() => validatePriceRelation());
      originalPriceControl.valueChanges.subscribe(() => validatePriceRelation());
    }
  }

  get discountInfo(): { show: boolean; isValid: boolean; percentage: number; originalPrice: number; finalPrice: number } {
    const price = parseFloat(this.productForm.get('price')?.value);
    const originalPrice = parseFloat(this.productForm.get('original_price')?.value);

    if (!originalPrice || isNaN(originalPrice) || isNaN(price) || price <= 0) {
      return { show: false, isValid: false, percentage: 0, originalPrice: 0, finalPrice: 0 };
    }

    const isValid = originalPrice > price;
    const percentage = isValid ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

    return {
      show: true,
      isValid,
      percentage,
      originalPrice,
      finalPrice: price
    };
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
    if (this.isEdit && this.data.product?.image_url) {
      this.productService.deleteImage(this.data.product?.id || 0).subscribe();
    }
  }

  onSubmit(): void {
    this.productForm.markAllAsTouched();
    if (!this.productForm.valid) {
      const ctrl = this.productForm;
      const advancedKeys = ['parent_product_id', 'stock_multiplier', 'doses_por_garrafa', 'delivery_price', 'original_price', 'dose_price'];
      const hasErrorInPanel = advancedKeys.some(key => ctrl.get(key)?.invalid);
      if (hasErrorInPanel && this.advancedPanel) {
        this.advancedPanel.open();
      }
      this.snackBar.open('Verifique os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }
    this.loading = true;
      
      // Usar getRawValue() para incluir campos desabilitados (como current_stock quando é Pack)
      const formValue = this.productForm.getRawValue();
      const productData: CreateProductDTO = {
        name: formValue.name ?? '',
        description: formValue.description ?? '',
        category_id: formValue.category_id,
        barcode: formValue.barcode ?? null,
        price: formValue.price,
        delivery_price: formValue.delivery_price ? parseFloat(formValue.delivery_price) : null,
        original_price: formValue.original_price ? parseFloat(formValue.original_price) : null,
        // Se for Pack, sempre enviar 0. Se não for Pack, usar o valor do formulário
        current_stock: formValue.is_pack ? 0 : formValue.current_stock,
        min_stock: formValue.is_pack ? 0 : formValue.min_stock,
        doses_por_garrafa: formValue.is_pack ? 5 : (formValue.doses_por_garrafa ?? 5),
        can_sell_by_dose: formValue.is_pack ? false : (formValue.can_sell_by_dose ?? false),
        dose_price: formValue.is_pack ? null : (formValue.dose_price ?? null),
        parent_product_id: formValue.is_pack ? formValue.parent_product_id : null,
        stock_multiplier: formValue.is_pack ? formValue.stock_multiplier : 1,
        is_active: formValue.is_active ?? true,
        visible_online: formValue.visible_online ?? true,
        featured: formValue.featured ?? false,
        offers: formValue.offers ?? false,
        popular: formValue.popular ?? false
      };

      if (this.imageFile) {
        productData.image = this.imageFile;
      }

      const request = this.isEdit
        ? this.productService.updateProduct({ id: this.data.product!.id, ...productData })
        : this.productService.createProduct(productData);

      request.subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Erro ao salvar produto:', error);
          console.error('Resposta completa:', error.error);
          console.error('Dados enviados:', productData);
          
          let errorMessage = 'Erro ao salvar produto';
          
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (error.error.errors) {
              // Erros de validação do Laravel - mostrar todos os erros
              const validationErrors = error.error.errors;
              const errorMessages: string[] = [];
              
              Object.entries(validationErrors).forEach(([field, messages]) => {
                if (Array.isArray(messages)) {
                  errorMessages.push(`${field}: ${messages.join(', ')}`);
                }
              });
              
              if (errorMessages.length > 0) {
                errorMessage = errorMessages.join(' | ');
              } else {
                errorMessage = 'Erro de validação. Verifique os dados.';
              }
            }
          }
          
          this.snackBar.open(errorMessage, 'Fechar', { duration: 7000 });
          this.loading = false;
        }
      });
  }

  resolvePreview(previewUrl: string): string {
    if (!previewUrl) return '';
    if (previewUrl.startsWith('data:')) return previewUrl;
    if (previewUrl.startsWith('http://') || previewUrl.startsWith('https://')) return previewUrl;
    if (previewUrl.startsWith('/storage/') || previewUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = previewUrl.startsWith('/') ? previewUrl : `/${previewUrl}`;
      return `${base}${path}`;
    }
    return previewUrl;
  }
}
