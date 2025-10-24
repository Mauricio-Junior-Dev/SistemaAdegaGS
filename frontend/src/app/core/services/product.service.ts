import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Product, Category } from '../models/product.model';
import { environment } from '../../../environments/environment';

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getProducts(params?: any): Observable<PaginatedResponse<Product>> {
    // Definir um tamanho de página maior para mostrar mais produtos
    const defaultParams = { per_page: 50 };
    const queryParams = { ...defaultParams, ...params };
    
    return this.http.get<PaginatedResponse<Product>>(`${this.apiUrl}/products`, { params: queryParams });
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  getFeaturedProducts(): Observable<Product[]> {
    return this.getProducts({ featured: true, per_page: 8 }).pipe(
      map(response => response.data)
    );
  }

  getPopularProducts(): Observable<Product[]> {
    return this.getProducts({ popular: true, per_page: 8 }).pipe(
      map(response => response.data)
    );
  }

  getOffers(): Observable<Product[]> {
    return this.getProducts({ per_page: 50 }).pipe(
      map(response => {
        // Filtrar produtos que têm desconto real
        return response.data.filter(product => this.hasDiscount(product));
      })
    );
  }

  getImageUrl(product: Product): string {
    if (product.image_url) {
      return product.image_url.startsWith('http') 
        ? product.image_url 
        : `${this.apiUrl}/storage/${product.image_url}`;
    }
    return '/assets/images/no-image.png';
  }

  hasOffer(product: Product): boolean {
    return this.hasDiscount(product);
  }

  hasDiscount(product: Product): boolean {
    return Boolean(product.original_price) && 
           product.original_price! > product.price &&
           product.original_price! > 0 &&
           product.price > 0;
  }

  getOriginalPrice(product: Product): number {
    return product.original_price || product.price;
  }

  getDiscountPercentage(product: Product): number {
    if (!this.hasDiscount(product)) return 0;
    const originalPrice = product.original_price!;
    const discount = ((originalPrice - product.price) / originalPrice) * 100;
    return Math.round(discount);
  }

  getLowStock(product: Product): boolean {
    return product.current_stock <= product.min_stock;
  }

  getSuggestions(cartIds: number[], limit: number = 6): Observable<Product[]> {
    // Construir parâmetros manualmente para garantir formato correto
    const cartIdsParam = cartIds.map(id => `cart_ids[]=${id}`).join('&');
    const url = `${this.apiUrl}/products/suggestions?${cartIdsParam}&limit=${limit}`;
    
    return this.http.get<{suggestions: Product[], total: number}>(url).pipe(
      map(response => response.suggestions)
    );
  }
}