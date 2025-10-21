import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Banner {
  id: number;
  image_url: string;
  title?: string;
  subtitle?: string;
  link?: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerRequest {
  image_url: string;
  title?: string;
  subtitle?: string;
  link?: string;
  order: number;
  is_active: boolean;
}

export interface UpdateBannerRequest extends Partial<CreateBannerRequest> {
  id: number;
}

@Injectable({
  providedIn: 'root'
})
export class BannerService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  getActiveBanners(): Observable<Banner[]> {
    return this.http.get<Banner[]>(`${this.apiUrl}/banners/active`);
  }

  getAllBanners(): Observable<Banner[]> {
    return this.http.get<Banner[]>(`${this.apiUrl}/admin/banners`);
  }

  getBanner(id: number): Observable<Banner> {
    return this.http.get<Banner>(`${this.apiUrl}/admin/banners/${id}`);
  }

  createBanner(banner: CreateBannerRequest): Observable<Banner> {
    return this.http.post<Banner>(`${this.apiUrl}/admin/banners`, banner);
  }

  updateBanner(banner: UpdateBannerRequest): Observable<Banner> {
    return this.http.put<Banner>(`${this.apiUrl}/admin/banners/${banner.id}`, banner);
  }

  deleteBanner(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/banners/${id}`);
  }

  uploadBannerImage(file: File): Observable<{ image_url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ image_url: string }>(`${this.apiUrl}/admin/banners/upload`, formData);
  }

  reorderBanners(bannerIds: number[]): Observable<Banner[]> {
    return this.http.post<Banner[]>(`${this.apiUrl}/admin/banners/reorder`, { banner_ids: bannerIds });
  }
}
