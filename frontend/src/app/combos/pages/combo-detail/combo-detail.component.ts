import { Component, OnInit, ViewChildren, QueryList, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastrService } from 'ngx-toastr';
import { ProductBundle, BundleGroup, BundleOption } from '../../../core/models/product-bundle.model';
import { Product } from '../../../core/models/product.model';
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
    MatExpansionModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule
  ]
})
export class ComboDetailComponent implements OnInit, AfterViewInit {
  @ViewChildren(MatExpansionPanel) panels!: QueryList<MatExpansionPanel>;
  
  bundle: ProductBundle | null = null;
  loading = true;
  error: string | null = null;
  quantity = 1;
  observations = '';
  
  // Sistema de seleção de opções
  selections: { [groupId: number]: BundleOption[] } = {};
  
  // Preço calculado dinamicamente
  displayedPrice: number = 0;
  
  // Controle de inicialização: evita auto-avanço durante o carregamento
  private isInitializing: boolean = true;

  constructor(
    private comboService: ComboService,
    private cartService: CartService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const comboId = +params['id'];
      this.loadCombo(comboId);
    });
  }

  ngAfterViewInit(): void {
    // Não inicializar aqui - será feito após o carregamento do combo em loadCombo()
    // Isso evita conflito e garante que os dados já estejam carregados
  }

  /**
   * Inicializa os painéis: abre apenas o primeiro grupo por padrão
   */
  initializePanels(): void {
    if (!this.bundle || !this.bundle.groups) return;
    
    // Fechar todos os painéis primeiro
    this.panels.forEach(panel => {
      panel.close();
    });
    
    // Abrir apenas o primeiro painel (índice 0)
    const firstPanel = this.panels.first;
    if (firstPanel) {
      firstPanel.open();
    }
    
    // Marcar inicialização como concluída após um pequeno delay
    setTimeout(() => {
      this.isInitializing = false;
    }, 300);
    
    this.cdr.detectChanges();
  }

  loadCombo(id: number): void {
    this.loading = true;
    this.error = null;
    this.selections = {};
    this.quantity = 1;
    this.observations = '';
    // Resetar flag de inicialização ao carregar novo combo
    this.isInitializing = true;

    this.comboService.getCombo(id).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        
        // Inicializar seleções vazias para cada grupo
        if (this.bundle.groups && Array.isArray(this.bundle.groups)) {
          this.bundle.groups.forEach((group: BundleGroup) => {
            this.selections[group.id] = [];
          });
        }
        
        // Calcular preço inicial
        this.calculateTotal();
        this.loading = false;
        
        // Inicializar painéis após a view ser atualizada
        setTimeout(() => {
          this.initializePanels();
        }, 100);
      },
      error: (error) => {
        console.error('Erro ao carregar combo:', error);
        this.error = 'Combo não encontrado';
        this.loading = false;
        this.isInitializing = false;
      }
    });
  }

  onAddToCart(): void {
    if (!this.bundle) {
      return;
    }

    if (!this.canAddToCart()) {
      this.toastr.warning('Complete todas as seleções obrigatórias antes de adicionar ao carrinho', 'Seleções Incompletas', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }

    // Garantir que o preço está calculado e é um número válido
    this.calculateTotal();
    const finalPrice = parseFloat(String(this.displayedPrice || 0));
    
    if (isNaN(finalPrice)) {
      console.error('Preço inválido calculado:', this.displayedPrice);
      this.toastr.error('Erro ao calcular preço do combo. Tente novamente.', 'Erro', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }

    // Validar que o bundle tem todas as propriedades necessárias
    if (!this.bundle.id || !this.bundle.name) {
      console.error('Bundle incompleto:', this.bundle);
      this.toastr.error('Dados do combo incompletos. Tente recarregar a página.', 'Erro', {
        toastClass: 'modern-toast-notification',
        positionClass: 'toast-bottom-center',
        timeOut: 3000
      });
      return;
    }

    this.cartService.addBundleToCart(
      this.bundle,
      this.quantity,
      this.selections
    );

    this.toastr.success(`${this.bundle.name} adicionado ao carrinho!`, '', {
      toastClass: 'modern-toast-notification',
      positionClass: 'toast-bottom-center',
      timeOut: 2000
    });
  }
  
  /**
   * Calcula o preço total do bundle baseado nas seleções
   */
  calculateTotal(): void {
    if (!this.bundle) {
      this.displayedPrice = 0;
      return;
    }
    
    // Preço base: se for fixed, usar base_price; se calculated, começar de 0
    let total = 0;
    if (this.bundle.pricing_type === 'fixed') {
      total = parseFloat(String(this.bundle.base_price || 0));
    } else {
      // Para calculated, o preço é calculado apenas pelas opções
      total = 0;
    }
    
    // Somar price_adjustment de todas as opções selecionadas
    Object.values(this.selections).forEach(selectedOptions => {
      selectedOptions.forEach(option => {
        total += parseFloat(String(option.price_adjustment || 0));
      });
    });
    
    this.displayedPrice = total;
  }

  /**
   * Verifica se pode adicionar ao carrinho
   */
  canAddToCart(): boolean {
    if (!this.bundle || !this.bundle.groups || this.bundle.groups.length === 0) {
      return true;
    }
    
    // Verificar cada grupo obrigatório
    for (const group of this.bundle.groups) {
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
   * Getter: Verifica se um grupo está válido/completo
   */
  isGroupValid(group: BundleGroup): boolean {
    const selectedCount = this.selections[group.id]?.length || 0;
    
    if (group.is_required) {
      return selectedCount >= group.min_selections && selectedCount <= group.max_selections;
    }
    
    return selectedCount <= group.max_selections;
  }

  /**
   * Getter: Obtém a mensagem de validação para um grupo
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
   * Manipula clique no card da opção (UX melhorada)
   */
  onOptionItemClick(group: BundleGroup, option: BundleOption, event: Event): void {
    // Se o clique foi no controle, não fazer nada (já foi tratado)
    const target = event.target as HTMLElement;
    if (target.closest('.option-control') || target.closest('button') || target.closest('mat-radio-button')) {
      return;
    }

    // Para seleção única (radio)
    if (group.max_selections === 1) {
      const currentSelected = this.getSelectedOption(group);
      if (currentSelected?.id === option.id) {
        // Se já está selecionado e não é obrigatório, desmarcar
        if (!group.is_required) {
          this.onRadioSelect(group, null);
        }
      } else {
        this.onRadioSelect(group, option);
      }
    } else {
      // Para seleção múltipla (toggle)
      const isSelected = this.isOptionSelected(group, option);
      this.onCheckboxSelect(group, option, !isSelected);
    }
  }

  /**
   * Manipula seleção de opção (single selection via radio)
   */
  onRadioSelect(group: BundleGroup, option: BundleOption | null): void {
    if (option) {
      this.selections[group.id] = [option];
    } else {
      this.selections[group.id] = [];
    }
    this.calculateTotal();
    
    // Verificar se o grupo foi completado e avançar para o próximo
    setTimeout(() => {
      this.checkAndAdvanceGroup(group);
    }, 200);
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
      } else {
        // Reverter o checkbox se exceder
        return;
      }
    } else {
      // Remover
      const index = this.selections[group.id].findIndex(opt => opt.id === option.id);
      if (index >= 0) {
        this.selections[group.id].splice(index, 1);
      }
    }
    
    this.calculateTotal();
    
    // Verificar se o grupo foi completado e avançar para o próximo
    setTimeout(() => {
      this.checkAndAdvanceGroup(group);
    }, 200);
  }

  /**
   * Manipula contador de quantidade para múltiplas seleções
   */
  onQuantityChange(group: BundleGroup, option: BundleOption, delta: number): void {
    if (!this.selections[group.id]) {
      this.selections[group.id] = [];
    }

    const currentCount = this.getOptionQuantity(group, option);
    const newCount = currentCount + delta;

    if (newCount <= 0) {
      // Remover todas as instâncias da opção
      this.selections[group.id] = this.selections[group.id].filter(opt => opt.id !== option.id);
    } else {
      // Verificar se não excede o máximo total do grupo
      const otherOptionsCount = this.selections[group.id]
        .filter(opt => opt.id !== option.id)
        .length;
      const totalSelected = otherOptionsCount + newCount;

      if (totalSelected <= group.max_selections) {
        // Remover todas as instâncias atuais desta opção
        this.selections[group.id] = this.selections[group.id].filter(opt => opt.id !== option.id);
        
        // Adicionar a nova quantidade
        for (let i = 0; i < newCount; i++) {
          this.selections[group.id].push(option);
        }
      }
    }

    this.calculateTotal();
    
    // Verificar se o grupo foi completado e avançar para o próximo
    setTimeout(() => {
      this.checkAndAdvanceGroup(group);
    }, 200);
  }

  /**
   * Verifica se um grupo obrigatório foi completado e avança para o próximo painel
   */
  checkAndAdvanceGroup(completedGroup: BundleGroup): void {
    // Guard clause: não avançar durante a inicialização
    if (this.isInitializing) return;
    
    if (!this.bundle || !this.bundle.groups) return;
    
    const groupIndex = this.bundle.groups.findIndex(g => g.id === completedGroup.id);
    if (groupIndex === -1) return;
    
    // Verificar se o grupo obrigatório foi completado (tem pelo menos min_selections)
    const isRequired = completedGroup.is_required;
    const currentSelections = this.selections[completedGroup.id] || [];
    const isCompleted = currentSelections.length >= completedGroup.min_selections;
    
    if (isRequired && isCompleted) {
      // Fechar o painel atual após um pequeno delay
      setTimeout(() => {
        const currentPanel = this.panels.toArray()[groupIndex];
        if (currentPanel && currentPanel.expanded) {
          currentPanel.close();
        }
        
        // Abrir o próximo painel que ainda não foi preenchido
        this.openNextIncompletePanel(groupIndex);
      }, 200);
    }
  }

  /**
   * Abre o próximo painel que ainda não foi preenchido
   */
  openNextIncompletePanel(currentIndex: number): void {
    if (!this.bundle || !this.bundle.groups) return;
    
    const panelsArray = this.panels.toArray();
    
    // Procurar o próximo grupo que ainda não foi preenchido
    for (let i = currentIndex + 1; i < this.bundle.groups.length; i++) {
      const group = this.bundle.groups[i];
      const panel = panelsArray[i];
      
      if (!panel) continue;
      
      const currentSelections = this.selections[group.id] || [];
      const isCompleted = currentSelections.length >= group.min_selections;
      
      // Se o grupo não foi completado, abrir o painel
      if (!isCompleted) {
        panel.open();
        // Scroll suave até o painel
        setTimeout(() => {
          const element = panel._body?.nativeElement;
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            // Fallback: usar o elemento do DOM diretamente
            const panelElement = document.querySelector(`[id="${group.id}"]`) || 
                                 document.querySelector(`mat-expansion-panel:nth-child(${i + 1})`);
            if (panelElement) {
              panelElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }, 100);
        break;
      }
    }
  }

  /**
   * Obtém a quantidade selecionada de uma opção
   */
  getOptionQuantity(group: BundleGroup, option: BundleOption): number {
    if (!this.selections[group.id]) {
      return 0;
    }
    return this.selections[group.id].filter(opt => opt.id === option.id).length;
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
   * Verifica se uma opção está selecionada
   */
  isOptionSelected(group: BundleGroup, option: BundleOption): boolean {
    if (!this.selections[group.id]) {
      return false;
    }
    return this.selections[group.id].some(opt => opt.id === option.id);
  }

  /**
   * Verifica se pode selecionar mais opções no grupo
   */
  canSelectMore(group: BundleGroup): boolean {
    const selectedCount = this.selections[group.id]?.length || 0;
    return selectedCount < group.max_selections;
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

  /**
   * Verifica se o painel deve estar aberto por padrão
   * Retorna true apenas para o primeiro grupo (índice 0)
   */
  isPanelExpanded(group: BundleGroup): boolean {
    if (!this.bundle || !this.bundle.groups) return false;
    
    // Retornar true apenas para o primeiro grupo
    const groupIndex = this.bundle.groups.findIndex(g => g.id === group.id);
    return groupIndex === 0;
  }

  incrementQuantity(): void {
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  /**
   * Obtém a imagem do bundle/combo
   */
  getBundleImage(bundle: ProductBundle): string {
    if (bundle.images && bundle.images.length > 0) {
      const imageUrl = bundle.images[0];
      
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
    return 'assets/images/default-combo.jpg';
  }

  /**
   * Obtém a imagem de um produto
   */
  getProductImage(product: Product | undefined): string {
    if (!product) {
      return 'assets/images/no-image.jpg';
    }
    
    const imageUrl = (product as any).image_url || product.images?.[0];
    if (!imageUrl) {
      return 'assets/images/no-image.jpg';
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

  formatPrice(price: number | null | undefined): string {
    if (price === null || price === undefined || isNaN(price)) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getTotalPrice(): number {
    return this.displayedPrice * this.quantity;
  }

  getDiscountPercentage(bundle: ProductBundle): number {
    if (bundle.original_price && bundle.original_price > (bundle.base_price || 0) && (bundle.base_price || 0) > 0) {
      return Math.round(((bundle.original_price - (bundle.base_price || 0)) / bundle.original_price) * 100);
    }
    return 0;
  }

  trackByGroupId(index: number, group: BundleGroup): number {
    return group.id;
  }

  trackByOptionId(index: number, option: BundleOption): number {
    return option.id;
  }
}
