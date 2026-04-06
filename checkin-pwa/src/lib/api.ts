import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${apiBaseUrl}/api`
});

export const getAuthHeader = (token: string | null) => (
  token
    ? { Authorization: `Bearer ${token}` }
    : {}
);