import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ProductSearchComponent } from '../../components/product-search/product-search.component';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Category } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-product-list-page',
  templateUrl: './product-list-page.component.html',
  styleUrls: ['./product-list-page.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProductSearchComponent
  ]
})
export class ProductListPageComponent implements OnInit {
  products: Product[] = [];
  categories: Category[] = [];
  loading = true;
  selectedCategory: number | null = null;
  searchTerm: string = '';
  error: string | null = null;
  viewMode: 'grid' | 'list' = 'grid';
  dietFilter: 'vegetariano' | 'nao-vegetariano' | null = null;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private route: ActivatedRoute
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
    console.log('ProductListPageComponent initialized');
    this.loadCategories();
    this.route.queryParams.subscribe(params => {
      console.log('Query params:', params);
      this.selectedCategory = params['categoria'] ? +params['categoria'] : null;
      this.searchTerm = params['busca'] || '';
      this.loadProducts();
    });
  }

  loadCategories(): void {
    this.productService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  loadProducts(): void {
    const params: any = {};
    
    if (this.selectedCategory) {
      params.category_id = this.selectedCategory;
    }
    
    if (this.searchTerm) {
      params.search = this.searchTerm;
    }

    console.log('Loading products with params:', params);
    this.loading = true;
    this.error = null;

    this.productService.getProducts(params).subscribe({
      next: (response) => {
        console.log('Products loaded:', response);
        this.products = response.data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = 'Erro ao carregar produtos. Por favor, tente novamente.';
        this.loading = false;
      }
    });
  }

  onCategoryChange(categoryId: number | null): void {
    console.log('Category changed:', categoryId);
    this.selectedCategory = categoryId;
    this.loadProducts();
  }

  onSearch(term: string): void {
    console.log('Search term:', term);
    this.searchTerm = term;
    this.loadProducts();
  }

  addToCart(product: Product): void {
    console.log('Adding product to cart:', product);
    this.cartService.addItem(product);
    // Abrir o carrinho ao adicionar um item
    this.cartService.openCart();
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  toggleDietFilter(filter: 'vegetariano' | 'nao-vegetariano'): void {
    this.dietFilter = this.dietFilter === filter ? null : filter;
    this.loadProducts();
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
}