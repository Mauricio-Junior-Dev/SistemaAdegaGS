export interface BlockedZipCode {
  id: number;
  zip_code: string;
  reason?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

