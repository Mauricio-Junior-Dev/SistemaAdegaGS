import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { Combo } from '../../../core/models/combo.model';
import { ProductBundle, BundleGroup, BundleOption } from '../../../core/models/product-bundle.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-combo-detail',
  templateUrl: './combo-detail.component.html',
  styleUrls: ['./combo-detail.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    MatIconModule, 
    MatButtonModule,
    MatRadioModule,
    MatCheckboxModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule
  ]
})
export class ComboDetailComponent implements OnInit {
  bundle: ProductBundle | Combo | null = null;
  loading = true;
  error: string | null = null;
  quantity = 1;
  
  // Sistema de seleção de opções (apenas para ProductBundle)
  selections: { [groupId: number]: BundleOption[] } = {};
  
  // Seleções únicas para radio buttons (mapeia groupId -> option)
  singleSelections: { [groupId: number]: BundleOption | null } = {};
  
  // Preço calculado dinamicamente
  displayedPrice: number = 0;

  constructor(
    private comboService: ComboService,
    private cartService: CartService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const comboId = +params['id'];
      this.loadCombo(comboId);
    });
  }

  loadCombo(id: number): void {
    this.loading = true;
    this.error = null;
    this.selections = {};
    this.singleSelections = {};

    this.comboService.getCombo(id).subscribe({
      next: (combo) => {
        this.bundle = combo;
        
        // Se for ProductBundle, inicializar seleções vazias para cada grupo
        if (this.isProductBundle(combo) && combo.groups && Array.isArray(combo.groups)) {
          combo.groups.forEach((group: BundleGroup) => {
            this.selections[group.id] = [];
            this.singleSelections[group.id] = null;
          });
        }
        
        // Calcular preço inicial
        this.calculateTotal();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar combo:', error);
        this.error = 'Combo não encontrado';
        this.loading = false;
      }
    });
  }

  onAddToCart(): void {
    if (this.bundle && this.canAddToCart()) {
      // Se for ProductBundle, enviar com as seleções
      if ('groups' in this.bundle) {
        this.cartService.addBundleToCart(
          this.bundle as ProductBundle, 
          this.quantity, 
          this.selections
        );
      } else {
        // Se for Combo antigo, usar método antigo
        this.cartService.addComboToCart(this.bundle as Combo, this.quantity);
      }
    }
  }
  
  /**
   * Calcula o preço total do bundle baseado nas seleções
   */
  calculateTotal(): void {
    if (!this.bundle) {
      this.displayedPrice = 0;
      return;
    }
    
    // Se for ProductBundle, calcular com base_price + ajustes
    if ('base_price' in this.bundle) {
      let total = (this.bundle as ProductBundle).base_price || 0;
      
      // Somar price_adjustment de todas as opções selecionadas
      Object.values(this.selections).forEach(selectedOptions => {
        selectedOptions.forEach(option => {
          total += option.price_adjustment || 0;
        });
      });
      
      this.displayedPrice = total;
    } else {
      // Se for Combo antigo, usar price direto
      this.displayedPrice = (this.bundle as Combo).price || 0;
    }
  }
  
  /**
   * Valida se pode adicionar ao carrinho
   * Retorna true se todos os grupos obrigatórios tiverem o mínimo de seleções
   */
  canAddToCart(): boolean {
    if (!this.bundle || !('groups' in this.bundle)) {
      return true; // Combos antigos sempre podem ser adicionados
    }
    
    const bundle = this.bundle as ProductBundle;
    if (!bundle.groups || bundle.groups.length === 0) {
      return true;
    }
    
    // Verificar cada grupo obrigatório
    for (const group of bundle.groups) {
      if (group.is_required) {
        const selectedCount = this.selections[group.id]?.length || 0;
        if (selectedCount < group.min_selections) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Obtém a mensagem de validação para um grupo
   */
  getGroupValidationMessage(group: BundleGroup): string {
    const selectedCount = this.selections[group.id]?.length || 0;
    
    if (group.is_required && selectedCount < group.min_selections) {
      const remaining = group.min_selections - selectedCount;
      return `Selecione mais ${remaining} opção${remaining > 1 ? 'ões' : ''}`;
    }
    
    if (selectedCount >= group.max_selections) {
      return `Máximo de ${group.max_selections} opção${group.max_selections > 1 ? 'ões' : ''} selecionada${group.max_selections > 1 ? 's' : ''}`;
    }
    
    return '';
  }
  
  /**
   * Manipula seleção de opção (single selection via radio)
   */
  onRadioSelect(group: BundleGroup, option: BundleOption | null): void {
    this.singleSelections[group.id] = option;
    if (option) {
      this.selections[group.id] = [option];
    } else {
      this.selections[group.id] = [];
    }
    this.calculateTotal();
  }
  
  /**
   * Manipula seleção de opção (multiple selection via checkbox)
   */
  onCheckboxSelect(group: BundleGroup, option: BundleOption, checked: boolean): void {
    if (!this.selections[group.id]) {
      this.selections[group.id] = [];
    }
    
    if (checked) {
      // Adicionar se não exceder o máximo
      if (this.selections[group.id].length < group.max_selections) {
        this.selections[group.id].push(option);
      }
    } else {
      // Remover
      const index = this.selections[group.id].findIndex(opt => opt.id === option.id);
      if (index >= 0) {
        this.selections[group.id].splice(index, 1);
      }
    }
    
    this.calculateTotal();
  }
  
  /**
   * Obtém a opção selecionada para radio (single selection)
   */
  getSelectedOption(group: BundleGroup): BundleOption | null {
    const selected = this.selections[group.id];
    if (selected && selected.length > 0) {
      return selected[0];
    }
    return null;
  }
  
  /**
   * Obtém a imagem do produto selecionado em um grupo
   */
  getSelectedProductImage(group: BundleGroup): string {
    const selected = this.getSelectedOption(group);
    if (selected && selected.product) {
      return this.getProductImage(selected.product);
    }
    return '/assets/images/no-image.jpg';
  }
  
  /**
   * Manipula mudança no dropdown (mat-select)
   */
  onDropdownChange(group: BundleGroup, option: BundleOption | null): void {
    if (option) {
      this.onRadioSelect(group, option);
    } else {
      this.onRadioSelect(group, null);
    }
  }
  
  /**
   * Verifica se uma opção está selecionada
   */
  isOptionSelected(group: BundleGroup, option: BundleOption): boolean {
    if (!this.selections[group.id]) {
      return false;
    }
    return this.selections[group.id].some(opt => opt.id === option.id);
  }
  
  /**
   * Obtém o texto de instrução do grupo
   */
  getGroupInstruction(group: BundleGroup): string {
    if (group.selection_type === 'single' || group.max_selections === 1) {
      return group.is_required ? 'Escolha 1' : 'Escolha até 1 (opcional)';
    }
    
    if (group.min_selections === group.max_selections) {
      return `Escolha ${group.min_selections}`;
    }
    
    if (group.min_selections === 0) {
      return `Escolha até ${group.max_selections} (opcional)`;
    }
    
    return `Escolha de ${group.min_selections} até ${group.max_selections}`;
  }

  incrementQuantity(): void {
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  getComboImage(combo: Combo | ProductBundle): string {
    if (combo.images && combo.images.length > 0) {
      const imageUrl = combo.images[0];
      
      // Se já é uma URL completa, retornar como está
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      
      // Se começa com /storage/ ou storage/, adicionar base URL da API
      if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${base}${path}`;
      }
      
      // Caso contrário, retornar como está
      return imageUrl;
    }
    return '/assets/images/default-combo.jpg';
  }

  formatPrice(price: number | null | undefined): string {
    if (price === null || price === undefined || isNaN(price)) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getDiscountPercentage(combo: Combo | ProductBundle): number {
    const price = this.getComboPrice(combo);
    if (combo.original_price && combo.original_price > price && price > 0) {
      return Math.round(((combo.original_price - price) / combo.original_price) * 100);
    }
    return 0;
  }
  
  getComboPrice(combo: Combo | ProductBundle): number {
    if ('base_price' in combo) {
      return (combo as ProductBundle).base_price || 0;
    }
    return (combo as Combo).price || 0;
  }
  
  getOriginalPrice(combo: Combo | ProductBundle): number {
    return combo.original_price || 0;
  }

  /**
   * Verifica se é ProductBundle
   */
  isProductBundle(bundle: Combo | ProductBundle): bundle is ProductBundle {
    return 'groups' in bundle;
  }
  
  /**
   * Obtém todos os produtos incluídos no bundle (para exibição)
   */
  getAllIncludedProducts(): Array<{ product: any; quantity: number; sale_type: string }> {
    if (!this.bundle) {
      return [];
    }
    
    // Se for ProductBundle, coletar produtos de todas as opções
    if (this.isProductBundle(this.bundle) && this.bundle.groups) {
      const products: Array<{ product: any; quantity: number; sale_type: string }> = [];
      
      this.bundle.groups.forEach(group => {
        if (group.options) {
          group.options.forEach(option => {
            if (option.product) {
              products.push({
                product: option.product,
                quantity: option.quantity,
                sale_type: option.sale_type
              });
            }
          });
        }
      });
      
      return products;
    }
    
    // Se for Combo antigo, usar products direto
    if ('products' in this.bundle && this.bundle.products) {
      return this.bundle.products.map(p => ({
        product: p.product || p,
        quantity: p.pivot?.quantity || p.quantity || 1,
        sale_type: p.pivot?.sale_type || p.sale_type || 'garrafa'
      }));
    }
    
    return [];
  }
  
  getProductName(product: any): string {
    return product.name || 'Produto';
  }

  getProductPrice(product: any): number {
    return product.price || 0;
  }

  getProductQuantity(item: { quantity: number }): number {
    return item.quantity || 1;
  }

  getProductUnit(item: { sale_type: string }): string {
    const saleType = item.sale_type || 'garrafa';
    return saleType === 'dose' ? 'dose(s)' : 'unidade(s)';
  }

  getProductImage(product: any): string {
    if (!product) {
      return '/assets/images/no-image.jpg';
    }
    
    const imageUrl = product.image_url || product.images?.[0];
    if (!imageUrl) {
      return '/assets/images/no-image.jpg';
    }
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}`;
    }
    
    return imageUrl;
  }
}
