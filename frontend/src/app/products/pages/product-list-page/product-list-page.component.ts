import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
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
  loading = true;
  loadingCombos = true;
  selectedCategory: number | null = null;
  searchTerm: string = '';
  error: string | null = null;
  
  // Agrupamento por categoria
  productsByCategory: { category: Category; products: Product[] }[] = [];
  
  private cartSubscription?: Subscription;
  private cartItemsCache: any[] = [];

  constructor(
    private productService: ProductService,
    private comboService: ComboService,
    private cartService: CartService,
    private route: ActivatedRoute,
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
    this.loadCategories();
    this.loadCombos();
    
    // Observar itens do carrinho para manter cache atualizado
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItemsCache = items;
      this.cdr.detectChanges(); // Forçar atualização da view
    });
    
    this.route.queryParams.subscribe(params => {
      this.selectedCategory = params['categoria'] ? +params['categoria'] : null;
      this.searchTerm = params['busca'] || '';
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  loadCategories(): void {
    this.productService.getCategories().subscribe({
      next: (categories) => {
        // Filtrar categoria "Combos" da lista
        this.categories = categories.filter(
          cat => cat.name.toLowerCase() !== 'combos' && cat.slug.toLowerCase() !== 'combos'
        );
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  loadCombos(): void {
    this.loadingCombos = true;
    this.comboService.getCombos({ per_page: 20 }).subscribe({
      next: (response) => {
        this.combos = response.data || [];
        this.loadingCombos = false;
      },
      error: (err) => {
        console.error('Error loading combos:', err);
        this.loadingCombos = false;
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
      sku: combo.sku,
      barcode: combo.barcode,
      is_active: combo.is_active,
      featured: combo.featured,
      offers: combo.offers,
      popular: combo.popular,
      images: combo.images,
      image_url: combo.images?.[0] || undefined
    } as Product;
  }

  loadProducts(): void {
    const params: any = {};
    
    if (this.selectedCategory) {
      params.category_id = this.selectedCategory;
    }
    
    // Não usar search no backend, vamos filtrar localmente para tempo real
    // if (this.searchTerm) {
    //   params.search = this.searchTerm;
    // }

    this.loading = true;
    this.error = null;

    this.productService.getProducts(params).subscribe({
      next: (response) => {
        this.products = response.data || [];
        this.filterAndGroupProducts();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = 'Erro ao carregar produtos. Por favor, tente novamente.';
        this.loading = false;
      }
    });
  }

  filterAndGroupProducts(): void {
    // Filtrar produtos por termo de busca
    let filtered = this.products;
    
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = this.products.filter(product => 
        product.name.toLowerCase().includes(term) ||
        (product.description && product.description.toLowerCase().includes(term))
      );
    }
    
    this.filteredProducts = filtered;
    
    // Agrupar por categoria
    const grouped = new Map<number, { category: Category; products: Product[] }>();
    
    filtered.forEach(product => {
      const categoryId = product.category_id;
      const category = this.categories.find(c => c.id === categoryId);
      
      if (category) {
        if (!grouped.has(categoryId)) {
          grouped.set(categoryId, { category, products: [] });
        }
        grouped.get(categoryId)!.products.push(product);
      }
    });
    
    // Converter Map para Array e ordenar por nome da categoria
    this.productsByCategory = Array.from(grouped.values()).sort((a, b) => 
      a.category.name.localeCompare(b.category.name)
    );
  }

  onCategoryChange(categoryId: number | null): void {
    this.selectedCategory = categoryId;
    this.loadProducts();
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.filterAndGroupProducts();
  }

  addToCart(product: Product): void {
    const currentQuantity = this.getQuantity(product);
    this.cartService.addItem(product);
    
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
        progressBar: false
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
    if (currentQuantity >= product.current_stock) {
      return;
    }
    
    this.cartService.addItem(product);
    
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
        progressBar: false
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

  addComboToCart(combo: Combo): void {
    const product = this.comboAdapter(combo);
    const currentQuantity = this.getQuantity(product);
    this.cartService.addComboToCart(combo, 1);
    
    // Mostrar notificação apenas quando a quantidade for de 0 para 1 (primeira adição)
    if (currentQuantity === 0) {
      const comboName = combo.name;
      const isFeminine = comboName.toLowerCase().endsWith('a') || 
                         comboName.toLowerCase().endsWith('ão') ||
                         comboName.toLowerCase().endsWith('ade');
      const message = isFeminine ? `${comboName} adicionado!` : `${comboName} adicionado!`;
      
      this.toastr.success(message, '', {
        timeOut: 1500,
        positionClass: 'toast-bottom-center',
        progressBar: false
      });
    }
    
    this.cdr.detectChanges();
  }
}