import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './offers.component.html',
  styleUrls: ['./offers.component.css']
})
export class OffersComponent implements OnInit {
  offers: Product[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private productService: ProductService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.loadOffers();
  }

  loadOffers(): void {
    this.loading = true;
    this.error = null;

    this.productService.getOffers().subscribe({
      next: (products) => {
        this.offers = products;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erro ao carregar ofertas. Tente novamente.';
        this.loading = false;
        console.error('Erro ao carregar ofertas:', error);
      }
    });
  }

  addToCart(product: Product): void {
    this.cartService.addItem(product, 1);
  }

  getImageUrl(product: Product): string {
    return this.productService.getImageUrl(product);
  }

  hasOffer(product: Product): boolean {
    return this.productService.hasDiscount(product);
  }

  getOriginalPrice(product: Product): number {
    return product.original_price || product.price;
  }

  getDiscountPercentage(product: Product): number {
    return this.productService.getDiscountPercentage(product);
  }

  getDiscountAmount(product: Product): number {
    if (!this.hasOffer(product)) return 0;
    return (product.original_price || 0) - product.price;
  }

  getLowStock(product: Product): boolean {
    return this.productService.getLowStock(product);
  }
}
