import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { ComboService } from '../../../core/services/combo.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Category } from '../../../core/models/product.model';
import { Combo } from '../../../core/models/combo.model';
import { BannerCarouselComponent, Banner } from '../../../shared/components/banner-carousel/banner-carousel.component';
import { BannerService } from '../../../core/services/banner.service';
import { ComboCardComponent } from '../../../shared/components/combo-card/combo-card.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, BannerCarouselComponent, ComboCardComponent, ProductCardComponent]
})
export class HomeComponent implements OnInit {
  categories: Category[] = [];
  featuredProducts: Product[] = [];
  popularProducts: Product[] = [];
  featuredCombos: Combo[] = [];
  banners: Banner[] = [];
  selectedCategory: number | null = null; // Categoria ativa para destaque visual
  filteredProducts: Product[] = []; // Produtos filtrados exibidos na grade
  sectionTitle: string = 'Destaques'; // Título da seção de produtos
  isLoadingProducts: boolean = false; // Loading para filtro de produtos
  skeletonItems = new Array(6); // Array para gerar 6 placeholders de skeleton
  currentPage: number = 1; // Página atual da paginação
  lastPage: number = 1; // Última página disponível
  loading = {
    categories: true,
    featured: true,
    popular: true,
    banners: true,
    combos: true
  };
  error = {
    categories: null as string | null,
    featured: null as string | null,
    popular: null as string | null,
    banners: null as string | null,
    combos: null as string | null,
    filtered: null as string | null
  };

  constructor(
    private productService: ProductService,
    private comboService: ComboService,
    private cartService: CartService,
    private bannerService: BannerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadFeaturedProducts();
    this.loadPopularProducts();
    this.loadFeaturedCombos();
    this.loadBanners();
  }

  loadCategories(): void {
    this.loading.categories = true;
    this.error.categories = null;

    this.productService.getCategories().subscribe({
      next: (categories) => {
        // Filtrar categoria "Combos" do menu pílula
        this.categories = categories.filter(
          cat => cat.name.toLowerCase() !== 'combos' && cat.slug.toLowerCase() !== 'combos'
        );
        this.loading.categories = false;
      },
      error: (error) => {
        console.error('Erro ao carregar categorias:', error);
        this.error.categories = 'Erro ao carregar categorias';
        this.loading.categories = false;
      }
    });
  }

  loadFeaturedProducts(): void {
    this.loading.featured = true;
    this.error.featured = null;

    this.productService.getFeaturedProducts().subscribe({
      next: (products) => {
        this.featuredProducts = products;
        // Se não há categoria selecionada, carregar produtos com paginação
        if (this.selectedCategory === null) {
          this.loadAllProducts(1);
        }
        this.loading.featured = false;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos em destaque:', error);
        this.error.featured = 'Erro ao carregar produtos em destaque';
        this.loading.featured = false;
      }
    });
  }

  loadPopularProducts(): void {
    this.loading.popular = true;
    this.error.popular = null;

    this.productService.getPopularProducts().subscribe({
      next: (products) => {
        this.popularProducts = products;
        this.loading.popular = false;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos populares:', error);
        this.error.popular = 'Erro ao carregar produtos populares';
        this.loading.popular = false;
      }
    });
  }

  loadFeaturedCombos(): void {
    this.loading.combos = true;
    this.error.combos = null;

    this.comboService.getFeaturedCombos().subscribe({
      next: (combos) => {
        this.featuredCombos = combos;
        this.loading.combos = false;
      },
      error: (error) => {
        console.error('Erro ao carregar combos em destaque:', error);
        this.error.combos = 'Erro ao carregar combos em destaque';
        this.loading.combos = false;
      }
    });
  }

  addToCart(product: Product): void {
    // Verificar se é um combo adaptado (category_id === 0 e não tem doses_por_garrafa)
    if (product.category_id === 0 && product.doses_por_garrafa === 0 && product.current_stock === 999) {
      // É um combo, buscar o combo original
      const combo = this.featuredCombos.find(c => c.id === product.id);
      if (combo) {
        this.cartService.addComboToCart(combo, 1);
        return;
      }
    }
    // Para produtos normais, o product-card já adiciona diretamente
    // Este método só é chamado para combos ou casos especiais
    // Não adicionar novamente para evitar duplicação
  }

