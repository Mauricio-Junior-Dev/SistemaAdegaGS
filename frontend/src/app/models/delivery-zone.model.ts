export interface DeliveryZone {
  id: number;
  nome_bairro: string;
  cep_inicio?: string;
  cep_fim?: string;
  valor_frete: number;
  tempo_estimado?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryZoneResponse {
  valor_frete: number;
  tempo_estimado?: string;
  nome_bairro: string;
}

export interface DeliveryZoneError {
  error: string;
  message: string;
  valor_frete: null;
  tempo_estimado: null;
}
