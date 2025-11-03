import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
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

  // Clonar a requisição e adicionar os headers
  req = req.clone({
    setHeaders: headers
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
