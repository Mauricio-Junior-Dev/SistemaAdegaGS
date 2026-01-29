import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse } from '../../../core/models/auth.model';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { OrderPollingService } from '../../../core/services/order-polling.service';
import { ToastrService } from 'ngx-toastr';

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
  private queryParamsSub?: Subscription;
  private identifierAppliedFromUrl = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private orderPollingService: OrderPollingService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]], // E-mail ou CPF
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      const returnUrlParam = params['returnUrl'];
      this.returnUrl = returnUrlParam && typeof returnUrlParam === 'string' ? returnUrlParam : '/';

      const identifierParam = params['identifier'];
      if (identifierParam && typeof identifierParam === 'string' && identifierParam.trim()) {
        const id = identifierParam.trim();
        if (this.identifierAppliedFromUrl && this.identifier === id) return;
        this.identifierAppliedFromUrl = true;
        this.loginForm.get('identifier')?.setValue(id);
        this.loginForm.updateValueAndValidity();
        this.identifier = id;
        this.cdr.detectChanges();
        this.toastr.info('Olá! Vimos que você já tem cadastro. Entre para finalizar.', undefined, { timeOut: 5000 });
        this.loading = true;
        this.error = null;
        this.authService.checkUser(id).subscribe({
          next: (response) => {
            this.loading = false;
            if (response.exists) {
              this.userExists = true;
              this.showPasswordField = true;
              this.loginForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
              this.loginForm.get('password')?.updateValueAndValidity();
            }
          },
          error: () => {
            this.loading = false;
          }
        });
      }
    });

    this.initializeSocialAuth();
    window.addEventListener('social-auth-success', this.handleSocialAuthSuccess.bind(this));
    window.addEventListener('social-auth-error', this.handleSocialAuthError.bind(this));
    (window as any).handleGoogleResponse = (response: any) => {
      this.handleGoogleResponse(response);
    };
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
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

  private handleSocialAuthSuccess(event: unknown): void {
    const authResponse = (event as { detail: AuthResponse }).detail;
    this.authService.saveAuth(authResponse);
    if (authResponse.user?.type === 'employee') {
      this.orderPollingService.startPolling();
    }
    const url = this.returnUrl ?? '/';
    this.router.navigateByUrl(url);
    this.loading = false;
  }

  private handleSocialAuthError(_event: unknown): void {
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
          
          const url = this.returnUrl ?? '/';
          this.router.navigateByUrl(url);
          this.loading = false;
        },
        error: (err: unknown) => {
          console.error('Erro na autenticação social:', err);
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
    const raw = this.loginForm.get('identifier')?.value;
    const identifier = typeof raw === 'string' ? raw.trim() : '';

    if (!identifier) {
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
          this.userExists = true;
          this.showPasswordField = true;
          this.loginForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
          this.loginForm.get('password')?.updateValueAndValidity();
        } else {
          this.router.navigate(['/checkout'], {
            queryParams: identifier.includes('@') ? { email: identifier } : {}
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message
          || err?.error?.errors?.identifier?.[0]
          || 'Erro ao verificar usuário. Tente novamente.';
        this.error = msg;
      },
    });
  }

  onSubmit(): void {
    // Fluxo híbrido: se ainda não mostrou senha, só verificar usuário (Continuar)
    if (!this.showPasswordField) {
      this.onContinue();
      return;
    }

    if (this.loginForm.invalid) {
      this.error = 'Preencha o e-mail/CPF e a senha.';
      return;
    }

    this.loading = true;
    this.error = null;

    // Usar identifier como email para o login (o backend aceita email ou CPF)
    const loginData = {
      email: this.identifier,
      password: this.loginForm.get('password')?.value
    };

    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || this.returnUrl || '/';
    this.authService.login(loginData).subscribe({
      next: (response) => {
        if (response.user?.type === 'employee') {
          this.orderPollingService.startPolling();
        }
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: unknown) => {
        const msg = err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : undefined;
        this.error = msg || 'Erro ao fazer login';
        this.loading = false;
      }
    });
  }
}
