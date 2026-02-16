import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatDividerModule } from '@angular/material/divider';

import { UserService, User, CreateUserDTO } from '../../../services/user.service';

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatStepperModule,
    MatDividerModule
  ],
  template: `
    <h2 mat-dialog-title>{{isEdit ? 'Editar' : 'Novo'}} Usuário</h2>
    
    <mat-dialog-content>
      <mat-stepper [linear]="!isEdit" #stepper>
        <!-- Informações Básicas -->
        <mat-step [stepControl]="basicInfoForm">
          <ng-template matStepLabel>Informações Básicas</ng-template>
          <form [formGroup]="basicInfoForm">
            <div class="form-container">

              <!-- Campos Básicos -->
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Nome</mat-label>
                  <input matInput formControlName="name" required>
                  <mat-error *ngIf="basicInfoForm.get('name')?.hasError('required')">
                    Nome é obrigatório
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tipo</mat-label>
                  <mat-select formControlName="type" required>
                    <mat-option value="admin">Administrador</mat-option>
                    <mat-option value="employee">Funcionário</mat-option>
                    <mat-option value="customer">Cliente</mat-option>
                  </mat-select>
                  <mat-error *ngIf="basicInfoForm.get('type')?.hasError('required')">
                    Tipo é obrigatório
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>E-mail</mat-label>
                  <input matInput formControlName="email" required type="email">
                  <mat-error *ngIf="basicInfoForm.get('email')?.hasError('required')">
                    E-mail é obrigatório
                  </mat-error>
                  <mat-error *ngIf="basicInfoForm.get('email')?.hasError('email')">
                    E-mail inválido
                  </mat-error>
                  <mat-error *ngIf="basicInfoForm.get('email')?.hasError('emailExists')">
                    E-mail já cadastrado
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Telefone</mat-label>
                  <input matInput formControlName="phone" placeholder="(99) 99999-9999">
                </mat-form-field>
              </div>

              <!-- Status -->
              <div class="form-row status-row">
                <mat-slide-toggle formControlName="is_active" color="primary">
                  Usuário Ativo
                </mat-slide-toggle>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button matStepperNext>Próximo</button>
            </div>
          </form>
        </mat-step>

        <!-- Senha -->
        <mat-step [stepControl]="passwordForm" [optional]="isEdit">
          <ng-template matStepLabel>Senha</ng-template>
          <form [formGroup]="passwordForm">
            <div class="form-container">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Senha</mat-label>
                  <input matInput 
                         type="password" 
                         formControlName="password"
                         [required]="!isEdit">
                  <mat-error *ngIf="passwordForm.get('password')?.hasError('required')">
                    Senha é obrigatória
                  </mat-error>
                  <mat-error *ngIf="passwordForm.get('password')?.hasError('minlength')">
                    Senha deve ter no mínimo 8 caracteres
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Confirmar Senha</mat-label>
                  <input matInput 
                         type="password" 
                         formControlName="password_confirmation"
                         [required]="!isEdit">
                  <mat-error *ngIf="passwordForm.get('password_confirmation')?.hasError('required')">
                    Confirmação de senha é obrigatória
                  </mat-error>
                  <mat-error *ngIf="passwordForm.get('password_confirmation')?.hasError('passwordMismatch')">
                    Senhas não conferem
                  </mat-error>
                </mat-form-field>
              </div>

              <p class="helper-text" *ngIf="isEdit">
                Deixe os campos em branco para manter a senha atual
              </p>
            </div>

            <div class="step-actions">
              <button mat-button matStepperPrevious>Voltar</button>
              <button mat-button matStepperNext>{{isEdit ? 'Próximo' : 'Finalizar'}}</button>
            </div>
          </form>
        </mat-step>

        <!-- Endereço (opcional) -->
        <mat-step [stepControl]="addressForm" optional>
          <ng-template matStepLabel>Endereço</ng-template>
          <form [formGroup]="addressForm">
            <div class="form-container">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>CEP</mat-label>
                  <input matInput formControlName="zipcode" placeholder="00000-000">
                </mat-form-field>

                <mat-form-field appearance="outline" class="street-field">
                  <mat-label>Rua</mat-label>
                  <input matInput formControlName="street">
                </mat-form-field>

                <mat-form-field appearance="outline" class="number-field">
                  <mat-label>Número</mat-label>
                  <input matInput formControlName="number">
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Complemento</mat-label>
                  <input matInput formControlName="complement">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Bairro</mat-label>
                  <input matInput formControlName="neighborhood">
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Cidade</mat-label>
                  <input matInput formControlName="city">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Estado</mat-label>
                  <input matInput formControlName="state">
                </mat-form-field>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button matStepperPrevious>Voltar</button>
              <button mat-button (click)="onSubmit()" color="primary">
                {{isEdit ? 'Salvar' : 'Criar'}}
              </button>
            </div>
          </form>
        </mat-step>
      </mat-stepper>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button 
              [disabled]="loading"
              (click)="dialogRef.close()">
        Cancelar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      max-height: 80vh;
      overflow-y: auto;
    }

    .form-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row > * {
      flex: 1;
    }

    .street-field {
      flex: 2;
    }

    .number-field {
      flex: 0.5;
    }

    .status-row {
      margin-top: 8px;
    }


    .helper-text {
      color: #666;
      font-size: 14px;
      margin: 0;
    }

    .step-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }

    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .preview {
        width: 80px;
        height: 80px;
      }
    }
  `]
})
export class UserFormDialogComponent implements OnInit {
  @ViewChild(MatStepper) stepper!: MatStepper;

