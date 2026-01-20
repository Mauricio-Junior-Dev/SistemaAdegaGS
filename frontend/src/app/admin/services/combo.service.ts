import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  ProductBundle, 
  ProductBundleFormData, 
  BundleGroupFormData,
  BundleOptionFormData,
  Combo, // Compatibilidade
  ComboFormData, // Compatibilidade
  ComboFormDataForBackend, // Compatibilidade
  ComboPriceCalculation, // Compatibilidade
  Product 
} from '../../core/models/product-bundle.model';
import { PaginatedResponse } from '../../core/models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class ComboService {
  // TODO: Quando o backend tiver ProductBundleController, mudar para /admin/bundles
  private apiUrl = `${environment.apiUrl}/admin/combos`;

  constructor(private http: HttpClient) {}

  // Listar bundles (combos) com filtros e paginação
  getCombos(params?: {
    search?: string;
    is_active?: boolean;
    featured?: boolean;
    offers?: boolean;
    sort_by?: string;
    sort_order?: string;
    per_page?: number;
    page?: number;
  }): Observable<PaginatedResponse<ProductBundle>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] !== undefined && params[key as keyof typeof params] !== null) {
          httpParams = httpParams.set(key, params[key as keyof typeof params]!.toString());
        }
      });
    }

    return this.http.get<PaginatedResponse<ProductBundle>>(this.apiUrl, { params: httpParams });
  }

  // Obter bundle por ID
  getCombo(id: number): Observable<ProductBundle> {
    return this.http.get<ProductBundle>(`${this.apiUrl}/${id}`);
  }

  // Criar bundle
  createCombo(comboData: ProductBundleFormData | ComboFormData): Observable<ProductBundle> {
    // Se houver imagens, usar FormData
    if (comboData.images && comboData.images.length > 0) {
      const formData = this.createFormData(comboData);
      console.log('Enviando FormData com imagens');
      return this.http.post<ProductBundle>(this.apiUrl, formData);
    }
    
    // Processar dados para o formato correto
    const processedData = this.processBundleData(comboData);
    
    // Remover imagens do objeto JSON (não são enviadas como JSON)
    delete (processedData as any).images;
    
    console.log('Dados que serão enviados (JSON):', processedData);
    return this.http.post<ProductBundle>(this.apiUrl, processedData);
  }

  // Atualizar bundle
  updateCombo(id: number, comboData: ProductBundleFormData | ComboFormData | ComboFormDataForBackend): Observable<ProductBundle> {
    // Se houver imagens, usar FormData com method spoofing (POST com _method=PUT)
    // O Laravel não processa corretamente multipart/form-data em requisições PUT
    if ((comboData as ProductBundleFormData | ComboFormData).images && (comboData as ProductBundleFormData | ComboFormData).images!.length > 0) {
      const formData = this.createFormData(comboData as ProductBundleFormData | ComboFormData);
      // Adicionar method spoofing para o Laravel reconhecer como PUT
      formData.append('_method', 'PUT');
      console.log('Enviando FormData com imagens para atualização (method spoofing)');
      return this.http.post<ProductBundle>(`${this.apiUrl}/${id}`, formData);
    }
    
    // Processar dados para o formato correto
    const processedData = this.processBundleData(comboData);
    
    // Remover imagens do objeto JSON
    delete (processedData as any).images;
    
    console.log('Dados que serão enviados para atualização (JSON):', processedData);
    return this.http.put<ProductBundle>(`${this.apiUrl}/${id}`, processedData);
  }

  // Excluir bundle
  deleteCombo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Alternar status do bundle
  toggleStatus(id: number): Observable<ProductBundle> {
    return this.http.patch<ProductBundle>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  // Upload de imagem
  uploadImage(id: number, image: File): Observable<ProductBundle> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<ProductBundle>(`${this.apiUrl}/${id}/image`, formData);
  }

  // Deletar imagem
  deleteImage(id: number, imageUrl: string): Observable<ProductBundle> {
    return this.http.delete<ProductBundle>(`${this.apiUrl}/${id}/image`, {
      body: { image_url: imageUrl }
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

  /**
   * Processa dados do bundle para o formato esperado pelo backend
   */
  private processBundleData(comboData: ProductBundleFormData | ComboFormData | ComboFormDataForBackend): any {
    // Se for ProductBundleFormData (nova estrutura)
    if ('groups' in comboData && Array.isArray(comboData.groups)) {
      return {
        name: comboData.name,
        description: comboData.description,
        bundle_type: comboData.bundle_type || 'combo',
        pricing_type: comboData.pricing_type || 'fixed',
        base_price: comboData.base_price !== undefined ? Number(comboData.base_price) : (comboData as any).price ? Number((comboData as any).price) : undefined,
        original_price: comboData.original_price ? Number(comboData.original_price) : undefined,
        discount_percentage: comboData.discount_percentage ? Number(comboData.discount_percentage) : undefined,
        barcode: comboData.barcode,
        is_active: comboData.is_active,
        featured: comboData.featured,
        offers: comboData.offers,
        popular: comboData.popular,
        groups: comboData.groups.map((group, groupIndex) => ({
          name: group.name,
          description: group.description,
          order: group.order !== undefined ? group.order : groupIndex,
          is_required: group.is_required,
          min_selections: group.min_selections,
          max_selections: group.max_selections,
          selection_type: group.selection_type,
          options: group.options.map((option, optionIndex) => ({
            product_id: Number(option.product_id),
            quantity: Number(option.quantity),
            sale_type: option.sale_type,
            price_adjustment: option.price_adjustment !== undefined ? Number(option.price_adjustment) : 0,
            order: option.order !== undefined ? option.order : optionIndex
          }))
        }))
      };
    }
    
    // Se for ComboFormData (estrutura antiga - compatibilidade)
    return {
      name: comboData.name,
      description: comboData.description,
      price: Number((comboData as any).price || 0),
      original_price: comboData.original_price ? Number(comboData.original_price) : undefined,
      discount_percentage: comboData.discount_percentage ? Number(comboData.discount_percentage) : undefined,
      barcode: comboData.barcode,
      is_active: comboData.is_active,
      featured: comboData.featured,
      offers: comboData.offers,
      popular: comboData.popular,
      products: (comboData as ComboFormData).products ? (comboData as ComboFormData).products.map(product => ({
        product_id: Number(product.product_id),
        quantity: Number(product.quantity),
        sale_type: product.sale_type
      })) : undefined
    };
  }

  // Método privado para criar FormData
  private createFormData(comboData: ProductBundleFormData | ComboFormData): FormData {
    const formData = new FormData();
    
    formData.append('name', comboData.name);
    if (comboData.description) {
      formData.append('description', comboData.description);
    }
    
    // Se for ProductBundleFormData (nova estrutura)
    if ('groups' in comboData && Array.isArray(comboData.groups)) {
      formData.append('bundle_type', comboData.bundle_type || 'combo');
      formData.append('pricing_type', comboData.pricing_type || 'fixed');
      if (comboData.base_price !== undefined) {
        formData.append('base_price', comboData.base_price.toString());
      }
      
      // Adicionar grupos
      comboData.groups.forEach((group, groupIndex) => {
        formData.append(`groups[${groupIndex}][name]`, group.name);
        if (group.description) {
          formData.append(`groups[${groupIndex}][description]`, group.description);
        }
        formData.append(`groups[${groupIndex}][order]`, (group.order !== undefined ? group.order : groupIndex).toString());
        formData.append(`groups[${groupIndex}][is_required]`, group.is_required ? '1' : '0');
        formData.append(`groups[${groupIndex}][min_selections]`, group.min_selections.toString());
        formData.append(`groups[${groupIndex}][max_selections]`, group.max_selections.toString());
        formData.append(`groups[${groupIndex}][selection_type]`, group.selection_type);
        
        // Adicionar opções do grupo
        group.options.forEach((option, optionIndex) => {
          formData.append(`groups[${groupIndex}][options][${optionIndex}][product_id]`, option.product_id.toString());
          formData.append(`groups[${groupIndex}][options][${optionIndex}][quantity]`, option.quantity.toString());
          formData.append(`groups[${groupIndex}][options][${optionIndex}][sale_type]`, option.sale_type);
          formData.append(`groups[${groupIndex}][options][${optionIndex}][price_adjustment]`, (option.price_adjustment || 0).toString());
          formData.append(`groups[${groupIndex}][options][${optionIndex}][order]`, (option.order !== undefined ? option.order : optionIndex).toString());
        });
      });
    } else {
      // Se for ComboFormData (estrutura antiga)
      formData.append('price', ((comboData as ComboFormData).price || 0).toString());
      
      // Adicionar produtos (estrutura antiga)
      if ((comboData as ComboFormData).products && (comboData as ComboFormData).products.length > 0) {
        (comboData as ComboFormData).products.forEach((item, index) => {
          formData.append(`products[${index}][product_id]`, item.product_id.toString());
          formData.append(`products[${index}][quantity]`, item.quantity.toString());
          formData.append(`products[${index}][sale_type]`, item.sale_type);
        });
      }
    }
    
    if (comboData.original_price) {
      formData.append('original_price', comboData.original_price.toString());
    }
    if (comboData.discount_percentage) {
      formData.append('discount_percentage', comboData.discount_percentage.toString());
    }
    if (comboData.barcode) {
      formData.append('barcode', comboData.barcode);
    }
    // Converter booleanos para '1' ou '0' para o Laravel aceitar via FormData
    formData.append('is_active', comboData.is_active ? '1' : '0');
    formData.append('featured', comboData.featured ? '1' : '0');
    formData.append('offers', comboData.offers ? '1' : '0');
    formData.append('popular', comboData.popular ? '1' : '0');
    
    // Adicionar imagens
    if (comboData.images) {
      comboData.images.forEach((image: File, index: number) => {
        formData.append(`images[${index}]`, image);
      });
    }
    
    return formData;
  }
}