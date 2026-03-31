import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import { vi } from 'vitest';

import App from './App';
import { AuthProvider } from './contexts/AuthContext';

vi.mock('./components/Auth/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe('App', () => {
  const renderAtRoute = (route: string): void => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('renders the login page on /login', () => {
    renderAtRoute('/login');

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByTestId('protected-route')).not.toBeInTheDocument();
  });

  it('renders the events page on /events', () => {
    renderAtRoute('/events');

    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
  });

  it('renders the home page on /', () => {
    renderAtRoute('/');

    expect(screen.getByRole('heading', { name: 'Live Loud. Book Fast.' })).toBeInTheDocument();
  });

  it('wraps /checkout with ProtectedRoute guard', () => {
    renderAtRoute('/checkout');

    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
  });
});
