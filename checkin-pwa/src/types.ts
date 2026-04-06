export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'customer' | 'organizer' | 'admin';
};

export type CheckInEvent = {
  id: number;
  title: string;
  slug: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  venue: {
    id: number;
    name: string;
    city: string;
    country: string;
  } | null;
  stats: {
    totalIssued: number;
    checkedInCount: number;
    remainingCount: number;
  };
};

export type CheckInResult = {
  result: string;
  ticket?: {
    id: number;
    ticketNumber: string;
    qrCode: string;
    status: string;
    attendeeName?: string | null;
    attendeeEmail?: string | null;
    price: number;
  };
  order?: {
    id: number;
    orderNumber: string;
    status: string;
    customer: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  } | null;
  event?: {
    id: number;
    title: string;
    slug: string;
    startDateTime: string;
    venue: {
      id: number;
      name: string;
      city: string;
      country: string;
    } | null;
  } | null;
  ticketType?: {
    id: number;
    name: string;
  } | null;
  checkIn?: {
    id: number;
    scannedAt: string;
    source: string;
    deviceId?: string | null;
    scannedBy: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  } | null;
};