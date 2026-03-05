import apiClient from './client';
import type { BD } from '../types';

export interface LoginPayload { email: string; password: string; }
export interface AuthResponse { user: BD; token: string; }

export const authApi = {
  login:  (data: LoginPayload)    => apiClient.post<AuthResponse>('/auth/login', data),
  logout: ()                      => apiClient.post('/auth/logout'),
  me:     ()                      => apiClient.get<BD>('/auth/me'),
};