  addComboToCart(combo: Combo): void {
    this.cartService.addComboToCart(combo, 1);
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  trackByCategoryId(index: number, category: Category): number {
    return category.id;
  }

  trackByComboId(index: number, combo: Combo): number {
    return combo.id;
  }

  selectCategory(category: Category | null): void {
    // Resetar paginação ao mudar de categoria
    this.currentPage = 1;
    this.lastPage = 1;

    // Se clicou na mesma categoria, limpar o filtro
    if (category && this.selectedCategory === category.id) {
      this.selectedCategory = null;
      this.sectionTitle = 'Destaques';
      this.loadAllProducts();
      return;
    }

    // Nova categoria selecionada
    this.selectedCategory = category ? category.id : null;
    if (category) {
      // Verificar se é a categoria Combos (caso especial)
      const categoryNameLower = category.name.toLowerCase();
      if (categoryNameLower === 'combos' || category.slug?.toLowerCase() === 'combos') {
        this.sectionTitle = 'Combos e Ofertas';
      } else {
        this.sectionTitle = category.name;
      }
      this.loadProductsByCategory(category.id);
    } else {
      this.sectionTitle = 'Destaques';
      this.loadAllProducts();
    }
  }

  loadAllProducts(page: number = 1): void {
    // Carregar todos os produtos (em destaque)
    this.isLoadingProducts = true;
    this.error.filtered = null;
    
    this.productService.getProducts({ featured: true, per_page: 12, page }).subscribe({
      next: (response) => {
        if (page === 1) {
          this.filteredProducts = response.data || [];
        } else {
          this.filteredProducts = [...this.filteredProducts, ...(response.data || [])];
        }
        this.currentPage = response.current_page;
        this.lastPage = response.last_page;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos:', error);
        this.error.filtered = 'Erro ao carregar produtos';
      }
    }).add(() => {
      this.isLoadingProducts = false;
    });
  }

  loadProductsByCategory(categoryId: number, page: number = 1): void {
    this.isLoadingProducts = true;
    this.error.filtered = null;

    this.productService.getProducts({ category_id: categoryId, per_page: 12, page }).subscribe({
      next: (response) => {
        if (page === 1) {
          this.filteredProducts = response.data || [];
        } else {
          this.filteredProducts = [...this.filteredProducts, ...(response.data || [])];
        }
        this.currentPage = response.current_page;
        this.lastPage = response.last_page;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos da categoria:', error);
        this.error.filtered = 'Erro ao carregar produtos desta categoria';
      }
    }).add(() => {
      this.isLoadingProducts = false;
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

  loadMore(): void {
    if (this.currentPage >= this.lastPage || this.isLoadingProducts) {
      return;
    }

    const nextPage = this.currentPage + 1;

    if (this.selectedCategory) {
      this.loadProductsByCategory(this.selectedCategory, nextPage);
    } else {
      this.loadAllProducts(nextPage);
    }
  }

  getCategoryImage(category: Category): string {
    const imageUrl = (category as any).image_url as string | undefined;
    if (!imageUrl) return 'assets/images/no-image.jpg';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
      const base = environment.apiUrl.replace(/\/api$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${base}${path}`;
    }
    return imageUrl;
  }

  getProductImage(product: Product): string {
    const imageUrl = (product as any).image_url as string | undefined;
    if (imageUrl) {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return `${imageUrl}?v=${encodeURIComponent((product as any).updated_at || '')}`;
      }
      if (imageUrl.startsWith('/storage/') || imageUrl.startsWith('storage/')) {
        const base = environment.apiUrl.replace(/\/api$/, '');
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${base}${path}?v=${encodeURIComponent((product as any).updated_at || '')}`;
      }
      return `${imageUrl}?v=${encodeURIComponent((product as any).updated_at || '')}`;
    }
    const first = (product as any).images?.[0];
    if (first) return first;
    return 'assets/images/no-image.jpg';
  }

  loadBanners(): void {
    this.loading.banners = true;
    this.error.banners = null;

    this.bannerService.getActiveBanners().subscribe({
      next: (banners) => {
        this.banners = banners;
        this.loading.banners = false;
      },
      error: (error) => {
        console.error('Erro ao carregar banners:', error);
        this.error.banners = 'Erro ao carregar banners';
        this.loading.banners = false;
      }
    });
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
}