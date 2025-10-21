import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface Banner {
  id: number;
  image_url: string;
  title?: string;
  subtitle?: string;
  link?: string;
  order: number;
  is_active: boolean;
}

@Component({
  selector: 'app-banner-carousel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="banner-carousel" *ngIf="banners.length > 0">
      <div class="carousel-container">
        <div class="carousel-track" [style.transform]="'translateX(-' + (currentSlide * 100) + '%)'">
          <div *ngFor="let banner of banners; let i = index" 
               class="carousel-slide" 
               [class.active]="i === currentSlide">
            <div class="banner-content">
              <img [src]="getImageUrl(banner.image_url)" [alt]="banner.title || 'Banner'">
              <div class="banner-overlay" *ngIf="banner.title || banner.subtitle">
                <div class="banner-text">
                  <h2 *ngIf="banner.title">{{ banner.title }}</h2>
                  <p *ngIf="banner.subtitle">{{ banner.subtitle }}</p>
                  <a *ngIf="banner.link" [href]="banner.link" class="banner-link">
                    Saiba Mais
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Navigation Arrows -->
        <button class="carousel-arrow carousel-prev" (click)="previousSlide()" *ngIf="banners.length > 1">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <button class="carousel-arrow carousel-next" (click)="nextSlide()" *ngIf="banners.length > 1">
          <mat-icon>chevron_right</mat-icon>
        </button>
        
        <!-- Dots Indicator -->
        <div class="carousel-dots" *ngIf="banners.length > 1">
          <span *ngFor="let banner of banners; let i = index"
                class="dot"
                [class.active]="i === currentSlide"
                (click)="goToSlide(i)">
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .banner-carousel {
      position: relative;
      width: 100%;
      height: 400px;
      overflow: hidden;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .carousel-container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .carousel-track {
      display: flex;
      width: 100%;
      height: 100%;
      transition: transform 0.5s ease-in-out;
    }

    .carousel-slide {
      min-width: 100%;
      height: 100%;
      position: relative;
    }

    .banner-content {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .banner-content img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .banner-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .banner-text {
      text-align: center;
      color: white;
      padding: 2rem;
      max-width: 600px;
    }

    .banner-text h2 {
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    }

    .banner-text p {
      font-size: 1.2rem;
      margin-bottom: 2rem;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    .banner-link {
      display: inline-block;
      background-color: var(--primary, #4a90e2);
      color: white;
      padding: 1rem 2rem;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      transition: background-color 0.3s ease;
    }

    .banner-link:hover {
      background-color: var(--primary-dark, #357abd);
    }

    .carousel-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.9);
      border: none;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.3s ease;
      z-index: 2;
    }

    .carousel-arrow:hover {
      background: rgba(255, 255, 255, 1);
    }

    .carousel-prev {
      left: 20px;
    }

    .carousel-next {
      right: 20px;
    }

    .carousel-dots {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 2;
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      transition: background-color 0.3s ease;
    }

    .dot.active {
      background: white;
    }

    .dot:hover {
      background: rgba(255, 255, 255, 0.8);
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .banner-carousel {
        height: 250px;
        border-radius: 8px;
      }

      .banner-text h2 {
        font-size: 1.8rem;
      }

      .banner-text p {
        font-size: 1rem;
      }

      .banner-text {
        padding: 1rem;
      }

      .carousel-arrow {
        width: 40px;
        height: 40px;
      }

      .carousel-prev {
        left: 10px;
      }

      .carousel-next {
        right: 10px;
      }

      .carousel-dots {
        bottom: 15px;
      }

      .dot {
        width: 10px;
        height: 10px;
      }
    }

    @media (max-width: 480px) {
      .banner-carousel {
        height: 200px;
      }

      .banner-text h2 {
        font-size: 1.5rem;
      }

      .banner-text p {
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }

      .banner-link {
        padding: 0.8rem 1.5rem;
        font-size: 0.9rem;
      }
    }
  `]
})
export class BannerCarouselComponent implements OnInit {
  @Input() banners: Banner[] = [];
  @Input() autoPlay: boolean = true;
  @Input() autoPlayInterval: number = 5000;

  currentSlide = 0;
  private autoPlayTimer?: number;

  ngOnInit(): void {
    if (this.autoPlay && this.banners.length > 1) {
      this.startAutoPlay();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.banners.length;
  }

  previousSlide(): void {
    this.currentSlide = this.currentSlide === 0 ? this.banners.length - 1 : this.currentSlide - 1;
  }

  goToSlide(index: number): void {
    this.currentSlide = index;
  }

  private startAutoPlay(): void {
    this.autoPlayTimer = window.setInterval(() => {
      this.nextSlide();
    }, this.autoPlayInterval);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
    }
  }

  getImageUrl(imageUrl: string): string {
    if (!imageUrl) return '';
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    if (imageUrl.startsWith('/storage/')) {
      return 'http://localhost:8000' + imageUrl;
    }
    
    if (imageUrl.startsWith('storage/')) {
      return 'http://localhost:8000/' + imageUrl;
    }
    
    return 'http://localhost:8000/storage/' + imageUrl;
  }
}
