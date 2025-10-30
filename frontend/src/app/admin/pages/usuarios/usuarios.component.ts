import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule, MatTable } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';

import { UserService, User } from '../../services/user.service';
import { UserFormDialogComponent } from './dialogs/user-form-dialog.component';
import { UserImportDialogComponent } from './dialogs/user-import-dialog.component';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  @ViewChild(MatTable) table!: MatTable<User>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  users: User[] = [];
  loading = true;
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  searchTerm = '';
  selectedType: 'admin' | 'employee' | 'customer' | undefined = undefined;
  showInactive = false;
  displayedColumns = ['name', 'email', 'type', 'last_login', 'status', 'actions'];

  constructor(
    private userService: UserService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getUsers({
      page: this.currentPage + 1,
      per_page: this.pageSize,
      search: this.searchTerm,
      type: this.selectedType,
      is_active: this.showInactive ? false : true
    }).subscribe({
      next: (response) => {
        this.users = response.data;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: (error: unknown) => {
        console.error('Erro ao carregar usuários:', error);
        this.snackBar.open('Erro ao carregar usuários', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.currentPage = 0;
    this.loadUsers();
  }

  onTypeChange(): void {
    this.currentPage = 0;
    this.loadUsers();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.loadUsers();
  }

  onSortChange(sort: Sort): void {
    // Implementar ordenação quando backend suportar
  }

  toggleFilters(filter: string): void {
    switch (filter) {
      case 'inactive':
        this.showInactive = !this.showInactive;
        break;
    }
    this.currentPage = 0;
    this.loadUsers();
  }

  openUserDialog(user?: User): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '800px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  openImportDialog(): void {
    const dialogRef = this.dialog.open(UserImportDialogComponent, {
      width: '600px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }


  exportUsers(format: 'xlsx' | 'csv'): void {
    this.userService.exportUsers(format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `usuarios_${new Date().toISOString().split('T')[0]}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error: unknown) => {
        console.error('Erro ao exportar usuários:', error);
        this.snackBar.open('Erro ao exportar usuários', 'Fechar', { duration: 3000 });
      }
    });
  }


  toggleStatus(user: User): void {
    const action = user.is_active ? 'desativar' : 'ativar';
    const newStatus = !user.is_active;

    this.userService.updateStatus(user.id, newStatus).subscribe({
      next: () => {
        user.is_active = newStatus;
        this.snackBar.open(
          `Usuário ${action === 'ativar' ? 'ativado' : 'desativado'} com sucesso!`,
          'Fechar',
          { duration: 3000 }
        );
      },
      error: (error: unknown) => {
        console.error(`Erro ao ${action} usuário:`, error);
        this.snackBar.open(
          `Erro ao ${action} usuário`,
          'Fechar',
          { duration: 3000 }
        );
      }
    });
  }

  deleteUser(user: User): void {
    if (confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
          this.snackBar.open('Usuário excluído com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (error: unknown) => {
          console.error('Erro ao excluir usuário:', error);
          this.snackBar.open('Erro ao excluir usuário', 'Fechar', { duration: 3000 });
        }
      });
    }
  }

  getTypeColor(type: string): string {
    switch (type) {
      case 'admin':
        return '#f44336'; // vermelho
      case 'employee':
        return '#2196f3'; // azul
      case 'customer':
        return '#4caf50'; // verde
      default:
        return '#9e9e9e'; // cinza
    }
  }

  formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'admin':
        return 'Administrador';
      case 'employee':
        return 'Funcionário';
      case 'customer':
        return 'Cliente';
      default:
        return type;
    }
  }
}