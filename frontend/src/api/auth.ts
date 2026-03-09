import apiClient from './client'

export async function login(email: string, password: string) {
  const response = await apiClient.post('/api/auth/login', { email, password })
  return response.data
}

export async function getMe() {
  const response = await apiClient.get('/api/auth/me')
  return response.data
}