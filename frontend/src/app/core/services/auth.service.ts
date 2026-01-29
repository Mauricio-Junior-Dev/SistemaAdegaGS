import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private userSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private authStatus = new BehaviorSubject<boolean>(this.isAuthenticated());

  user$ = this.userSubject.asObservable();
  token$ = this.tokenSubject.asObservable();
  public authStatus$ = this.authStatus.asObservable();

  constructor(
    private http: HttpClient
  ) {
    this.loadStoredAuth();
  }

  private loadStoredAuth(): void {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      const user = JSON.parse(storedUser) as User;
      this.userSubject.next(user);
      this.tokenSubject.next(storedToken);
      // Garantir que o authStatus está sincronizado com o estado real
      this.authStatus.next(true);
    } else {
      // Garantir que o authStatus está false se não há token
      this.authStatus.next(false);
    }
  }

  private saveAuthInternal(response: AuthResponse): void {
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('token', response.access_token);
    this.userSubject.next(response.user);
    this.tokenSubject.next(response.access_token);
    this.authStatus.next(true);
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data)
      .pipe(tap(response => this.saveAuthInternal(response)));
  }

  checkUser(identifier: string): Observable<{ exists: boolean; user?: any }> {
    return this.http.post<{ exists: boolean; user?: any }>(`${this.apiUrl}/auth/check-user`, { identifier });
  }

  /** Valida CPF + últimos 4 dígitos do celular. Retorna reset_token temporário. */
  validatePasswordReset(document_number: string, phone_last_4: string): Observable<{ reset_token: string; expires_in: number }> {
    const doc = (document_number || '').replace(/\D/g, '');
    const last4 = (phone_last_4 || '').replace(/\D/g, '').slice(-4);
    return this.http.post<{ message: string; reset_token: string; expires_in: number }>(
      `${this.apiUrl}/password/validate-reset`,
      { document_number: doc, phone_last_4: last4 }
    );
  }

  /** Confirma nova senha usando reset_token. */
  confirmPasswordReset(reset_token: string, password: string, password_confirmation: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/password/reset-confirm`, {
      reset_token,
      password,
      password_confirmation
    });
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data)
      .pipe(tap(response => this.saveAuthInternal(response)));
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      tap(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        this.userSubject.next(null);
        this.tokenSubject.next(null);
        this.authStatus.next(false);
      })
    );
  }

  updateProfile(data: UpdateProfileRequest): Observable<{ message: string; user: User }> {
    return this.http.put<{ message: string; user: User }>(`${this.apiUrl}/user`, data)
      .pipe(tap(response => {
        const user = response.user;
        localStorage.setItem('user', JSON.stringify(user));
        this.userSubject.next(user);
      }));
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/user`);
  }

  isLoggedIn(): boolean {
    return !!this.tokenSubject.value;
  }

  isAdmin(): boolean {
    const user = this.userSubject.value;
    return user?.type === 'admin';
  }

  isEmployee(): boolean {
    const user = this.userSubject.value;
    return user?.type === 'employee';
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  saveAuth(response: AuthResponse): void {
    this.saveAuthInternal(response);
  }

  private isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getUserType(): string | null {
    const user = this.userSubject.value;
    return user?.type || null;
  }
}