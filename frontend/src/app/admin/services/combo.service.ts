import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Combo, ComboFormData, ComboFormDataForBackend, ComboPriceCalculation, Product } from '../../core/models/combo.model';
import { PaginatedResponse } from '../../core/models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class ComboService {
  private apiUrl = `${environment.apiUrl}/admin/combos`;

  constructor(private http: HttpClient) {}

  // Listar combos com filtros e paginação
  getCombos(params?: {
    search?: string;
    is_active?: boolean;
    featured?: boolean;
    offers?: boolean;
    sort_by?: string;
    sort_order?: string;
    per_page?: number;
    page?: number;
  }): Observable<PaginatedResponse<Combo>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] !== undefined && params[key as keyof typeof params] !== null) {
          httpParams = httpParams.set(key, params[key as keyof typeof params]!.toString());
        }
      });
    }

    return this.http.get<PaginatedResponse<Combo>>(this.apiUrl, { params: httpParams });
  }

  // Obter combo por ID
  getCombo(id: number): Observable<Combo> {
    return this.http.get<Combo>(`${this.apiUrl}/${id}`);
  }

  // Criar combo
  createCombo(comboData: ComboFormData): Observable<Combo> {
    // Se houver imagens, usar FormData
    if (comboData.images && comboData.images.length > 0) {
      const formData = this.createFormData(comboData);
      console.log('Enviando FormData com imagens');
      return this.http.post<Combo>(this.apiUrl, formData);
    }
    
    // Caso contrário, enviar JSON normal
    const processedData = {
      ...comboData,
      price: Number(comboData.price),
      original_price: comboData.original_price ? Number(comboData.original_price) : undefined,
      discount_percentage: comboData.discount_percentage ? Number(comboData.discount_percentage) : undefined,
      products: comboData.products.map(product => ({
        product_id: Number(product.product_id),
        quantity: Number(product.quantity),
        sale_type: product.sale_type
      }))
    };
    
    // Remover imagens do objeto JSON (não são enviadas como JSON)
    delete (processedData as any).images;
    
    console.log('Dados que serão enviados (JSON):', processedData);
    return this.http.post<Combo>(this.apiUrl, processedData);
  }

  // Atualizar combo
  updateCombo(id: number, comboData: ComboFormData | ComboFormDataForBackend): Observable<Combo> {
    // Se houver imagens, usar FormData com method spoofing (POST com _method=PUT)
    // O Laravel não processa corretamente multipart/form-data em requisições PUT
    if ((comboData as ComboFormData).images && (comboData as ComboFormData).images!.length > 0) {
      const formData = this.createFormData(comboData as ComboFormData);
      // Adicionar method spoofing para o Laravel reconhecer como PUT
      formData.append('_method', 'PUT');
      console.log('Enviando FormData com imagens para atualização (method spoofing)');
      return this.http.post<Combo>(`${this.apiUrl}/${id}`, formData);
    }
    
    // Caso contrário, enviar JSON normal
    const processedData: any = { ...comboData };
    
    // Converter valores se necessário
    if (processedData.price !== undefined) {
      processedData.price = Number(processedData.price);
    }
    if (processedData.original_price !== undefined) {
      processedData.original_price = processedData.original_price ? Number(processedData.original_price) : undefined;
    }
    if (processedData.discount_percentage !== undefined) {
      processedData.discount_percentage = processedData.discount_percentage ? Number(processedData.discount_percentage) : undefined;
    }
    
    // Converter produtos se necessário
    if (processedData.products && Array.isArray(processedData.products)) {
      processedData.products = processedData.products.map((product: any) => ({
        product_id: Number(product.product_id),
        quantity: Number(product.quantity),
        sale_type: product.sale_type
      }));
    }
    
    // Remover imagens do objeto JSON
    delete processedData.images;
    
    console.log('Dados que serão enviados para atualização (JSON):', processedData);
    return this.http.put<Combo>(`${this.apiUrl}/${id}`, processedData);
  }

  // Excluir combo
  deleteCombo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Alternar status do combo
  toggleStatus(id: number): Observable<Combo> {
    return this.http.patch<Combo>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  // Upload de imagem
  uploadImage(id: number, image: File): Observable<Combo> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<Combo>(`${this.apiUrl}/${id}/image`, formData);
  }

  // Deletar imagem
  deleteImage(id: number, imageUrl: string): Observable<Combo> {
    return this.http.delete<Combo>(`${this.apiUrl}/${id}/image`, {
      body: { image_url: imageUrl }
    });
  }

  // Gerar SKU
  generateSku(): Observable<{ sku: string }> {
    return this.http.get<{ sku: string }>(`${this.apiUrl}/generate-sku`);
  }

  // Validar SKU
  validateSku(sku: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${this.apiUrl}/validate-sku`, {
      params: { sku }
    });
  }

  // Validar código de barras
  validateBarcode(barcode: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${this.apiUrl}/validate-barcode`, {
      params: { barcode }
    });
  }

  // Obter produtos disponíveis
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  // Calcular preço do combo
  calculatePrice(products: Array<{
    product_id: number;
    quantity: number;
    sale_type: 'dose' | 'garrafa';
  }>, discountPercentage?: number): Observable<ComboPriceCalculation> {
    // Converter números para strings conforme esperado pelo backend
    const processedProducts = products.map(product => ({
      product_id: String(product.product_id),
      quantity: String(product.quantity),
      sale_type: product.sale_type
    }));

    return this.http.post<ComboPriceCalculation>(`${this.apiUrl}/calculate-price`, {
      products: processedProducts,
      discount_percentage: discountPercentage
    });
  }

  // Método privado para criar FormData
  private createFormData(comboData: ComboFormData): FormData {
    const formData = new FormData();
    
    formData.append('name', comboData.name);
    if (comboData.description) {
      formData.append('description', comboData.description);
    }
    formData.append('price', comboData.price.toString());
    if (comboData.original_price) {
      formData.append('original_price', comboData.original_price.toString());
    }
    if (comboData.discount_percentage) {
      formData.append('discount_percentage', comboData.discount_percentage.toString());
    }
    formData.append('sku', comboData.sku);
    if (comboData.barcode) {
      formData.append('barcode', comboData.barcode);
    }
    // Converter booleanos para '1' ou '0' para o Laravel aceitar via FormData
    formData.append('is_active', comboData.is_active ? '1' : '0');
    formData.append('featured', comboData.featured ? '1' : '0');
    formData.append('offers', comboData.offers ? '1' : '0');
    formData.append('popular', comboData.popular ? '1' : '0');
    
    // Adicionar produtos
    comboData.products.forEach((product: any, index: number) => {
      formData.append(`products[${index}][product_id]`, product.product_id.toString());
      formData.append(`products[${index}][quantity]`, product.quantity.toString());
      formData.append(`products[${index}][sale_type]`, product.sale_type);
    });
    
    // Adicionar imagens
    if (comboData.images) {
      comboData.images.forEach((image: File, index: number) => {
        formData.append(`images[${index}]`, image);
      });
    }
    
    return formData;
  }
}