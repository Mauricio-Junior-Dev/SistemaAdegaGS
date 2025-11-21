import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Verificar se a requisição é para uma API externa (como ViaCEP)
  const isExternalRequest = isExternalUrl(req.url);
  
  // Se for requisição externa, não adicionar headers de autenticação nem credentials
  if (isExternalRequest) {
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Para APIs externas, apenas repassar o erro sem tratamento de autenticação
        return throwError(() => error);
      })
    );
  }
  
  // Requisição interna: adicionar headers de autenticação
  const token = authService.getToken();

  // Verificar se é FormData (não definir Content-Type para permitir multipart/form-data)
  const isFormData = req.body instanceof FormData;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };

  // Adicionar token se existir
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Não definir Content-Type para FormData (o navegador define automaticamente com boundary)
  // Apenas definir Content-Type para requisições JSON
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // Clonar a requisição, adicionar os headers e enviar cookies de credencial
  req = req.clone({
    setHeaders: headers,
    withCredentials: true
  });

  // Passar a requisição para o próximo handler
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Se receber 401, limpar dados e redirecionar para login
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};

/**
 * Verifica se a URL é de uma API externa (não é da nossa API)
 * @param url URL da requisição (pode ser absoluta ou relativa)
 * @returns true se for URL externa, false se for da nossa API
 */
function isExternalUrl(url: string): boolean {
  // Se a URL é absoluta (começa com http:// ou https://)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      // Verificar se não é da nossa API
      // Extrair o hostname da nossa API (ex: localhost:8000 de http://localhost:8000/api)
      const apiUrl = environment.apiUrl.replace(/\/api\/?$/, ''); // Remove /api do final
      const apiHost = new URL(apiUrl).hostname;
      const requestHost = new URL(url).hostname;
      
      // Se o hostname for diferente, é uma API externa
      return requestHost !== apiHost;
    } catch (error) {
      // Se houver erro ao parsear a URL, assumir que é externa por segurança
      console.warn('Erro ao verificar URL:', error);
      return true;
    }
  }
  
  // Se a URL é relativa (não começa com http:// ou https://)
  // URLs relativas são sempre da nossa API (serão resolvidas para environment.apiUrl)
  return false;
}
