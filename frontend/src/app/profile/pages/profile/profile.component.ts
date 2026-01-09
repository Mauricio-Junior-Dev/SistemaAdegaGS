import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/auth.model';
import { EnderecosComponent } from '../../../user/pages/enderecos/enderecos.component';
import { documentValidator, formatDocument } from '../../../core/validators/document.validator';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    EnderecosComponent
  ]
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  loading = false;
  user: User | null = null;
  activeTab: 'personal' | 'addresses' = 'personal';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      // document_number é obrigatório para garantir dados válidos para PIX
      document_number: ['', [Validators.required, documentValidator]],
      current_password: [''],
      new_password: ['', Validators.minLength(8)],
      new_password_confirmation: ['']
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.user = user;
        // Formata o document_number ao carregar (se existir)
        let formattedDocument = user.document_number || '';
        if (formattedDocument) {
          formattedDocument = formatDocument(formattedDocument);
        }
        this.profileForm.patchValue({
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          document_number: formattedDocument
        });
      }
    });
  }

  switchTab(tab: 'personal' | 'addresses'): void {
    this.activeTab = tab;
  }

  formatDocument(event: any): void {
    const value = event.target.value;
    const formatted = formatDocument(value);
    this.profileForm.get('document_number')?.setValue(formatted, { emitEvent: false });
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      // Mostrar erros de validação do formulário
      Object.keys(this.profileForm.controls).forEach(key => {
        const control = this.profileForm.get(key);
        if (control && control.invalid) {
          control.markAsTouched();
        }
      });
      
      // Mostrar toast informando que há erros no formulário
      this.toastr.warning('Por favor, corrija os erros no formulário antes de continuar.', 'Formulário Inválido', {
        timeOut: 5000,
        positionClass: 'toast-top-center'
      });
      return;
    }

    this.loading = true;

    const formData = { ...this.profileForm.value };
    
    // Remove formatação do document_number antes de enviar (apenas números)
    if (formData.document_number) {
      formData.document_number = formData.document_number.replace(/\D/g, '');
    }
    
    // Remover campos de senha se não foram preenchidos
    if (!formData.current_password) {
      delete formData.current_password;
      delete formData.new_password;
      delete formData.new_password_confirmation;
    }

    this.authService.updateProfile(formData).subscribe({
      next: () => {
        this.loading = false;
        
        // Limpar campos de senha
        this.profileForm.patchValue({
          current_password: '',
          new_password: '',
          new_password_confirmation: ''
        });
        
        // Mostrar notificação de sucesso usando Toastr
        this.toastr.success('Seus dados foram atualizados com sucesso!', 'Perfil Atualizado', {
          timeOut: 3000,
          positionClass: 'toast-top-center',
          progressBar: true
        });
      },
      error: (error) => {
        this.loading = false;
        
        // Processar erros de validação do backend
        if (error.error?.errors) {
          const errors = error.error.errors;
          
          // Iterar sobre cada campo com erro e exibir notificação
          Object.keys(errors).forEach(field => {
            const fieldErrors = Array.isArray(errors[field]) ? errors[field] : [errors[field]];
            fieldErrors.forEach((errorMessage: string) => {
              this.toastr.error(errorMessage, 'Erro ao Atualizar Perfil', {
                timeOut: 5000,
                positionClass: 'toast-top-center',
                progressBar: true
              });
            });
          });
        } else {
          // Erro genérico ou sem estrutura de erros
          const errorMessage = error.error?.message || 'Erro ao atualizar perfil. Por favor, tente novamente.';
          this.toastr.error(errorMessage, 'Erro ao Atualizar Perfil', {
            timeOut: 5000,
            positionClass: 'toast-top-center',
            progressBar: true
          });
        }
      }
    });
  }
}

