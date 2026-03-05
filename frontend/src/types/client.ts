export type AccountType = 'Enterprise' | 'Corporate' | 'SMB' | 'Government';
export type ClientStatus = 'Active' | 'Inactive' | 'Prospect';

export interface Industry {
  id: string;
  name: string;
  parent_industry?: string;
}

export interface Client {
  id: string;
  name: string;
  brand?: string;
  account_type: AccountType;
  type?: string;
  status: ClientStatus;
  industry_id?: string;
  industry?: Industry;
  contact_id?: string;
  referral_id?: string;
  deals?: import('./deal').Deal[];
  contacts?: import('./contact').Contact[];
}
