import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { AddressService, Address, CreateAddressRequest } from '../../../core/services/address.service';
import { CepService, CepFormatted } from '../../../core/services/cep.service';

@Component({
  selector: 'app-enderecos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatDialogModule
  ],
  template: `
    <div class="enderecos-page">
      <div class="container">
        <div class="enderecos-header">
          <h1>Meus Endereços</h1>
          <p class="subtitle">Gerencie seus endereços de entrega</p>
        </div>

        <div class="enderecos-content">
          <!-- Loading -->
          <div *ngIf="loading" class="loading">
            <mat-spinner diameter="50"></mat-spinner>
            <p>Carregando endereços...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!loading && addresses.length === 0" class="empty-state">
            <mat-icon>location_off</mat-icon>
            <h2>Nenhum endereço cadastrado</h2>
            <p>Adicione um endereço para facilitar suas compras</p>
            <button mat-raised-button color="primary" (click)="openAddressDialog()">
              <mat-icon>add</mat-icon>
              Adicionar Primeiro Endereço
            </button>
          </div>

          <!-- Addresses List -->
          <div *ngIf="!loading && addresses.length > 0" class="addresses-section">
            <!-- Botão Adicionar -->
            <button class="btn btn-primary add-address-btn" (click)="openAddressDialog()">
              <mat-icon>add</mat-icon>
              Adicionar Novo Endereço
            </button>

            <!-- Grid de Endereços -->
            <div class="address-grid">
              <div *ngFor="let address of addresses" class="address-card" [class.is-default]="address.is_default">
                <div class="address-header">
                  <div class="address-title-section">
                    <span class="street-text">{{address.street}}, {{address.number}}</span>
                    <span *ngIf="address.is_default" class="badge-default">Padrão</span>
                  </div>
                </div>

                <div class="address-details">
                  <p *ngIf="address.complement" class="details-text">{{address.complement}}</p>
                  <p class="details-text">{{address.neighborhood}}, {{address.city}}/{{address.state}}</p>
                  <p class="details-text">CEP: {{address.zipcode}}</p>
                  <p *ngIf="address.notes" class="details-text">{{address.notes}}</p>
                </div>

                <div class="actions">
                  <button mat-button class="action-btn edit-btn" (click)="editAddress(address)">
                    <mat-icon>edit</mat-icon>
                    Editar
                  </button>
                  <button mat-button class="action-btn delete-btn" (click)="deleteAddress(address)">
                    <mat-icon>delete</mat-icon>
                    Excluir
                  </button>
                  <button *ngIf="!address.is_default" mat-button class="action-btn default-btn" (click)="setDefaultAddress(address)">
                    <mat-icon>star</mat-icon>
                    Definir como Padrão
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog de Endereço -->
      <div *ngIf="showAddressDialog" class="dialog-overlay" (click)="closeAddressDialog()">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2>{{editingAddress ? 'Editar' : 'Novo'}} Endereço</h2>
            <button mat-icon-button (click)="closeAddressDialog()" class="close-button">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          
          <form [formGroup]="addressForm" (ngSubmit)="saveAddress()" class="dialog-form">
            <div class="form-section">
              <h3>Informações do Endereço</h3>
              
              <mat-form-field appearance="outline">
                <mat-label>Nome do Endereço (opcional)</mat-label>
                <input matInput formControlName="name" placeholder="Ex: Casa, Trabalho">
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" class="cep-field">
                  <mat-label>CEP</mat-label>
                  <input matInput formControlName="zipcode" placeholder="00000-000" (input)="formatZipcode($event)" (blur)="searchCep()">
                  <button mat-icon-button matSuffix (click)="searchCep()" [disabled]="!addressForm.get('zipcode')?.value || loadingCep" matTooltip="Buscar endereço pelo CEP">
                    <mat-icon *ngIf="!loadingCep">search</mat-icon>
                    <mat-spinner *ngIf="loadingCep" diameter="20"></mat-spinner>
                  </button>
                  <mat-error *ngIf="addressForm.get('zipcode')?.errors?.['required']">CEP é obrigatório</mat-error>
                  <mat-error *ngIf="addressForm.get('zipcode')?.errors?.['pattern']">CEP inválido</mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="street-field">
                  <mat-label>Rua</mat-label>
                  <input matInput formControlName="street" required>
                  <mat-error *ngIf="addressForm.get('street')?.hasError('required')">
                    Rua é obrigatória
                  </mat-error>
                </mat-form-field>
                
                <mat-form-field appearance="outline" class="number-field">
                  <mat-label>Número</mat-label>
                  <input matInput formControlName="number" required>
                  <mat-error *ngIf="addressForm.get('number')?.hasError('required')">
                    Número é obrigatório
                  </mat-error>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Complemento (opcional)</mat-label>
                <input matInput formControlName="complement" placeholder="Apartamento, bloco, etc.">
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" class="neighborhood-field">
                  <mat-label>Bairro</mat-label>
                  <input matInput formControlName="neighborhood" required>
                  <mat-error *ngIf="addressForm.get('neighborhood')?.hasError('required')">
                    Bairro é obrigatório
                  </mat-error>
                </mat-form-field>
                
                <mat-form-field appearance="outline" class="city-field">
                  <mat-label>Cidade</mat-label>
                  <input matInput formControlName="city" required>
                  <mat-error *ngIf="addressForm.get('city')?.hasError('required')">
                    Cidade é obrigatória
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="state-field">
                  <mat-label>Estado</mat-label>
                  <input matInput formControlName="state" required maxlength="2" placeholder="SP">
                  <mat-error *ngIf="addressForm.get('state')?.hasError('required')">
                    Estado é obrigatório
                  </mat-error>
                </mat-form-field>
                
                <mat-form-field appearance="outline" class="zipcode-field">
                  <mat-label>CEP</mat-label>
                  <input matInput formControlName="zipcode" placeholder="00000-000" (input)="formatZipcode($event)">
                  <mat-error *ngIf="addressForm.get('zipcode')?.hasError('required')">
                    CEP é obrigatório
                  </mat-error>
                  <mat-error *ngIf="addressForm.get('zipcode')?.hasError('pattern')">
                    CEP inválido
                  </mat-error>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Observações (opcional)</mat-label>
                <textarea matInput formControlName="notes" placeholder="Instruções para entrega, referências, etc." rows="3"></textarea>
              </mat-form-field>

              <mat-checkbox formControlName="is_default">
                Definir como endereço padrão
              </mat-checkbox>
            </div>

            <div class="form-actions">
              <button mat-button type="button" (click)="closeAddressDialog()">
                Cancelar
              </button>
              <button mat-raised-button color="primary" type="submit" [disabled]="addressForm.invalid || saving">
                <mat-spinner *ngIf="saving" diameter="20"></mat-spinner>
                <span *ngIf="!saving">{{editingAddress ? 'Atualizar' : 'Salvar'}}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./enderecos.component.css']
})
export class EnderecosComponent implements OnInit, OnDestroy {
  addresses: Address[] = [];
  loading = true;
  showAddressDialog = false;
  editingAddress: Address | null = null;
  saving = false;
  loadingCep = false;
  
  addressForm: FormGroup;
  private destroy$ = new Subject<void>();

  constructor(
    private addressService: AddressService,
    private cepService: CepService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.addressForm = this.fb.group({
      name: [''],
      zipcode: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      street: ['', Validators.required],
      number: ['', Validators.required],
      complement: [''],
      neighborhood: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      notes: [''],
      is_default: [false]
    });
  }

  ngOnInit(): void {
    this.loadAddresses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAddresses(): void {
    this.loading = true;
    this.addressService.getAddresses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (addresses) => {
          this.addresses = addresses;
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar endereços:', error);
          this.snackBar.open('Erro ao carregar endereços', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  openAddressDialog(): void {
    this.editingAddress = null;
    this.addressForm.reset();
    this.showAddressDialog = true;
  }

  editAddress(address: Address): void {
    this.editingAddress = address;
    this.addressForm.patchValue(address);
    this.showAddressDialog = true;
  }

  closeAddressDialog(): void {
    this.showAddressDialog = false;
    this.editingAddress = null;
    this.addressForm.reset();
  }

  saveAddress(): void {
    if (this.addressForm.valid) {
      this.saving = true;
      const formData = this.addressForm.value;
      
      const request: CreateAddressRequest = {
        name: formData.name,
        zipcode: formData.zipcode,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        notes: formData.notes,
        is_default: formData.is_default
      };

      const operation = this.editingAddress 
        ? this.addressService.updateAddress(this.editingAddress.id, request)
        : this.addressService.createAddress(request);

      operation.pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.snackBar.open(
            this.editingAddress ? 'Endereço atualizado com sucesso!' : 'Endereço criado com sucesso!',
            'Fechar',
            { duration: 3000 }
          );
          this.closeAddressDialog();
          this.loadAddresses();
        },
        error: (error) => {
          console.error('Erro ao salvar endereço:', error);
          this.snackBar.open('Erro ao salvar endereço', 'Fechar', { duration: 3000 });
        },
        complete: () => {
          this.saving = false;
        }
      });
    }
  }

  deleteAddress(address: Address): void {
    if (confirm('Tem certeza que deseja excluir este endereço?')) {
      this.addressService.deleteAddress(address.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.snackBar.open('Endereço excluído com sucesso!', 'Fechar', { duration: 3000 });
            this.loadAddresses();
          },
          error: (error) => {
            console.error('Erro ao excluir endereço:', error);
            this.snackBar.open('Erro ao excluir endereço', 'Fechar', { duration: 3000 });
          }
        });
    }
  }

  setDefaultAddress(address: Address): void {
    this.addressService.setDefaultAddress(address.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Endereço definido como padrão!', 'Fechar', { duration: 3000 });
          this.loadAddresses();
        },
        error: (error) => {
          console.error('Erro ao definir endereço padrão:', error);
          this.snackBar.open('Erro ao definir endereço padrão', 'Fechar', { duration: 3000 });
        }
      });
  }

  formatZipcode(event: any): void {
    const value = event.target.value.replace(/\D/g, '');
    if (value.length <= 8) {
      const formatted = value.replace(/(\d{5})(\d{3})/, '$1-$2');
      this.addressForm.patchValue({ zipcode: formatted });
    }
  }

  searchCep(): void {
    const zipcode = this.addressForm.get('zipcode')?.value;
    if (zipcode && zipcode.length === 9) {
      this.loadingCep = true;
      this.cepService.searchCep(zipcode)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data: CepFormatted) => {
            this.addressForm.patchValue({
              street: data.street || '',
              neighborhood: data.neighborhood || '',
              city: data.city || '',
              state: data.state || ''
            });
          },
          error: (error) => {
            console.error('Erro ao buscar CEP:', error);
            this.snackBar.open('CEP não encontrado', 'Fechar', { duration: 3000 });
          },
          complete: () => {
            this.loadingCep = false;
          }
        });
    }
  }
}