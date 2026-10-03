import { request } from './apiClient';
import type { AdminUser } from '../types';

export interface AuthResponse {
  success: true;
  message: string;
  admin: AdminUser;
}

export const authService = {
  login: (email: string, password: string) =>
    request<AuthResponse>({ url: '/auth/login', method: 'POST', data: { email, password } }),

  logout: () => request<{ success: true; message: string }>({ url: '/auth/logout', method: 'POST' }),

  me: () => request<{ success: true; admin: AdminUser }>({ url: '/auth/me', method: 'GET' }),
};