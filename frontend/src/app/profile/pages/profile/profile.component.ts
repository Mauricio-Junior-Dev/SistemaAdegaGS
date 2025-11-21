import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/auth.model';

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
    MatIconModule
  ]
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  loading = false;
  success = false;
  error: string | null = null;
  user: User | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      current_password: [''],
      new_password: ['', Validators.minLength(8)],
      new_password_confirmation: ['']
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.user = user;
        this.profileForm.patchValue({
          name: user.name,
          email: user.email,
          phone: user.phone || ''
        });
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = false;

    const formData = { ...this.profileForm.value };
    
    // Remover campos de senha se não foram preenchidos
    if (!formData.current_password) {
      delete formData.current_password;
      delete formData.new_password;
      delete formData.new_password_confirmation;
    }

    this.authService.updateProfile(formData).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        // Limpar campos de senha
        this.profileForm.patchValue({
          current_password: '',
          new_password: '',
          new_password_confirmation: ''
        });
        
        setTimeout(() => {
          this.success = false;
        }, 3000);
      },
      error: (error) => {
        this.error = error.error.message || 'Erro ao atualizar perfil';
        this.loading = false;
      }
    });
  }
}

