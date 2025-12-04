import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Router, ActivatedRoute } from '@angular/router';

import { ComboService } from '../../../services/combo.service';
import { Combo, ComboFormData, ComboFormDataForBackend, Product } from '../../../../core/models/combo.model';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-combo-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './combo-form.component.html',
  styleUrls: ['./combo-form.component.css']
})
export class ComboFormComponent implements OnInit, OnDestroy {
  comboForm!: FormGroup;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;
  isEdit = false;
  comboId?: number;
  calculatedPrice = 0;
  originalPrice = 0;
  discountAmount = 0;
  selectedImages: File[] = [];
  existingImages: string[] = [];
  imagePreviewUrls: string[] = []; // URLs de preview para evitar NG0100

  private comboService = inject(ComboService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Verificar se o usuário está logado e é admin
    console.log('Usuário logado:', this.authService.getUser());
    console.log('É admin:', this.authService.isAdmin());
    console.log('Token:', this.authService.getToken());
    
    this.loadProducts();
    
    // Verificar se é edição
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.comboId = +params['id'];
        this.isEdit = true;
        this.loadCombo();
      }
    });

    // Monitorar mudanças no formulário para debug
    this.comboForm.statusChanges.subscribe(status => {
      console.log('Status do formulário mudou para:', status);
      if (status === 'INVALID') {
        console.log('Formulário inválido. Erros:', this.getFormErrors());
      }
    });
  }

  initializeForm(): void {
    this.comboForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      price: [0, [Validators.required, Validators.min(0.01)]],
      original_price: [0, [Validators.min(0)]],
      discount_percentage: [0, [Validators.min(0), Validators.max(100)]],
      barcode: [''],
      is_active: [true],
      featured: [false],
      offers: [false],
      popular: [false],
      products: this.fb.array([]),
      productSearchTerm: ['']
    });

    // Adicionar primeiro produto
    this.addProduct();
  }

  get productsArray(): FormArray {
    return this.comboForm.get('products') as FormArray;
  }

  createProductFormGroup(): FormGroup {
    return this.fb.group({
      product_id: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      sale_type: ['garrafa', Validators.required]
    });
  }

  addProduct(): void {
    const productGroup = this.createProductFormGroup();
    this.productsArray.push(productGroup);
  }

  removeProduct(index: number): void {
    if (this.productsArray.length > 1) {
      this.productsArray.removeAt(index);
      this.calculatePrice();
    }
  }

  loadProducts(): void {
    this.comboService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = products;
      },
      error: (error: any) => {
        console.error('Erro ao carregar produtos:', error);
        this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
      }
    });
  }

  filterProducts(): void {
    const searchTerm = this.comboForm.get('productSearchTerm')?.value || '';
    if (!searchTerm.trim()) {
      this.filteredProducts = this.products;
    } else {
      const term = searchTerm.toLowerCase();
      this.filteredProducts = this.products.filter(product => 
        product.name.toLowerCase().includes(term)
      );
    }
  }

  loadCombo(): void {
    if (!this.comboId) return;

    this.loading = true;
    this.comboService.getCombo(this.comboId).subscribe({
      next: (combo: Combo) => {
        this.populateForm(combo);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erro ao carregar combo:', error);
        this.snackBar.open('Erro ao carregar combo', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  populateForm(combo: Combo): void {
    console.log('=== DEBUG POPULATE FORM ===');
    console.log('Combo recebido:', combo);
    console.log('Combo.products:', combo.products);
    
    this.comboForm.patchValue({
      name: combo.name,
      description: combo.description,
      price: combo.price || 0.01, // Garantir que o preço seja maior que 0
      original_price: combo.original_price || 0,
      discount_percentage: combo.discount_percentage || 0,
      barcode: combo.barcode || '',
      is_active: combo.is_active !== undefined ? combo.is_active : true,
      featured: combo.featured || false,
      offers: combo.offers || false,
      popular: combo.popular || false
    });

    // Carregar imagens existentes
    if (combo.images && Array.isArray(combo.images)) {
      this.existingImages = combo.images;
    } else {
      this.existingImages = [];
    }

    // Limpar produtos existentes
    while (this.productsArray.length !== 0) {
      this.productsArray.removeAt(0);
    }

    // Adicionar produtos do combo
    if (combo.products && combo.products.length > 0) {
      console.log('Adicionando produtos ao formulário...');
      combo.products.forEach((product, index) => {
        console.log(`Produto ${index}:`, product);
        
        // Para relação many-to-many com pivot, os dados estão em product.pivot
        const productId = product.id || product.product_id;
        const quantity = product.pivot?.quantity || product.quantity || 1;
        const saleType = product.pivot?.sale_type || product.sale_type || 'garrafa';
        
        console.log(`Produto ${index} - ID: ${productId}, Quantidade: ${quantity}, Tipo: ${saleType}`);
        
        const productGroup = this.fb.group({
          product_id: [productId, Validators.required],
          quantity: [quantity, [Validators.required, Validators.min(1)]],
          sale_type: [saleType, Validators.required]
        });
        this.productsArray.push(productGroup);
      });
    } else {
      console.log('Nenhum produto encontrado no combo, adicionando produto padrão');
      // Se não há produtos, adicionar um produto padrão
      this.addProduct();
    }

    // Calcular preço apenas se há produtos válidos
    if (combo.products && combo.products.length > 0) {
      this.calculatePrice();
    }

    // Debug: verificar estado do formulário após popular
    console.log('Formulário após popular:', this.comboForm.valid);
    console.log('Erros do formulário:', this.getFormErrors());
    console.log('Valor do formulário:', this.comboForm.value);
    console.log('Produtos array:', this.productsArray.value);
  }

  calculatePrice(): void {
    const products = this.productsArray.value;
    
    // Verificar se há produtos válidos
    const validProducts = products.filter((product: any) => 
      product.product_id && product.quantity && product.sale_type
    );
    
    if (validProducts.length === 0) {
      this.originalPrice = 0;
      this.calculatedPrice = 0;
      this.discountAmount = 0;
      return;
    }

    this.comboService.calculatePrice(validProducts).subscribe({
      next: (calculation) => {
        this.originalPrice = calculation.total_original_price;
        this.calculatedPrice = calculation.final_price;
        this.discountAmount = calculation.discount_amount;
        
        // Atualizar preço original no formulário se não foi definido manualmente
        if (!this.comboForm.get('original_price')?.value) {
          this.comboForm.patchValue({ original_price: this.originalPrice });
        }
      },
      error: (error: any) => {
        console.error('Erro ao calcular preço:', error);
        this.originalPrice = 0;
        this.calculatedPrice = 0;
        this.discountAmount = 0;
      }
    });
  }

  onSubmit(): void {
    // Debug: sempre mostrar os dados, mesmo se o formulário não for válido
    console.log('=== DEBUG SUBMIT ===');
    console.log('Formulário válido:', this.comboForm.valid);
    console.log('Valor completo do formulário:', this.comboForm.value);
    console.log('Produtos array:', this.productsArray.value);
    console.log('Erros do formulário:', this.getFormErrors());
    
    if (this.comboForm.valid) {
      this.loading = true;
      
      const comboData: ComboFormData = {
        ...this.comboForm.value,
        price: Number(this.comboForm.value.price),
        original_price: this.comboForm.value.original_price ? Number(this.comboForm.value.original_price) : undefined,
        discount_percentage: this.comboForm.value.discount_percentage ? Number(this.comboForm.value.discount_percentage) : undefined,
        products: this.productsArray.value.map((product: any) => ({
          product_id: Number(product.product_id),
          quantity: Number(product.quantity),
          sale_type: product.sale_type
        })),
        images: this.selectedImages.length > 0 ? this.selectedImages : undefined
      };

      // Remover campos que não devem ser enviados
      delete (comboData as any).productSearchTerm;

      // Debug: log dos dados que serão enviados
      console.log('Dados do formulário (convertidos):', comboData);
      console.log('Produtos (convertidos):', comboData.products);
      console.log('Imagens selecionadas:', this.selectedImages.length);

      const operation = this.isEdit 
        ? this.comboService.updateCombo(this.comboId!, comboData)
        : this.comboService.createCombo(comboData);

      operation.subscribe({
        next: (combo: Combo) => {
          this.snackBar.open(
            `Combo ${this.isEdit ? 'atualizado' : 'criado'} com sucesso!`,
            'Fechar',
            { duration: 3000 }
          );
          this.router.navigate(['/admin/combos']);
        },
        error: (error: any) => {
          console.error('Erro ao salvar combo:', error);
          console.error('Detalhes do erro:', error.error);
          console.error('Status:', error.status);
          console.error('Status Text:', error.statusText);
          
          let errorMessage = 'Erro ao salvar combo';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
            console.error('Mensagem de erro:', error.error.message);
          }
          if (error.error && error.error.errors) {
            console.error('Erros de validação:', error.error.errors);
            // Mostrar erros de validação
            const validationErrors = Object.values(error.error.errors).flat();
            errorMessage = validationErrors.join(', ');
          }
          
          this.snackBar.open(errorMessage, 'Fechar', { duration: 5000 });
          this.loading = false;
        }
      });
    } else {
      console.log('Formulário inválido - marcando campos como tocados');
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched(): void {
    Object.keys(this.comboForm.controls).forEach(key => {
      const control = this.comboForm.get(key);
      control?.markAsTouched();
    });
  }

  getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.comboForm.controls).forEach(key => {
      const control = this.comboForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    
    // Verificar erros nos produtos
    if (this.productsArray && this.productsArray.length > 0) {
      this.productsArray.controls.forEach((control, index) => {
        if (control.errors) {
          errors[`products[${index}]`] = control.errors;
        }
        // Verificar erros nos controles filhos
        Object.keys(control.value).forEach(childKey => {
          const childControl = control.get(childKey);
          if (childControl && childControl.errors) {
            errors[`products[${index}].${childKey}`] = childControl.errors;
          }
        });
      });
    }
    
    return errors;
  }

  hasValidProducts(): boolean {
    if (!this.productsArray || this.productsArray.length === 0) {
      return false;
    }
    
    return this.productsArray.controls.every(control => {
      const productId = control.get('product_id')?.value;
      const quantity = control.get('quantity')?.value;
      const saleType = control.get('sale_type')?.value;
      
      return productId && quantity && saleType && control.valid;
    });
  }

  getProductName(productId: number): string {
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : 'Produto não encontrado';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  onCancel(): void {
    this.router.navigate(['/admin/combos']);
  }

  // Métodos para gerenciar imagens
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const remainingSlots = 5 - this.selectedImages.length;
      const filesToAdd = files.slice(0, remainingSlots);
      
      // Gerar URLs de preview uma única vez e armazenar
      filesToAdd.forEach(file => {
        this.selectedImages.push(file);
        this.imagePreviewUrls.push(URL.createObjectURL(file));
      });
      
      // Limpar o input para permitir selecionar o mesmo arquivo novamente
      input.value = '';
    }
  }

  removeImage(index: number): void {
    // Revogar a URL do objeto para liberar memória
    if (this.imagePreviewUrls[index]) {
      URL.revokeObjectURL(this.imagePreviewUrls[index]);
    }
    this.selectedImages.splice(index, 1);
    this.imagePreviewUrls.splice(index, 1);
  }

  removeExistingImage(index: number): void {
    this.existingImages.splice(index, 1);
  }

  getImagePreview(index: number): string {
    // Retornar a URL já armazenada, não criar uma nova
    return this.imagePreviewUrls[index] || '';
  }

  ngOnDestroy(): void {
    // Limpar todas as URLs de preview ao destruir o componente
    this.imagePreviewUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.imagePreviewUrls = [];
  }
}