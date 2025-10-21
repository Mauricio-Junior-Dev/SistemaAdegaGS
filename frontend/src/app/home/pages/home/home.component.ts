import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Category } from '../../../core/models/product.model';
import { BannerCarouselComponent, Banner } from '../../../shared/components/banner-carousel/banner-carousel.component';
import { BannerService } from '../../../core/services/banner.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, BannerCarouselComponent]
})
export class HomeComponent implements OnInit {
  categories: Category[] = [];
  featuredProducts: Product[] = [];
  popularProducts: Product[] = [];
  banners: Banner[] = [];
  loading = {
    categories: true,
    featured: true,
    popular: true,
    banners: true
  };
  error = {
    categories: null as string | null,
    featured: null as string | null,
    popular: null as string | null,
    banners: null as string | null
  };

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private bannerService: BannerService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadFeaturedProducts();
    this.loadPopularProducts();
    this.loadBanners();
  }

  loadCategories(): void {
    this.loading.categories = true;
    this.error.categories = null;

    this.productService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
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

  addToCart(product: Product): void {
    this.cartService.addItem(product);
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  trackByCategoryId(index: number, category: Category): number {
    return category.id;
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
}