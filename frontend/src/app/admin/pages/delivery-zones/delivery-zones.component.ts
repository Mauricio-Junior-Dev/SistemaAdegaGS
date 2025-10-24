import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subject, takeUntil } from 'rxjs';

import { DeliveryZoneService } from '../../../services/delivery-zone.service';
import { DeliveryZone } from '../../../models/delivery-zone.model';
import { DeliveryZoneFormDialogComponent } from './dialogs/delivery-zone-form-dialog.component';

@Component({
  selector: 'app-delivery-zones',
  templateUrl: './delivery-zones.component.html',
  styleUrls: ['./delivery-zones.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule
  ]
})
export class DeliveryZonesComponent implements OnInit, OnDestroy {
  deliveryZones: DeliveryZone[] = [];
  filteredZones: DeliveryZone[] = [];
  loading = false;
  searchTerm = '';
  statusFilter = 'all';
  
  displayedColumns: string[] = [
    'nome_bairro',
    'valor_frete',
    'tempo_estimado',
    'ativo',
    'actions'
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private deliveryZoneService: DeliveryZoneService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDeliveryZones();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDeliveryZones(): void {
    this.loading = true;
    this.deliveryZoneService.getAdminDeliveryZones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (zones) => {
          this.deliveryZones = zones;
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar zonas de entrega:', error);
          this.snackBar.open('Erro ao carregar zonas de entrega', 'Fechar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.deliveryZones];

    // Filtrar por termo de busca
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(zone => 
        zone.nome_bairro.toLowerCase().includes(term) ||
        zone.tempo_estimado?.toLowerCase().includes(term)
      );
    }

    // Filtrar por status
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(zone => zone.ativo);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(zone => !zone.ativo);
    }

    this.filteredZones = filtered;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  openFormDialog(zone?: DeliveryZone): void {
    const dialogRef = this.dialog.open(DeliveryZoneFormDialogComponent, {
      width: '500px',
      data: { zone }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadDeliveryZones();
      }
    });
  }

  deleteDeliveryZone(zone: DeliveryZone): void {
    if (confirm(`Tem certeza que deseja excluir a zona de entrega "${zone.nome_bairro}"?`)) {
      this.deliveryZoneService.deleteDeliveryZone(zone.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.snackBar.open('Zona de entrega excluída com sucesso', 'Fechar', { duration: 3000 });
            this.loadDeliveryZones();
          },
          error: (error) => {
            console.error('Erro ao excluir zona de entrega:', error);
            this.snackBar.open('Erro ao excluir zona de entrega', 'Fechar', { duration: 3000 });
          }
        });
    }
  }

  toggleStatus(zone: DeliveryZone): void {
    const updatedZone = { ...zone, ativo: !zone.ativo };
    
    this.deliveryZoneService.updateDeliveryZone(zone.id, updatedZone)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(`Zona de entrega ${zone.ativo ? 'desativada' : 'ativada'} com sucesso`, 'Fechar', { duration: 3000 });
          this.loadDeliveryZones();
        },
        error: (error) => {
          console.error('Erro ao atualizar status da zona de entrega:', error);
          this.snackBar.open('Erro ao atualizar status da zona de entrega', 'Fechar', { duration: 3000 });
        }
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}
