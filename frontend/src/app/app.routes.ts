import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { funcionarioGuard } from './core/guards/funcionario.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./home/pages/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'login',
        loadComponent: () => import('./auth/pages/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./auth/pages/register/register.component').then(m => m.RegisterComponent)
      },
      {
        path: 'produtos',
        loadComponent: () => import('./products/pages/product-list-page/product-list-page.component').then(m => m.ProductListPageComponent)
      },
      {
        path: 'combos',
        loadComponent: () => import('./combos/pages/combos-page/combos-page.component').then(m => m.CombosPageComponent)
      },
      {
        path: 'combos/:id',
        loadComponent: () => import('./combos/pages/combo-detail/combo-detail.component').then(m => m.ComboDetailComponent)
      },
      {
        path: 'ofertas',
        loadComponent: () => import('./offers/pages/offers/offers.component').then(m => m.OffersComponent)
      },
      {
        path: 'carrinho',
        loadComponent: () => import('./store/components/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        loadComponent: () => import('./checkout/pages/checkout/checkout.component').then(m => m.CheckoutComponent)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./profile/pages/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [authGuard]
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./orders/pages/orders-list/orders-list.component').then(m => m.OrdersListComponent),
        canActivate: [authGuard]
      },
      {
        path: 'enderecos',
        loadComponent: () => import('./user/pages/enderecos/enderecos.component').then(m => m.EnderecosComponent),
        canActivate: [authGuard]
      }
    ]
  },
  {
    path: 'funcionario',
    loadComponent: () => import('./employee/components/employee-layout/employee-layout.component').then(m => m.EmployeeLayoutComponent),
    canActivate: [authGuard, funcionarioGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./employee/pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'caixa',
        loadComponent: () => import('./employee/pages/caixa/caixa.component').then(m => m.CaixaComponent)
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./employee/pages/pedidos/pedidos.component').then(m => m.PedidosComponent)
      },
      {
        path: 'estoque',
        loadComponent: () => import('./employee/pages/estoque/estoque.component').then(m => m.EstoqueComponent)
      }
    ]
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/components/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./admin/pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'produtos',
        loadComponent: () => import('./admin/pages/produtos/produtos.component').then(m => m.ProdutosComponent)
      },
      {
        path: 'combos',
        loadComponent: () => import('./admin/pages/combos/combos.component').then(m => m.CombosComponent)
      },
      {
        path: 'combos/novo',
        loadComponent: () => import('./admin/pages/combos/combo-form/combo-form.component').then(m => m.ComboFormComponent)
      },
      {
        path: 'combos/:id',
        loadComponent: () => import('./admin/pages/combos/combo-form/combo-form.component').then(m => m.ComboFormComponent)
      },
      {
        path: 'combos/:id/editar',
        loadComponent: () => import('./admin/pages/combos/combo-form/combo-form.component').then(m => m.ComboFormComponent)
      },
      {
        path: 'categorias',
        loadComponent: () => import('./admin/pages/categorias/categorias.component').then(m => m.CategoriasComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./admin/pages/usuarios/usuarios.component').then(m => m.UsuariosComponent)
      },
      {
        path: 'relatorios',
        loadComponent: () => import('./admin/pages/relatorios/relatorios.component').then(m => m.RelatoriosComponent)
      },
      {
        path: 'configuracoes',
        loadComponent: () => import('./admin/pages/configuracoes/configuracoes.component').then(m => m.ConfiguracoesComponent)
      },
      {
        path: 'delivery-zones',
        loadComponent: () => import('./admin/pages/delivery-zones/delivery-zones.component').then(m => m.DeliveryZonesComponent)
      },
      {
        path: 'movimentacoes',
        loadComponent: () => import('./admin/pages/movimentacoes/movimentacoes.component').then(m => m.MovimentacoesComponent)
      }
    ]
  }
];