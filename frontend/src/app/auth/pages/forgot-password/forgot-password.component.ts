import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { documentValidator, formatDocument } from '../../../core/validators/document.validator';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule]
})
export class ForgotPasswordComponent {
  step: 1 | 2 = 1;
  challengeForm: FormGroup;
  passwordForm: FormGroup;
  loading = false;
  error: string | null = null;
  resetToken: string | null = null;
  cpfForLogin = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.challengeForm = this.fb.group({
      document_number: ['', [Validators.required, documentValidator]],
      phone_last_4: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4), Validators.pattern(/^\d{4}$/)]]
    });
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(g: FormGroup): { passwordMismatch: boolean } | null {
    const p = g.get('password')?.value;
    const c = g.get('password_confirmation')?.value;
    if (!p || !c) return null;
    return p === c ? null : { passwordMismatch: true };
  }

  formatDocumentInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const formatted = formatDocument(el.value);
    this.challengeForm.get('document_number')?.setValue(formatted, { emitEvent: false });
  }

  formatPhoneLast4(event: Event): void {
    const el = event.target as HTMLInputElement;
    const v = el.value.replace(/\D/g, '').slice(0, 4);
    this.challengeForm.get('phone_last_4')?.setValue(v, { emitEvent: false });
  }

  onValidate(): void {
    this.challengeForm.markAllAsTouched();
    if (this.challengeForm.invalid) return;
    this.loading = true;
    this.error = null;
    const doc = (this.challengeForm.value.document_number || '').replace(/\D/g, '');
    const last4 = (this.challengeForm.value.phone_last_4 || '').replace(/\D/g, '').slice(-4);
    this.authService.validatePasswordReset(doc, last4).subscribe({
      next: (res) => {
        this.loading = false;
        this.resetToken = res.reset_token;
        this.cpfForLogin = doc;
        this.step = 2;
        this.toastr.success('Dados validados. Defina sua nova senha.', '', { timeOut: 4000 });
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.error?.errors?.document_number?.[0] || 'Dados não conferem.';
        this.error = msg;
        if (err?.status === 429) {
          this.toastr.warning(msg, 'Muitas tentativas');
        } else {
          this.toastr.error(msg, 'Erro');
        }
      }
    });
  }

  onSavePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || !this.resetToken) return;
    const p = this.passwordForm.value.password;
    const c = this.passwordForm.value.password_confirmation;
    if (p !== c) {
      this.error = 'As senhas não coincidem.';
      return;
    }
    this.loading = true;
    this.error = null;
    this.authService.confirmPasswordReset(this.resetToken, p, c).subscribe({
      next: () => {
        this.loading = false;
        this.toastr.success('Senha alterada. Faça login.', '', { timeOut: 4000 });
        this.router.navigate(['/login'], {
          queryParams: this.cpfForLogin ? { identifier: this.cpfForLogin, returnUrl: '/' } : {}
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Não foi possível alterar a senha. Tente novamente.';
        this.toastr.error(this.error ?? 'Erro ao processar.', 'Erro');
      }
    });
  }

  backToStep1(): void {
    this.step = 1;
    this.error = null;
    this.resetToken = null;
  }
}
