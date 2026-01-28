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
  showPasswordField = false;
  userExists = false;
  identifier: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private orderPollingService: OrderPollingService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]], // E-mail ou CPF
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
    
    // Iniciar polling de pedidos apenas se for funcionário
    if (authResponse.user.type === 'employee') {
      console.log('[LoginComponent] Iniciando polling de pedidos para funcionário (social auth)');
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
          
          // Iniciar polling de pedidos apenas se for funcionário
          if (authResponse.user.type === 'employee') {
            console.log('[LoginComponent] Iniciando polling de pedidos para funcionário (Google)');
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

  onContinue(): void {
    const identifier = this.loginForm.get('identifier')?.value;
    
    if (!identifier || identifier.trim() === '') {
      this.error = 'Por favor, informe seu e-mail ou CPF';
      return;
    }

    this.loading = true;
    this.error = null;
    this.identifier = identifier;

    this.authService.checkUser(identifier).subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.exists) {
          // Usuário existe: revelar campo de senha
          this.userExists = true;
          this.showPasswordField = true;
          this.loginForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
          this.loginForm.get('password')?.updateValueAndValidity();
        } else {
          // Usuário não existe: redirecionar para checkout
          const email = identifier.includes('@') ? identifier : '';
          this.router.navigate(['/checkout'], {
            queryParams: { email: email || identifier }
          });
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error.message || 'Erro ao verificar usuário';
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    if (!this.showPasswordField) {
      // Se ainda não mostrou o campo de senha, fazer a checagem primeiro
      this.onContinue();
      return;
    }

    this.loading = true;
    this.error = null;

    // Usar identifier como email para o login (o backend aceita email ou CPF)
    const loginData = {
      email: this.identifier,
      password: this.loginForm.get('password')?.value
    };

    this.authService.login(loginData).subscribe({
      next: (response) => {
        // Iniciar polling de pedidos apenas se for funcionário
        if (response.user.type === 'employee') {
          console.log('[LoginComponent] Iniciando polling de pedidos para funcionário');
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
