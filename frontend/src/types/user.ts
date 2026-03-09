export type UserRole = 'BD_REP' | 'SALES_MANAGER';

export interface BD {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
