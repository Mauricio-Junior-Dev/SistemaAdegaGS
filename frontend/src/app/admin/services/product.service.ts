import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductResponse {
  data: Product[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  current_stock: number;
  min_stock: number;
  doses_por_garrafa: number;
  can_sell_by_dose: boolean;
  dose_price?: number;
  sku: string;
  barcode?: string;
  category_id: number;
  category?: {
    id: number;
    name: string;
  };
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductDTO {
  name: string;
  description: string;
  price: number;
  current_stock: number;
  min_stock: number;
  doses_por_garrafa: number;
  can_sell_by_dose: boolean;
  dose_price?: number;
  sku: string;
  barcode?: string;
  category_id: number;
  image?: File;
  is_active: boolean;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
  id: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiUrl}/admin/products`;

  constructor(private http: HttpClient) {}

  getProducts(params: {
    page?: number;
    per_page?: number;
    search?: string;
    category_id?: number;
    is_active?: boolean;
    low_stock?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Observable<ProductResponse> {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<ProductResponse>(this.apiUrl, { params: httpParams });
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  createProduct(product: CreateProductDTO): Observable<Product> {
    const formData = new FormData();
    
    Object.entries(product).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'image' && value instanceof File) {
          formData.append('image', value, value.name);
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    return this.http.post<Product>(this.apiUrl, formData);
  }

  updateProduct(product: UpdateProductDTO): Observable<Product> {
    const { id, image, ...rest } = product as any;

    // Normalizar
    const payload: any = { ...rest };
    if (payload.category_id !== undefined && payload.category_id !== null && payload.category_id !== '') {
      payload.category_id = Number(payload.category_id);
    }
    if (payload.is_active !== undefined) payload.is_active = !!payload.is_active;

    // Com imagem: POST com _method=PUT
    if (image instanceof File) {
      const formData = new FormData();
      if (payload.name !== undefined && payload.name !== null) formData.append('name', String(payload.name));
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'name') return;
        if (value !== undefined && value !== null) {
          if (typeof value === 'boolean') formData.append(key, value ? '1' : '0');
          else formData.append(key, value.toString());
        }
      });
      formData.append('image', image, image.name);
      formData.append('_method', 'PUT');
      return this.http.post<Product>(`${this.apiUrl}/${id}`, formData);
    }

    // Sem imagem: PUT JSON
    return this.http.put<Product>(`${this.apiUrl}/${id}`, payload);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleStatus(id: number): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  uploadImage(id: number, image: File): Observable<Product> {
    const formData = new FormData();
    formData.append('image', image, image.name);
    return this.http.post<Product>(`${this.apiUrl}/${id}/image`, formData);
  }

  deleteImage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/image`);
  }

  generateSku(): Observable<{ sku: string }> {
    return this.http.get<{ sku: string }>(`${this.apiUrl}/generate-sku`);
  }

  validateSku(sku: string, excludeId?: number): Observable<{ valid: boolean }> {
    let params = new HttpParams().set('sku', sku);
    if (excludeId) {
      params = params.set('exclude_id', excludeId.toString());
    }
    return this.http.get<{ valid: boolean }>(`${this.apiUrl}/validate-sku`, { params });
  }

  validateBarcode(barcode: string, excludeId?: number): Observable<{ valid: boolean }> {
    let params = new HttpParams().set('barcode', barcode);
    if (excludeId) {
      params = params.set('exclude_id', excludeId.toString());
    }
    return this.http.get<{ valid: boolean }>(`${this.apiUrl}/validate-barcode`, { params });
  }

  importProducts(file: File): Observable<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imported: number; errors: string[] }>(`${this.apiUrl}/import`, formData);
  }

  exportProducts(format: 'csv' | 'xlsx' = 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export`, {
      params: { format },
      responseType: 'blob'
    });
  }
}
