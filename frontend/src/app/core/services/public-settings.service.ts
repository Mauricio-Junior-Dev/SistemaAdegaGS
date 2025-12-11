import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface PublicSettings {
  site_name: string;
  site_description: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  logo_url?: string;
  favicon_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PublicSettingsService {
  private apiUrl = `${environment.apiUrl}/public/settings`;
  private settings = new BehaviorSubject<PublicSettings | null>(null);

  constructor(private http: HttpClient) {}

  getSettings(): Observable<PublicSettings> {
    return this.http.get<PublicSettings>(this.apiUrl).pipe(
      tap(settings => this.settings.next(settings))
    );
  }

  getCurrentSettings(): PublicSettings | null {
    return this.settings.value;
  }

  watchSettings(): Observable<PublicSettings | null> {
    return this.settings.asObservable();
  }

  getLogoUrl(logoUrl: string | undefined): string {
    if (!logoUrl) return '';
    
    // Se a URL já é completa, retorna como está
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return logoUrl;
    }
    
    // Se é um caminho relativo, adiciona a URL do backend
    if (logoUrl.startsWith('/storage/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return baseUrl + logoUrl;
    }
    
    return logoUrl;
  }

  getFaviconUrl(faviconUrl: string | undefined): string {
    if (!faviconUrl) return '';
    
    // Se a URL já é completa, retorna como está
    if (faviconUrl.startsWith('http://') || faviconUrl.startsWith('https://')) {
      return faviconUrl;
    }
    
    // Se é um caminho relativo, adiciona a URL do backend
    if (faviconUrl.startsWith('/storage/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return baseUrl + faviconUrl;
    }
    
    return faviconUrl;
  }
}
