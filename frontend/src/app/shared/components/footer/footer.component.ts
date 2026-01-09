import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicSettingsService, PublicSettings } from '../../../core/services/public-settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class FooterComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  settings: PublicSettings | null = null;
  private settingsSubscription?: Subscription;
  
  private publicSettingsService = inject(PublicSettingsService);

  ngOnInit(): void {
    // Carregar configurações iniciais se ainda não foram carregadas
    const currentSettings = this.publicSettingsService.getCurrentSettings();
    if (!currentSettings) {
      this.publicSettingsService.getSettings().subscribe({
        error: (error) => {
          console.error('Erro ao carregar configurações:', error);
        }
      });
    }

    // Observar mudanças nas configurações
    this.settingsSubscription = this.publicSettingsService.watchSettings().subscribe(settings => {
      this.settings = settings;
    });
  }

  ngOnDestroy(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }

  /**
   * Gera URL do WhatsApp a partir do número de telefone
   * Remove formatação e garante código do país (55 para Brasil se não tiver)
   */
  getWhatsAppUrl(phone: string | undefined): string {
    if (!phone) return '#';
    
    // Remove todos os caracteres não numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Se já tem código do país (começa com 55), retorna como está
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      return `https://wa.me/${cleanPhone}`;
    }
    
    // Se começar com 0, remove (formato antigo de telefone brasileiro)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    // Se não tiver código do país (55 para Brasil), adiciona
    // Números brasileiros têm 10 ou 11 dígitos (DDD + número)
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }
    
    return `https://wa.me/${cleanPhone}`;
  }
}