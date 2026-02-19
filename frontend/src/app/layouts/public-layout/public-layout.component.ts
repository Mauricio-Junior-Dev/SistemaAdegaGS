import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { CartSidebarComponent } from '../../shared/components/cart-sidebar/cart-sidebar.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HeaderComponent,
    FooterComponent,
    CartSidebarComponent,
    BottomNavComponent
  ],
  template: `
    <div class="app-container">
      <app-header></app-header>
      
      <main class="public-content">
        <router-outlet></router-outlet>
      </main>

      <app-footer></app-footer>
      <app-cart-sidebar></app-cart-sidebar>
      <app-bottom-nav></app-bottom-nav>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .public-content {
      padding-top: 65px; /* Altura do header (64px) + respiro (16px) */
      min-height: 100vh;
      background-color: var(--background, #f5f5f5);
      flex: 1;
    }
  `]
})
export class PublicLayoutComponent {}
