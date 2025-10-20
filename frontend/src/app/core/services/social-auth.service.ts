import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocialAuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Inicializar Google Sign-In
  initializeGoogle(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.google) {
        this.setupGoogleAuth();
        resolve();
      } else {
        this.loadGoogleScript().then(() => {
          this.setupGoogleAuth();
          resolve();
        }).catch(reject);
      }
    });
  }

  private setupGoogleAuth(): void {
    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => {
        this.handleGoogleResponse(response);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: false
    });
  }

  // Carregar script do Google
  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar script do Google'));
      document.head.appendChild(script);
    });
  }

  // Login com Google
  loginWithGoogle(): void {
    if (window.google && window.google.accounts) {
      try {
        window.google.accounts.id.prompt();
      } catch (error) {
        console.error('Erro ao enviar prompt do Google:', error);
      }
    } else {
      console.error('Google SDK não carregado');
    }
  }

  // Processar resposta do Google
  private handleGoogleResponse(response: any): void {
    try {
      // Decodificar o JWT token
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      
      // Enviar para o backend
      this.sendSocialAuthToBackend('google', {
        token: response.credential,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }).subscribe({
        next: (authResponse) => {
          // Emitir evento para o AuthService processar
          window.dispatchEvent(new CustomEvent('social-auth-success', { 
            detail: authResponse 
          }));
        },
        error: (error) => {
          console.error('Erro na autenticação social:', error);
          window.dispatchEvent(new CustomEvent('social-auth-error', { 
            detail: error 
          }));
        }
      });
    } catch (error) {
      console.error('Erro ao processar token do Google:', error);
      window.dispatchEvent(new CustomEvent('social-auth-error', { 
        detail: { message: 'Erro ao processar token do Google' }
      }));
    }
  }


  // Enviar dados para o backend
  sendSocialAuthToBackend(provider: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/social`, {
      provider,
      ...data
    });
  }
}

// Declarações de tipos para TypeScript
declare global {
  interface Window {
    google: any;
    FB: any;
  }
}
