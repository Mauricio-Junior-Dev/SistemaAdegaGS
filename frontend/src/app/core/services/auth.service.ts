import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '../models/auth.model';
import { OrderService } from '../../employee/services/order.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private userSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  user$ = this.userSubject.asObservable();
  token$ = this.tokenSubject.asObservable();

  constructor(
    private http: HttpClient,
    private orderService: OrderService
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
      this.handleAutoRefresh(user);
    }
  }

  private saveAuthInternal(response: AuthResponse): void {
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('token', response.access_token);
    this.userSubject.next(response.user);
    this.tokenSubject.next(response.access_token);
    this.handleAutoRefresh(response.user);
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data)
      .pipe(tap(response => this.saveAuthInternal(response)));
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data)
      .pipe(tap(response => this.saveAuthInternal(response)));
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      tap(() => {
        console.log('Limpando dados de autenticação');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        this.userSubject.next(null);
        this.tokenSubject.next(null);
        console.log('Usuário após logout:', this.userSubject.value);
        this.orderService.stopAutoRefresh();
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

  private handleAutoRefresh(user: User | null): void {
    if (user && user.type === 'employee') {
      this.orderService.startAutoRefresh();
    } else {
      this.orderService.stopAutoRefresh();
    }
  }
}