  basicInfoForm: FormGroup;
  passwordForm: FormGroup;
  addressForm: FormGroup;
  loading = false;
  isEdit = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user?: User }
  ) {
    this.isEdit = !!data.user;

    // Formulário de Informações Básicas
    this.basicInfoForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      type: ['customer', Validators.required],
      phone: [''],
      is_active: [true]
    });

    // Formulário de Senha
    this.passwordForm = this.fb.group({
      password: ['', this.isEdit ? [] : [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', this.isEdit ? [] : [Validators.required]]
    }, { validator: this.passwordMatchValidator });

    // Formulário de Endereço
    this.addressForm = this.fb.group({
      street: [''],
      number: [''],
      complement: [''],
      neighborhood: [''],
      city: [''],
      state: [''],
      zipcode: ['']
    });

    if (this.isEdit && data.user) {
      this.basicInfoForm.patchValue(data.user);
      if (data.user.address) {
        this.addressForm.patchValue(data.user.address);
      }
    }
  }

  ngOnInit(): void {
    this.setupValidators();
  }

  private setupValidators(): void {
    const emailControl = this.basicInfoForm.get('email');

    if (emailControl) {
      emailControl.valueChanges.subscribe(value => {
        if (value && emailControl.valid) {
          this.userService.validateEmail(value, this.data.user?.id).subscribe({
            next: (response) => {
              if (!response.valid) {
                emailControl.setErrors({ emailExists: true });
              }
            }
          });
        }
      });
    }
  }

  private passwordMatchValidator(group: FormGroup): { passwordMismatch: boolean } | null {
    const password = group.get('password');
    const confirmPassword = group.get('password_confirmation');

    if (!password || !confirmPassword) return null;

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }


  onSubmit(): void {
    this.basicInfoForm.markAllAsTouched();
    this.passwordForm.markAllAsTouched();
    this.addressForm.markAllAsTouched();

    if (!this.basicInfoForm.valid || !this.passwordForm.valid || !this.addressForm.valid) {
      if (this.stepper) {
        if (!this.basicInfoForm.valid) {
          this.stepper.selectedIndex = 0;
        } else if (!this.passwordForm.valid) {
          this.stepper.selectedIndex = 1;
        } else {
          this.stepper.selectedIndex = 2;
        }
      }
      this.snackBar.open('Verifique os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }

    this.loading = true;

    const userData: CreateUserDTO = {
      ...this.basicInfoForm.value,
      ...this.passwordForm.value,
      address: Object.keys(this.addressForm.value).some(key => this.addressForm.value[key])
        ? this.addressForm.value
        : undefined
    };

    const request = this.isEdit
      ? this.userService.updateUser({ id: this.data.user!.id, ...userData })
      : this.userService.createUser(userData);

    request.subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (error) => {
        console.error('Erro ao salvar usuário:', error);
        this.snackBar.open('Erro ao salvar usuário', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }
}
