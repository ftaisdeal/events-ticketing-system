import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import { vi } from 'vitest';

import App from './App';

vi.mock('./components/Auth/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe('App', () => {
  const renderAtRoute = (route: string): void => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    );
  };

  it('renders the login page on /login', () => {
    renderAtRoute('/login');

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-route')).not.toBeInTheDocument();
  });

  it('renders the events page on /events', () => {
    renderAtRoute('/events');

    expect(screen.getByText('Events Page')).toBeInTheDocument();
  });

  it('renders the home page on /', () => {
    renderAtRoute('/');

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('wraps /checkout with ProtectedRoute guard', () => {
    renderAtRoute('/checkout');

    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByText('Checkout Page')).toBeInTheDocument();
  });
});
