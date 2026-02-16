import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormsModule, FormControl } from '@angular/forms';
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, Observable, of } from 'rxjs';
import { startWith, map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ComboService } from '../../../services/combo.service';
import { 
  ProductBundle, 
  ProductBundleFormData, 
  BundleGroupFormData,
  BundleOptionFormData,
  Product 
} from '../../../../core/models/product-bundle.model';
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
    MatDialogModule,
    MatAutocompleteModule,
    MatExpansionModule
  ],
  templateUrl: './combo-form.component.html',
  styleUrls: ['./combo-form.component.css']
})
export class ComboFormComponent implements OnInit, OnDestroy {
  bundleForm!: FormGroup;
  products: Product[] = [];
  loading = false;
  isEdit = false;
  isSubmitted = false;
  bundleId?: number;
  originalPrice = 0;
  selectedImages: File[] = [];
  existingImages: string[] = [];
  imagePreviewUrls: string[] = []; // URLs de preview para evitar NG0100

  // Sistema de busca de produtos por opção (cada opção tem seu próprio controle e observable)
  filteredProducts$: Map<string, Observable<Product[]>> = new Map(); // key: 'groupIndex_optionIndex'

  private comboService = inject(ComboService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  // Getter para facilitar acesso ao FormArray de grupos
  get groupsFormArray(): FormArray {
    return this.bundleForm.get('groups') as FormArray;
  }

  // Getter para facilitar acesso ao FormArray de opções de um grupo
  getGroupOptionsFormArray(groupIndex: number): FormArray {
    return this.groupsFormArray.at(groupIndex).get('options') as FormArray;
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
        this.bundleId = +params['id'];
        this.isEdit = true;
        this.loadBundle();
      }
    });

    // Monitorar mudanças no formulário para debug
    this.bundleForm.statusChanges.subscribe(status => {
      console.log('Status do formulário mudou para:', status);
      if (status === 'INVALID') {
        console.log('Formulário inválido. Erros:', this.getFormErrors());
      }
    });
  }

  initializeForm(): void {
    this.bundleForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      bundle_type: ['combo', [Validators.required]],
      pricing_type: ['fixed', [Validators.required]],
      base_price: [0, [Validators.min(0)]],
      original_price: [0, [Validators.min(0)]],
      discount_percentage: [0, [Validators.min(0), Validators.max(100)]],
      barcode: [''],
      is_active: [true],
      featured: [false],
      offers: [false],
      popular: [false],
      groups: this.fb.array([]) // FormArray de grupos
    });

    // Adicionar validação condicional para base_price quando pricing_type é 'fixed'
    this.bundleForm.get('pricing_type')?.valueChanges.subscribe(pricingType => {
      const basePriceControl = this.bundleForm.get('base_price');
      if (pricingType === 'fixed') {
        basePriceControl?.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        basePriceControl?.clearValidators();
      }
      basePriceControl?.updateValueAndValidity();
    });
  }

  /**
   * Cria um FormGroup para um novo grupo
   */
  createGroupFormGroup(): FormGroup {
    const newIndex = this.groupsFormArray.length;
    const groupForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      order: [newIndex, [Validators.min(0)]],
      is_required: [true],
      min_selections: [1, [Validators.required, Validators.min(0)]],
      max_selections: [1, [Validators.required, Validators.min(1)]],
      selection_type: ['single', [Validators.required]],
      options: this.fb.array([]) // FormArray de opções
    });

    // Marcar o grupo como não tocado e não sujo inicialmente
    // Isso evita que o formulário fique inválido ao adicionar grupos vazios
    groupForm.markAsUntouched();
    groupForm.markAsPristine();
    
    // Desabilitar validação até que o usuário interaja com o campo
    // A validação será reativada quando o campo for tocado
    groupForm.get('name')?.setErrors(null);
    
    return groupForm;
  }

  /**
   * Cria um FormGroup para uma nova opção.
   * O controle 'product' guarda o objeto Product para exibir no autocomplete (nome); product_id é enviado ao backend.
   */
  createOptionFormGroup(): FormGroup {
    return this.fb.group({
      product_id: [null, [Validators.required]],
      product: [null as Product | null], // objeto completo para o autocomplete exibir o nome ao carregar
      quantity: [1, [Validators.required, Validators.min(1)]],
      sale_type: ['garrafa', [Validators.required]],
      price_adjustment: [0, [Validators.min(0)]],
      order: [0]
    });
  }

  /**
   * Adiciona um novo grupo ao formulário
   */
  addGroup(): void {
    const groupForm = this.createGroupFormGroup();
    
    // Adicionar ao array sem disparar validação imediata
    this.groupsFormArray.push(groupForm);
    
    const groupIndex = this.groupsFormArray.length - 1;
    
    // Atualizar o order do novo grupo para o índice correto (sem emitir eventos)
    groupForm.patchValue({ order: groupIndex }, { emitEvent: false, onlySelf: true });
    
    // Forçar detecção de mudanças para atualizar a UI
    this.cdr.detectChanges();
  }

  /**
   * Remove um grupo do formulário
   */
  removeGroup(groupIndex: number): void {
    this.groupsFormArray.removeAt(groupIndex);
    for (const key of Array.from(this.filteredProducts$.keys())) {
      if (key.startsWith(`${groupIndex}_`)) this.filteredProducts$.delete(key);
    }
  }

  /**
   * Adiciona uma nova opção a um grupo
   */
  addOptionToGroup(groupIndex: number, product?: Product): void {
    const optionsFormArray = this.getGroupOptionsFormArray(groupIndex);
    const optionForm = this.createOptionFormGroup();
    
    if (product) {
      optionForm.patchValue({
        product_id: product.id,
        product
      });
    }
    
    optionsFormArray.push(optionForm);
    this.setupFilteredProductsForOption(groupIndex, optionsFormArray.length - 1);
  }

  /**
   * Remove uma opção de um grupo
   */
  removeOptionFromGroup(groupIndex: number, optionIndex: number): void {
    const optionsFormArray = this.getGroupOptionsFormArray(groupIndex);
    optionsFormArray.removeAt(optionIndex);
  }

  /**
   * Configura o observable de produtos filtrados para uma opção (autocomplete por opção).
   * Permite exibir o nome do produto ao carregar o bundle para edição.
   */
  setupFilteredProductsForOption(groupIndex: number, optionIndex: number): void {
    const key = `${groupIndex}_${optionIndex}`;
    if (this.filteredProducts$.has(key)) return;
    const optionForm = this.getGroupOptionsFormArray(groupIndex).at(optionIndex);
    const productControl = optionForm.get('product');
    if (!productControl) return;
    const filtered$ = productControl.valueChanges.pipe(
      startWith(productControl.value),
      debounceTime(200),
      distinctUntilChanged(),
      map(value => {
        if (!this.products?.length) return [];
        const searchTerm = typeof value === 'string'
          ? value
          : (value && typeof value === 'object' && value !== null && 'name' in value
            ? (value as Product).name
            : '');
        if (!searchTerm.trim()) return this.products;
        const term = String(searchTerm).toLowerCase();
        return this.products.filter(p => p.name.toLowerCase().includes(term));
      })
    );
    this.filteredProducts$.set(key, filtered$);
  }

  /**
   * Retorna o FormControl 'product' da opção para uso com [formControl] no template.
   * O controle sempre existe (criado em createOptionFormGroup).
   */
  getOptionProductControl(groupIndex: number, optionIndex: number): FormControl {
    return this.getGroupOptionsFormArray(groupIndex).at(optionIndex).get('product') as FormControl;
  }

  /**
   * Obtém o Observable filtrado para a opção (autocomplete).
   */
  getFilteredProducts$(groupIndex: number, optionIndex: number): Observable<Product[]> {
    const key = `${groupIndex}_${optionIndex}`;
    if (!this.filteredProducts$.has(key)) {
      this.setupFilteredProductsForOption(groupIndex, optionIndex);
    }
    return this.filteredProducts$.get(key)!;
  }

  displayProductName(product: Product | null): string {
    return product ? product.name : '';
  }

  loadProducts(): void {
    this.comboService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error: any) => {
        console.error('Erro ao carregar produtos:', error);
        this.snackBar.open('Erro ao carregar produtos', 'Fechar', { duration: 3000 });
      }
    });
  }

  loadBundle(): void {
    if (!this.bundleId) return;

    this.loading = true;
    this.comboService.getCombo(this.bundleId).subscribe({
      next: (bundle: ProductBundle) => {
        this.populateForm(bundle);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erro ao carregar bundle:', error);
        this.snackBar.open('Erro ao carregar bundle', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  populateForm(bundle: ProductBundle): void {
    console.log('=== DEBUG POPULATE FORM ===');
    console.log('Bundle recebido:', bundle);
    console.log('Bundle.groups:', bundle.groups);
    
    // Primeiro, limpar todos os FormArrays e observables de busca por opção
    while (this.groupsFormArray.length > 0) {
      this.groupsFormArray.removeAt(0);
    }
    this.filteredProducts$.clear();

    // Aplicar valores básicos do bundle
    this.bundleForm.patchValue({
      name: bundle.name || '',
      description: bundle.description || '',
      bundle_type: bundle.bundle_type || 'combo',
      pricing_type: bundle.pricing_type || 'fixed',
      base_price: bundle.base_price !== undefined && bundle.base_price !== null ? bundle.base_price : 0,
      original_price: bundle.original_price !== undefined && bundle.original_price !== null ? bundle.original_price : 0,
      discount_percentage: bundle.discount_percentage !== undefined && bundle.discount_percentage !== null ? bundle.discount_percentage : 0,
      barcode: bundle.barcode || '',
      is_active: bundle.is_active !== undefined ? bundle.is_active : true,
      featured: bundle.featured || false,
      offers: bundle.offers || false,
      popular: bundle.popular || false
    });

    // Carregar imagens existentes
    if (bundle.images && Array.isArray(bundle.images)) {
      this.existingImages = bundle.images;
    } else {
      this.existingImages = [];
    }

    // Recriar grupos e opções do bundle
    if (bundle.groups && Array.isArray(bundle.groups) && bundle.groups.length > 0) {
      console.log('Adicionando grupos ao formulário...', bundle.groups);
      
      bundle.groups.forEach((group, groupIndex) => {
        // Criar FormGroup para o grupo
        const groupForm = this.createGroupFormGroup();
        
        // Aplicar valores do grupo DIRETAMENTE (não usar patchValue para garantir que funcione)
        groupForm.get('name')?.setValue(group.name || '');
        groupForm.get('description')?.setValue(group.description || '');
        groupForm.get('order')?.setValue(group.order !== undefined ? group.order : groupIndex);
        groupForm.get('is_required')?.setValue(group.is_required !== undefined ? group.is_required : true);
        groupForm.get('min_selections')?.setValue(group.min_selections !== undefined ? group.min_selections : 1);
        groupForm.get('max_selections')?.setValue(group.max_selections !== undefined ? group.max_selections : 1);
        groupForm.get('selection_type')?.setValue(group.selection_type || 'single');

        // Obter FormArray de opções do grupo
        const optionsFormArray = groupForm.get('options') as FormArray;
        
        // Limpar opções existentes (se houver)
        while (optionsFormArray.length > 0) {
          optionsFormArray.removeAt(0);
        }

        // Recriar opções do grupo
        if (group.options && Array.isArray(group.options) && group.options.length > 0) {
          console.log(`Adicionando ${group.options.length} opções ao grupo ${groupIndex}...`);
          
          group.options.forEach((option, optionIndex) => {
            // Criar FormGroup para a opção
            const optionForm = this.createOptionFormGroup();
            
            // Aplicar valores da opção DIRETAMENTE (não usar patchValue aqui)
            optionForm.get('product_id')?.setValue(option.product_id !== undefined && option.product_id !== null ? option.product_id : null);
            // Objeto product (vindo da API) para o autocomplete exibir o nome ao carregar a edição
            optionForm.get('product')?.setValue((option as any).product ?? null);
            optionForm.get('quantity')?.setValue(option.quantity !== undefined ? option.quantity : 1);
            optionForm.get('sale_type')?.setValue(option.sale_type || 'garrafa');
            optionForm.get('price_adjustment')?.setValue(option.price_adjustment !== undefined ? option.price_adjustment : 0);
            optionForm.get('order')?.setValue(option.order !== undefined ? option.order : optionIndex);
            
            // Adicionar opção ao FormArray
            optionsFormArray.push(optionForm);
          });
        }

        // Adicionar grupo ao FormArray principal
        this.groupsFormArray.push(groupForm);
        const actualGroupIndex = this.groupsFormArray.length - 1;
        for (let optIdx = 0; optIdx < optionsFormArray.length; optIdx++) {
          this.setupFilteredProductsForOption(actualGroupIndex, optIdx);
        }
      });
    }

    // Debug: verificar estado do formulário após popular
    console.log('Formulário após popular:', this.bundleForm.valid);
    console.log('Erros do formulário:', this.getFormErrors());
    console.log('Valor do formulário:', this.bundleForm.value);
    console.log('Grupos:', this.groupsFormArray.length);
    console.log('Grupos detalhados:', this.groupsFormArray.controls.map((g, i) => ({
      index: i,
      name: g.get('name')?.value,
      optionsCount: (g.get('options') as FormArray).length
    })));
  }

  /**
   * Calcula o preço original automaticamente somando (produto.price * quantidade) de todos os itens
   * Este método atualiza o campo original_price no formulário, mas mantém o campo editável
   * Só atualiza se o valor atual for 0 ou se for igual ao valor calculado anteriormente
   * (para não sobrescrever edições manuais do usuário)
   */
  calculateOriginalPrice(): void {
    // Para bundles com pricing_type 'calculated', calcular baseado nos grupos
    const pricingType = this.bundleForm.get('pricing_type')?.value;
    
    if (pricingType === 'calculated') {
      // Calcular baseado nas opções selecionadas nos grupos
      let totalOriginalPrice = 0;
      
      this.groupsFormArray.controls.forEach((groupControl) => {
        const optionsArray = groupControl.get('options') as FormArray;
        optionsArray.controls.forEach((optionControl) => {
          const productId = optionControl.get('product_id')?.value;
          const quantity = optionControl.get('quantity')?.value || 1;
          const priceAdjustment = optionControl.get('price_adjustment')?.value || 0;
          
          if (productId) {
            const product = this.products.find(p => p.id === productId);
            if (product) {
              const productPrice = product.price || 0;
              totalOriginalPrice += (productPrice + priceAdjustment) * quantity;
            }
          }
        });
      });
      
      const currentOriginalPrice = this.bundleForm.get('original_price')?.value || 0;
      if (currentOriginalPrice === 0 || Math.abs(currentOriginalPrice - this.originalPrice) < 0.01) {
        this.bundleForm.get('original_price')?.setValue(totalOriginalPrice, { emitEvent: false });
      }
      this.originalPrice = totalOriginalPrice;
    } else {
      // Para pricing_type 'fixed', não calcular automaticamente
      this.originalPrice = this.bundleForm.get('original_price')?.value || 0;
    }
  }


  /**
   * Encontra o primeiro campo inválido na tela e faz scroll até ele
   */
  scrollToFirstInvalidField(): void {
    // Aguardar um tick para garantir que o DOM foi atualizado
    setTimeout(() => {
      // Tentar encontrar campos inválidos do Angular Material primeiro
      let firstInvalidField = document.querySelector('.mat-form-field.ng-invalid');
      
      // Se não encontrar, procurar por qualquer campo inválido
      if (!firstInvalidField) {
        firstInvalidField = document.querySelector('input.ng-invalid, textarea.ng-invalid, select.ng-invalid');
      }
      
      // Se ainda não encontrar, procurar por mat-form-field que contém ng-invalid
      if (!firstInvalidField) {
        const invalidInputs = document.querySelectorAll('input.ng-invalid, textarea.ng-invalid');
        if (invalidInputs.length > 0) {
          const input = invalidInputs[0] as HTMLElement;
          firstInvalidField = input.closest('.mat-form-field') || input;
        }
      }
      if (!firstInvalidField) {
        firstInvalidField = document.querySelector('.group-error-highlight') as HTMLElement;
      }
      if (firstInvalidField) {
        firstInvalidField.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
  }

  onSubmit(): void {
    // Debug: sempre mostrar os dados, mesmo se o formulário não for válido
    console.log('=== DEBUG SUBMIT ===');
    console.log('Formulário válido:', this.bundleForm.valid);
    console.log('Valor completo do formulário:', this.bundleForm.value);
    console.log('Grupos:', this.groupsFormArray.length);
    console.log('Erros do formulário:', this.getFormErrors());
    
    // Marcar todos os campos como tocados para mostrar erros
    this.bundleForm.markAllAsTouched();
    this.groupsFormArray.controls.forEach(groupControl => {
      groupControl.markAllAsTouched();
      const optionsArray = groupControl.get('options') as FormArray;
      optionsArray.controls.forEach(optionControl => {
        optionControl.markAllAsTouched();
      });
    });
    
    // Verificar se o formulário é válido e se há grupos com opções
    const isValid = this.bundleForm.valid && this.hasValidGroups();
    
    if (!isValid) {
      this.isSubmitted = true;
      this.snackBar.open(
        'Verifique os campos obrigatórios e grupos',
        'Fechar',
        { duration: 3000 }
      );
      this.scrollToFirstInvalidField();
      return;
    }
    this.isSubmitted = false;
    
    // Se válido, prosseguir com o envio
    this.loading = true;
    
    // Converter grupos para o formato esperado pelo backend
    const groupsData: BundleGroupFormData[] = this.groupsFormArray.controls.map((groupControl, groupIndex) => {
      const optionsArray = groupControl.get('options') as FormArray;
      const options: BundleOptionFormData[] = optionsArray.controls.map((optionControl, optionIndex) => ({
        product_id: optionControl.get('product_id')?.value,
        quantity: optionControl.get('quantity')?.value || 1,
        sale_type: optionControl.get('sale_type')?.value || 'garrafa',
        price_adjustment: optionControl.get('price_adjustment')?.value || 0,
        order: optionControl.get('order')?.value || optionIndex
      }));

      return {
        name: groupControl.get('name')?.value,
        description: groupControl.get('description')?.value,
        order: groupControl.get('order')?.value || groupIndex,
        is_required: groupControl.get('is_required')?.value || false,
        min_selections: groupControl.get('min_selections')?.value || 1,
        max_selections: groupControl.get('max_selections')?.value || 1,
        selection_type: groupControl.get('selection_type')?.value || 'single',
        options: options
      };
    });

    const bundleData: ProductBundleFormData = {
      ...this.bundleForm.value,
      base_price: this.bundleForm.value.base_price ? Number(this.bundleForm.value.base_price) : undefined,
      original_price: this.bundleForm.value.original_price ? Number(this.bundleForm.value.original_price) : undefined,
      discount_percentage: this.bundleForm.value.discount_percentage ? Number(this.bundleForm.value.discount_percentage) : undefined,
      groups: groupsData,
      images: this.selectedImages.length > 0 ? this.selectedImages : undefined
    };

    // Debug: log dos dados que serão enviados
    console.log('Dados do formulário (convertidos):', bundleData);
    console.log('Grupos (convertidos):', bundleData.groups);
    console.log('Imagens selecionadas:', this.selectedImages.length);

    const operation = this.isEdit 
      ? this.comboService.updateCombo(this.bundleId!, bundleData)
      : this.comboService.createCombo(bundleData);

    operation.subscribe({
      next: (bundle: ProductBundle) => {
        this.snackBar.open(
          `Bundle ${this.isEdit ? 'atualizado' : 'criado'} com sucesso!`,
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
        
        let errorMessage = 'Erro ao salvar bundle';
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
  }

  markFormGroupTouched(): void {
    Object.keys(this.bundleForm.controls).forEach(key => {
      const control = this.bundleForm.get(key);
      control?.markAsTouched();
    });
    
    // Marcar grupos e opções como tocados também
    this.groupsFormArray.controls.forEach((groupControl) => {
      const groupFormGroup = groupControl as FormGroup;
      Object.keys(groupFormGroup.controls).forEach(key => {
        const control = groupFormGroup.get(key);
        control?.markAsTouched();
      });
      
      const optionsArray = groupFormGroup.get('options') as FormArray;
      optionsArray.controls.forEach((optionControl) => {
        const optionFormGroup = optionControl as FormGroup;
        Object.keys(optionFormGroup.controls).forEach(key => {
          const control = optionFormGroup.get(key);
          control?.markAsTouched();
        });
      });
    });
  }

  getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.bundleForm.controls).forEach(key => {
      const control = this.bundleForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    
    // Verificar se há grupos válidos
    if (this.groupsFormArray.length === 0) {
      errors['groups'] = { required: true };
    } else {
      this.groupsFormArray.controls.forEach((groupControl, groupIndex) => {
        const optionsArray = groupControl.get('options') as FormArray;
        if (optionsArray.length === 0) {
          errors[`groups.${groupIndex}.options`] = { required: true };
        }
      });
    }
    
    return errors;
  }

  hasValidGroups(): boolean {
    if (this.groupsFormArray.length === 0) {
      return false;
    }
    
    // Verificar se cada grupo tem pelo menos uma opção
    return this.groupsFormArray.controls.every((groupControl) => {
      const optionsArray = groupControl.get('options') as FormArray;
      return optionsArray.length > 0;
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