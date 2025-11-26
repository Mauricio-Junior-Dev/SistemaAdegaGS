import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface Banner {
  id: number;
  desktop_image: string;
  mobile_image?: string;
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
               class="carousel-slide carousel-item" 
               [class.active]="i === currentSlide">
            <div class="banner-content">
              <a *ngIf="banner.link" [href]="banner.link" class="banner-link-wrapper">
                <picture>
                  <source media="(max-width: 768px)" 
                          [srcset]="getImageUrl(banner.mobile_image || banner.desktop_image || banner.image_url)">
                  <img class="banner-img"
                       [src]="getImageUrl(banner.desktop_image || banner.image_url)" 
                       [alt]="'Banner ' + (i + 1)">
                </picture>
              </a>
              <picture *ngIf="!banner.link">
                <source media="(max-width: 768px)" 
                        [srcset]="getImageUrl(banner.mobile_image || banner.desktop_image || banner.image_url)">
                <img class="banner-img"
                     [src]="getImageUrl(banner.desktop_image || banner.image_url)" 
                     [alt]="'Banner ' + (i + 1)">
              </picture>
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

    .banner-content img,
    .banner-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .banner-link-wrapper {
      display: block;
      width: 100%;
      height: 100%;
      text-decoration: none;
      transition: transform 0.3s ease;
    }

    .banner-link-wrapper:hover {
      transform: scale(1.02);
    }

    .banner-link-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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
