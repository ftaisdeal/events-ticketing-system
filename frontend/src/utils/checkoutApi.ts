import axios from 'axios';

export type CartItem = {
  ticketTypeId: number;
  quantity: number;
};

type ReserveOrderPayload = {
  eventId: number;
  items: CartItem[];
};

type CreateIntentPayload = {
  orderId: number;
};

type ExpireOrderPayload = {
  orderId: number;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${apiBaseUrl}/api`
});

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`
});

export const reserveOrder = async (token: string, payload: ReserveOrderPayload) => {
  const { data } = await api.post('/orders/reserve', payload, {
    headers: authHeaders(token)
  });
  return data as {
    order: { id: number; totalAmount: number; status: string };
    payment: { id: number; status: string };
    reservationExpiresAt: string;
  };
};

export const createPaymentIntent = async (token: string, payload: CreateIntentPayload) => {
  const { data } = await api.post('/payments/create-intent', payload, {
    headers: authHeaders(token)
  });

  return data as {
    clientSecret: string | null;
    paymentIntentId: string;
    orderId: number;
  };
};

export const expireOrderReservation = async (token: string, payload: ExpireOrderPayload) => {
  const { data } = await api.post(`/orders/${payload.orderId}/expire`, undefined, {
    headers: authHeaders(token)
  });
  return data as { message: string; status?: string };
};
