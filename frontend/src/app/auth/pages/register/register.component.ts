import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule]
})
export class RegisterComponent implements OnDestroy {
  registerForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\(\d{2}\) \d{5}-\d{4}$/)]],
      // Aceita CPF (11 dígitos) ou CNPJ (14 dígitos) - valida apenas números (ignora formatação)
      document_number: ['', [Validators.required, (control: AbstractControl) => this.documentValidator(control)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Inicializar serviços de autenticação social
    this.initializeSocialAuth();
    
    // Escutar eventos de autenticação social
    window.addEventListener('social-auth-success', this.handleSocialAuthSuccess.bind(this));
    window.addEventListener('social-auth-error', this.handleSocialAuthError.bind(this));
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
    
    if (window.google && window.google.accounts) {
      window.google.accounts.id.prompt();
    }
  }


  private handleSocialAuthSuccess(event: any): void {
    const authResponse = event.detail;
    
    // Salvar dados de autenticação
    this.authService.saveAuth(authResponse);
    
    // Redirecionar para a página inicial
    this.router.navigate(['/']);
    this.loading = false;
  }

  private handleSocialAuthError(event: any): void {
    this.error = 'Erro na autenticação social. Tente novamente.';
    this.loading = false;
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('password_confirmation')?.value
      ? null : { mismatch: true };
  }

  // Validador customizado para CPF/CNPJ (valida apenas números, ignorando formatação)
  private documentValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const numbersOnly = control.value.replace(/\D/g, '');
    if (numbersOnly.length === 11 || numbersOnly.length === 14) {
      return null; // Válido
    }
    return { invalidDocument: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;

    // Remove formatação do document_number antes de enviar (apenas números)
    const formValue = {
      ...this.registerForm.value,
      document_number: this.registerForm.value.document_number.replace(/\D/g, '')
    };

    this.authService.register(formValue).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (error) => {
        if (error.error.errors) {
          const errors = Object.values(error.error.errors).flat();
          this.error = errors.join('. ');
        } else {
          this.error = error.error.message || 'Erro ao criar conta';
        }
        this.loading = false;
      }
    });
  }

  formatPhone(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
      this.registerForm.get('phone')?.setValue(value, { emitEvent: false });
    }
  }

  formatDocument(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    // Formata CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (value.length <= 11) {
      // Formatação CPF: 000.000.000-00
      value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
    } else if (value.length <= 14) {
      // Formatação CNPJ: 00.000.000/0000-00
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    }
    
    this.registerForm.get('document_number')?.setValue(value, { emitEvent: false });
  }
}
