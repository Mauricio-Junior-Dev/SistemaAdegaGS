import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { CartSidebarComponent } from '../../shared/components/cart-sidebar/cart-sidebar.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HeaderComponent,
    FooterComponent,
    CartSidebarComponent
  ],
  template: `
    <div class="app-container">
      <app-header></app-header>
      
      <main>
        <router-outlet></router-outlet>
      </main>

      <app-footer></app-footer>
      <app-cart-sidebar></app-cart-sidebar>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    main {
      flex: 1;
    }
  `]
})
export class PublicLayoutComponent {}
