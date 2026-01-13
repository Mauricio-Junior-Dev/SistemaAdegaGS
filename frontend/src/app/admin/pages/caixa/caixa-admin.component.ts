import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

interface CashSessionRow {
  id: number;
  opened_at: string;
  closed_at?: string;
  opened_by?: string;
  initial_amount: number;
  closing_amount?: number;
  is_open: boolean;
  current_amount: number;
  total_income: number;
  total_outcome: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

@Component({
  selector: 'app-caixa-admin',
  standalone: true,
  templateUrl: './caixa-admin.component.html',
  styleUrls: ['./caixa-admin.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatPaginatorModule
  ]
})
export class CaixaAdminComponent implements OnInit, OnDestroy {
  displayedColumns = ['opened_at', 'opened_by', 'initial_amount', 'current_amount', 'total_income', 'total_outcome', 'status'];
  rows: CashSessionRow[] = [];
  loading = false;
  filterDate = '';
  filterOpen: 'all' | 'true' | 'false' = 'all';
  total = 0;
  perPage = 10;
  page = 0;

  private api = `${environment.apiUrl}/admin/cash`;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {}

  load(event?: PageEvent): void {
    this.loading = true;
    if (event) {
      this.page = event.pageIndex;
      this.perPage = event.pageSize;
    }

    let params = new HttpParams()
      .set('per_page', this.perPage)
      .set('page', this.page + 1);
    if (this.filterDate) params = params.set('date', this.filterDate);
    if (this.filterOpen !== 'all') params = params.set('is_open', this.filterOpen === 'true' ? '1' : '0');

    this.http.get<PaginatedResponse<CashSessionRow>>(`${this.api}/sessions`, { params }).subscribe({
      next: (res) => {
        this.rows = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Erro ao carregar sessões de caixa', 'Fechar', { duration: 3000 });
      }
    });
  }

  statusText(row: CashSessionRow): string {
    return row.is_open ? 'Aberto' : 'Fechado';
  }
}


