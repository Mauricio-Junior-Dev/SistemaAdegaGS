import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ProductService } from '../../../core/services/product.service';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Category } from '../../../core/models/product.model';
import { Combo } from '../../../core/models/combo.model';
import { environment } from '../../../../environments/environment';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-product-list-page',
  templateUrl: './product-list-page.component.html',
  styleUrls: ['./product-list-page.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class ProductListPageComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];
  combos: Combo[] = [];
  filteredCombos: Combo[] = []; // Combos filtrados pela busca
  loading = true;
  loadingCombos = true;
  selectedCategory: number | null = null;
  searchTerm: string = '';
  error: string | null = null;
  
  // Agrupamento por categoria (derivado de menuData + filtros)
  productsByCategory: { category: Category; products: Product[] }[] = [];

  /** Dados do cardápio: categorias com produtos (endpoint /categories/menu) */
  menuData: { category: Category; products: Product[] }[] = [];

  /** Prateleiras limitadas: exibir apenas os primeiros N produtos por categoria até "Ver todos" */
  readonly limitPerCategory = 8;

  private cartSubscription?: Subscription;
  private cartItemsCache: any[] = [];

  constructor(
    private productService: ProductService,
    private comboService: ComboService,
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService
  ) {}

  getCategoryImageUrl(category: Category): string {
    if (!category.image_url) {
      return 'assets/images/no-image.jpg';
    }
    
    if (category.image_url.startsWith('http://') || category.image_url.startsWith('https://')) {
      return category.image_url;
    }
    
    // Resolve relative paths to absolute URLs with cache-busting
    const base = environment.apiUrl.replace(/\/api$/, '');
    const path = category.image_url.startsWith('/') ? category.image_url : `/${category.image_url}`;
    const cacheBuster = category.updated_at ? `?v=${category.updated_at}` : '';
    
    return `${base}${path}${cacheBuster}`;
  }

  ngOnInit(): void {
    this.loadCombos();

    // Observar itens do carrinho para manter cache atualizado
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItemsCache = items;
      this.cdr.detectChanges(); // Forçar atualização da view
    });

    this.route.queryParams.subscribe(params => {
      this.selectedCategory = params['categoria'] ? +params['categoria'] : null;
      this.searchTerm = params['busca'] || '';
      if (this.menuData.length > 0) {
        this.applyMenuFilters();
      } else {
        this.loadMenu();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  loadCombos(): void {
    this.loadingCombos = true;
    this.comboService.getCombos({ per_page: 20 }).subscribe({
      next: (response) => {
        this.combos = response.data || [];
        this.filteredCombos = this.combos;
        this.applyMenuFilters(); // Atualiza combos filtrados por busca
        this.loadingCombos = false;
      },
      error: (err) => {
        console.error('Error loading combos:', err);
        this.loadingCombos = false;
      }
    });
  }

  /** Carrega o cardápio (categorias com produtos) do endpoint /categories/menu. */
  loadMenu(): void {
    this.loading = true;
    this.error = null;
    this.productService.getCategoriesWithProducts().subscribe({
      next: (data) => {
        this.menuData = data;
        this.categories = data.map(g => g.category);
        this.applyMenuFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading menu:', err);
        this.error = 'Erro ao carregar cardápio. Por favor, tente novamente.';
        this.loading = false;
      }
    });
  }

  comboAdapter(combo: Combo): Product {
    // Mapear combo para formato de Product para usar os mesmos cards
    return {
      id: combo.id,
      category_id: 0, // Combos não têm categoria
      name: combo.name,
      slug: combo.slug || '',
      description: combo.description,
      price: combo.price,
      original_price: combo.original_price,
      cost_price: combo.price,
      current_stock: 999, // Combos sempre disponíveis
      min_stock: 0,
      doses_por_garrafa: 0,
      doses_vendidas: 0,
      can_sell_by_dose: false,
      barcode: combo.barcode,
      is_active: combo.is_active,
      featured: combo.featured,
      offers: combo.offers,
      popular: combo.popular,
      images: combo.images,
      image_url: combo.images?.[0] || undefined
    } as Product;
  }

  /**
   * Normaliza string removando acentos e convertendo para minúsculas.
   */
  private normalizeString(str: string): string {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Aplica filtros (busca + categoria) em menuData e combos; atualiza productsByCategory e filteredCombos.
   */
  applyMenuFilters(): void {
    const term = this.searchTerm.trim();
    const normalizedSearch = term ? this.normalizeString(term) : '';

    // Filtrar combos por busca
    if (normalizedSearch) {
      this.filteredCombos = this.combos.filter(combo => {
        const name = this.normalizeString(combo.name);
        const desc = combo.description ? this.normalizeString(combo.description) : '';
        return name.includes(normalizedSearch) || desc.includes(normalizedSearch);
      });
    } else {
      this.filteredCombos = this.combos;
    }

    if (this.menuData.length === 0) {
      this.productsByCategory = [];
      return;
    }

    let groups = this.menuData.map(g => {
      const filteredProducts = term
        ? g.products.filter(p => {
            const name = this.normalizeString(p.name);
            const desc = p.description ? this.normalizeString(p.description) : '';
            return name.includes(normalizedSearch) || desc.includes(normalizedSearch);
          })
        : g.products;

      // Ordenar produtos da categoria: disponíveis primeiro, depois esgotados, e então por nome
      const sortedProducts = [...filteredProducts].sort((a, b) => {
        const aDisponivel = (a.effective_stock ?? a.current_stock) > 0 ? 1 : 0;
        const bDisponivel = (b.effective_stock ?? b.current_stock) > 0 ? 1 : 0;

        if (aDisponivel !== bDisponivel) {
          // Produtos disponíveis (1) devem vir antes dos esgotados (0)
          return bDisponivel - aDisponivel;
        }

        return a.name.localeCompare(b.name);
      });

      return {
        category: g.category,
        products: sortedProducts,
      };
    });

    if (this.selectedCategory != null) {
      groups = groups.filter(g => g.category.id === this.selectedCategory);
    }

    // Não exibir categorias vazias: manter apenas grupos com pelo menos 1 produto após o filtro
    groups = groups.filter(g => g.products && g.products.length > 0);

    this.productsByCategory = groups.sort((a, b) =>
      a.category.name.localeCompare(b.category.name)
    );
  }

  onCategoryChange(categoryId: number | null): void {
    this.router.navigate(['/produtos'], {
      queryParams: categoryId != null ? { categoria: categoryId } : {},
    });
  }

  /** Indica se a categoria está em foco (filtro ativo = mostrando só essa categoria). */
  isCategoryFocused(category: Category): boolean {
    return this.selectedCategory === category.id;
  }

  /** Foca na categoria: filtra para mostrar apenas os produtos dessa categoria. */
  focusCategory(categoryId: number): void {
    this.router.navigate(['/produtos'], { queryParams: { categoria: categoryId } });
  }

  /** Voltar para o cardápio completo (remove filtro de categoria). */
  backToFullMenu(): void {
    this.router.navigate(['/produtos'], { queryParams: {} });
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.applyMenuFilters();
  }

  addToCart(product: Product): void {
    // Verificar se é um bundle (ProductBundle) - tem groups ou bundle_type
    const isBundle = (product as any).groups !== undefined || 
                     (product as any).bundle_type !== undefined;
    
    // Verificar se é um combo adaptado (category_id === 0 e não tem doses_por_garrafa)
    const isCombo = product.category_id === 0 && 
                    product.doses_por_garrafa === 0 && 
                    product.current_stock === 999;
    
    if (isBundle || isCombo) {
      // Para bundles/combos, redirecionar para a página de detalhes
      // O usuário precisa escolher as opções antes de adicionar ao carrinho
      this.router.navigate(['/combos', product.id]);
      return;
    }
    
    const currentQuantity = this.getQuantity(product);
    // No e-commerce, sempre usar delivery_price se disponível
    const priceToUse = product.delivery_price ?? product.price;
    this.cartService.addItem(product, 1, priceToUse);
    
    // Mostrar notificação apenas quando a quantidade for de 0 para 1 (primeira adição)
    if (currentQuantity === 0) {
      const productName = product.name;
      const isFeminine = productName.toLowerCase().endsWith('a') || 
                         productName.toLowerCase().endsWith('ão') ||
                         productName.toLowerCase().endsWith('ade');
      const message = isFeminine ? `${productName} adicionada!` : `${productName} adicionado!`;
      
      this.toastr.success(message, '', {
        timeOut: 1500,
        positionClass: 'toast-bottom-center',
        progressBar: false,
        toastClass: 'modern-toast-notification'
      });
    }
    
    // Não abrir o carrinho automaticamente - o usuário decide quando ver o carrinho
  }

  getQuantity(product: Product): number {
    const item = this.cartItemsCache.find(item => item.id === product.id);
    return item ? item.quantity : 0;
  }

  increase(product: Product): void {
    const currentQuantity = this.getQuantity(product);
    
    // Validação de estoque
    const maxStock = product.effective_stock ?? product.current_stock;
    if (currentQuantity >= maxStock) {
      return;
    }
    
    // No e-commerce, sempre usar delivery_price se disponível
    const priceToUse = product.delivery_price ?? product.price;
    this.cartService.addItem(product, 1, priceToUse);
    
    // Mostrar notificação apenas quando a quantidade for de 0 para 1 (primeira adição)
    if (currentQuantity === 0) {
      const productName = product.name;
      const isFeminine = productName.toLowerCase().endsWith('a') || 
                         productName.toLowerCase().endsWith('ão') ||
                         productName.toLowerCase().endsWith('ade');
      const message = isFeminine ? `${productName} adicionada!` : `${productName} adicionado!`;
      
      this.toastr.success(message, '', {
        timeOut: 1500,
        positionClass: 'toast-bottom-center',
        progressBar: false,
        toastClass: 'modern-toast-notification'
      });
    }
    
    // A subscription no ngOnInit já atualiza o cache automaticamente
    this.cdr.detectChanges();
  }

  decrease(product: Product): void {
    const quantity = this.getQuantity(product);
    if (quantity > 1) {
      this.cartService.updateQuantity(product.id, quantity - 1);
    } else {
      this.cartService.removeItem(product.id);
    }
    // A subscription no ngOnInit já atualiza o cache automaticamente
    this.cdr.detectChanges();
  }

  increaseQuantity(product: Product): void {
    this.increase(product);
  }

  decreaseQuantity(product: Product): void {
    this.decrease(product);
  }

  getImageUrl(product: Product): string {
    const imageUrl = (product as any).image_url as string | undefined;
    if (imageUrl) {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return `${imageUrl}?v=${encodeURIComponent(product.updated_at as any)}`;
      }
      if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${base}${path}?v=${encodeURIComponent(product.updated_at as any)}`;
      }
      return `${imageUrl}?v=${encodeURIComponent(product.updated_at as any)}`;
    }
    const first = (product as any).images?.[0];
    if (first) return first;
    return 'assets/images/no-image.jpg';
  }

  hasOffer(product: Product): boolean {
    // Verifica se há um preço original maior que o preço atual
    const originalPrice = (product as any).original_price;
    return originalPrice && originalPrice > product.price;
  }

  getOriginalPrice(product: Product): number {
    return (product as any).original_price || product.price;
  }

  getDiscountPercentage(product: Product): number {
    const originalPrice = (product as any).original_price;
    if (!originalPrice || originalPrice <= product.price) return 0;
    return Math.round(((originalPrice - product.price) / originalPrice) * 100);
  }

  /**
   * Redireciona para a tela de detalhes do combo (Montar).
   * Combos não devem ser adicionados direto ao carrinho; o usuário escolhe as opções na tela de detalhes.
   */
  goToComboDetails(combo: Combo | { id: number; name?: string }): void {
    this.router.navigate(['/combos', combo.id]);
  }

  /**
   * Preço do combo para exibição: base_price (ProductBundle) ou price (Combo).
   */
  getComboPrice(combo: Combo | { base_price?: number; price?: number }): number {
    const base = (combo as any).base_price;
    if (base != null && !isNaN(Number(base))) return Number(base);
    return (combo as Combo).price ?? 0;
  }
}