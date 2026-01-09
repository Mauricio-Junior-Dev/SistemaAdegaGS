import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
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
  delivery_price?: number | null;
  current_stock: number;
  min_stock: number;
  doses_por_garrafa: number;
  can_sell_by_dose: boolean;
  dose_price?: number;
  barcode?: string;
  category_id: number;
  parent_product_id?: number | null;
  stock_multiplier?: number;
  category?: {
    id: number;
    name: string;
  };
  parent_product?: Product;
  image_url?: string;
  is_active: boolean;
  visible_online?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductDTO {
  name: string;
  description: string;
  price: number;
  delivery_price?: number | null;
  original_price?: number | null;
  current_stock: number;
  min_stock: number;
  doses_por_garrafa: number;
  can_sell_by_dose: boolean;
  dose_price?: number | null;
  barcode?: string | null;
  category_id: number;
  parent_product_id?: number | null;
  stock_multiplier?: number;
  image?: File;
  is_active: boolean;
  visible_online?: boolean;
  featured?: boolean;
  offers?: boolean;
  popular?: boolean;
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
    featured?: boolean;
    offers?: boolean;
    is_pack?: boolean;
    visible_online?: boolean;
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
    // Normalizar payload
    const payload: any = { ...product };
    
    // Normalizar campos numéricos
    const numericFields = ['price', 'original_price', 'current_stock', 'min_stock', 'doses_por_garrafa', 'dose_price', 'category_id'];
    numericFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        payload[field] = Number(payload[field]);
      } else if (payload[field] === '') {
        // Campos nullable: converter string vazia para null
        if (field === 'original_price' || field === 'dose_price') {
          payload[field] = null;
        }
      }
    });
    
    // Normalizar campos de texto nullable
    if (payload.barcode === '') {
      payload.barcode = null;
    }
    
    // Normalizar booleanos
    const booleanFields = ['is_active', 'visible_online', 'featured', 'offers', 'popular', 'can_sell_by_dose'];
    booleanFields.forEach(field => {
      if (payload[field] !== undefined) {
        payload[field] = payload[field] === true || payload[field] === 'true' || payload[field] === 1 || payload[field] === '1';
      }
    });

    const formData = new FormData();
    
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'image' && value instanceof File) {
          formData.append('image', value, value.name);
        } else if (typeof value === 'boolean') {
          formData.append(key, value ? '1' : '0');
        } else if (typeof value === 'number') {
          formData.append(key, value.toString());
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return this.http.post<Product>(this.apiUrl, formData);
  }

  updateProduct(product: UpdateProductDTO): Observable<Product> {
    const { id, image, ...rest } = product as any;

    // Normalizar payload
    const payload: any = { ...rest };
    
    // Campos obrigatórios que sempre devem ser incluídos
    const requiredFields = ['name', 'description', 'category_id', 'price', 'current_stock', 'min_stock', 'doses_por_garrafa'];
    
    // Converter category_id para número
    if (payload.category_id !== undefined && payload.category_id !== null && payload.category_id !== '') {
      payload.category_id = Number(payload.category_id);
    } else if (payload.category_id === '') {
      // Se estiver vazio, manter como está para que a validação do backend trate
    }
    
    // Normalizar campos numéricos obrigatórios
    const requiredNumericFields = ['price', 'current_stock', 'min_stock', 'doses_por_garrafa'];
    requiredNumericFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        payload[field] = Number(payload[field]);
      }
    });
    
    // Normalizar campos numéricos nullable
    const nullableNumericFields = ['original_price', 'dose_price'];
    nullableNumericFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        payload[field] = Number(payload[field]);
      } else if (payload[field] === '') {
        payload[field] = null;
      }
    });
    
    // Normalizar campos de texto nullable
    if (payload.barcode !== undefined) {
      if (payload.barcode === '') {
        payload.barcode = null;
      }
    }
    
    // Normalizar booleanos
    const booleanFields = ['is_active', 'visible_online', 'featured', 'offers', 'popular', 'can_sell_by_dose'];
    booleanFields.forEach(field => {
      if (payload[field] !== undefined) {
        payload[field] = payload[field] === true || payload[field] === 'true' || payload[field] === 1 || payload[field] === '1';
      }
    });

    // Com imagem: fazer upload da imagem primeiro, depois atualizar produto com JSON
    if (image instanceof File) {
      // Primeiro, fazer upload da imagem usando o endpoint específico
      return this.uploadImage(id, image).pipe(
        // Depois, atualizar o produto com os outros dados via JSON
        switchMap(() => {
          // Remover campos nullable null para enviar apenas o necessário
          const jsonPayload: any = { ...payload };
          if (jsonPayload.barcode === null) delete jsonPayload.barcode;
          if (jsonPayload.original_price === null) delete jsonPayload.original_price;
          if (jsonPayload.dose_price === null) delete jsonPayload.dose_price;
          
          return this.http.put<Product>(`${this.apiUrl}/${id}`, jsonPayload);
        })
      );
    }

    // Sem imagem: PUT JSON
    // Remover campos nullable null para enviar apenas o necessário
    const jsonPayload: any = { ...payload };
    if (jsonPayload.barcode === null) delete jsonPayload.barcode;
    if (jsonPayload.original_price === null) delete jsonPayload.original_price;
    if (jsonPayload.dose_price === null) delete jsonPayload.dose_price;
    
    return this.http.put<Product>(`${this.apiUrl}/${id}`, jsonPayload);
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
