import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { OrderPollingService } from '../../../core/services/order-polling.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule]
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;
  returnUrl: string = '/';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private orderPollingService: OrderPollingService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    // Capturar o returnUrl dos query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // Inicializar serviços de autenticação social
    this.initializeSocialAuth();
    
    // Escutar eventos de autenticação social
    window.addEventListener('social-auth-success', this.handleSocialAuthSuccess.bind(this));
    window.addEventListener('social-auth-error', this.handleSocialAuthError.bind(this));
    
    // Configurar callback global do Google
    (window as any).handleGoogleResponse = (response: any) => {
      this.handleGoogleResponse(response);
    };
  }

  ngOnDestroy(): void {
    // Remover listeners
    window.removeEventListener('social-auth-success', this.handleSocialAuthSuccess.bind(this));
    window.removeEventListener('social-auth-error', this.handleSocialAuthError.bind(this));
  }

  private async initializeSocialAuth(): Promise<void> {
    try {
      await this.socialAuthService.initializeGoogle();
    } catch (error) {
      console.error('Erro ao inicializar autenticação social:', error);
    }
  }

  loginWithGoogle(): void {
    this.loading = true;
    this.error = null;
    this.socialAuthService.loginWithGoogle();
  }

  private handleSocialAuthSuccess(event: any): void {
    const authResponse = event.detail;
    
    // Salvar dados de autenticação
    this.authService.saveAuth(authResponse);
    
    // Iniciar polling de pedidos se for funcionário ou admin
    if (authResponse.user.type === 'employee' || authResponse.user.type === 'admin') {
      console.log('[LoginComponent] Iniciando polling de pedidos para funcionário/admin (social auth)');
      this.orderPollingService.startPolling();
    }
    
    // Redirecionar baseado no tipo de usuário
    const userType = authResponse.user.type;
    let targetRoute = this.returnUrl;

    if (this.returnUrl === '/') {
      switch (userType) {
        case 'admin':
          targetRoute = '/admin';
          break;
        case 'employee':
          targetRoute = '/funcionario';
          break;
        case 'customer':
          targetRoute = '/';
          break;
      }
    }

    this.router.navigate([targetRoute]);
    this.loading = false;
  }

  private handleSocialAuthError(event: any): void {
    this.error = 'Erro na autenticação social. Tente novamente.';
    this.loading = false;
  }

  private handleGoogleResponse(response: any): void {
    try {
      // Decodificar o JWT token
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      
      // Enviar para o backend
      this.loading = true;
      this.error = null;
      
      this.socialAuthService.sendSocialAuthToBackend('google', {
        token: response.credential,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }).subscribe({
        next: (authResponse) => {
          // Salvar dados de autenticação
          this.authService.saveAuth(authResponse);
          
          // Iniciar polling de pedidos se for funcionário ou admin
          if (authResponse.user.type === 'employee' || authResponse.user.type === 'admin') {
            console.log('[LoginComponent] Iniciando polling de pedidos para funcionário/admin (Google)');
            this.orderPollingService.startPolling();
          }
          
          // Redirecionar baseado no tipo de usuário
          const userType = authResponse.user.type;
          let targetRoute = this.returnUrl;

          if (this.returnUrl === '/') {
            switch (userType) {
              case 'admin':
                targetRoute = '/admin';
                break;
              case 'employee':
                targetRoute = '/funcionario';
                break;
              case 'customer':
                targetRoute = '/';
                break;
            }
          }

          this.router.navigate([targetRoute]);
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro na autenticação social:', error);
          this.error = 'Erro na autenticação social. Tente novamente.';
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('Erro ao processar token do Google:', error);
      this.error = 'Erro ao processar login com Google';
      this.loading = false;
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;

     this.authService.login(this.loginForm.value).subscribe({
       next: (response) => {
         // Iniciar polling de pedidos se for funcionário ou admin
         if (response.user.type === 'employee' || response.user.type === 'admin') {
           console.log('[LoginComponent] Iniciando polling de pedidos para funcionário/admin');
           this.orderPollingService.startPolling();
         }
         
         // Redirecionar baseado no tipo de usuário
         const userType = response.user.type;
         let targetRoute = this.returnUrl;

         if (this.returnUrl === '/') {
           switch (userType) {
             case 'admin':
               targetRoute = '/admin';
               break;
             case 'employee':
               targetRoute = '/funcionario';
               break;
             case 'customer':
               targetRoute = '/';
               break;
           }
         }

         this.router.navigate([targetRoute]);
       },
      error: (error) => {
        this.error = error.error.message || 'Erro ao fazer login';
        this.loading = false;
      }
    });
  }
}
