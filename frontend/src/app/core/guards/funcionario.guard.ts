import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';

export const funcionarioGuard = () => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  const authService = inject(AuthService);

  if (authService.isEmployee() || authService.isAdmin()) {
    return true;
  }

  snackBar.open('Acesso não autorizado', 'Fechar', {
    duration: 3000,
    horizontalPosition: 'end',
    verticalPosition: 'top'
  });

  router.navigate(['/login']);
  return false;
};