export interface Service {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface Bundle {
  id: string;
  name: string;
  services?: BundleService[];
}

export interface BundleService {
  service_id: string;
  bundle_id: string;
  name?: string;
  service_value: number;
  revenue_share_pct: number;
}
