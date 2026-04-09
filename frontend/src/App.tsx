import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';

import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import Home from './pages/Home';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import RefundPolicy from './pages/RefundPolicy';
import CustomerSupport from './pages/CustomerSupport';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Profile from './pages/Profile';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderDetail from './pages/OrderDetail';
import Orders from './pages/Orders';
import Dashboard from './pages/Dashboard/Dashboard';
import AdminOrders from './pages/Admin/Orders';
import AdminFinances from './pages/Admin/Finances';
import AdminVenues from './pages/Admin/Venues';
import AdminAddVenue from './pages/Admin/AddVenue';
import ProtectedRoute from './components/Auth/ProtectedRoute';

const primaryOrganizerEmail = import.meta.env.VITE_PRIMARY_ORGANIZER_EMAIL as string | undefined;

function App(): JSX.Element {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Container maxWidth="lg">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:slug" element={<EventDetail />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/support" element={<CustomerSupport />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected Routes */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route path="/cart" element={<Cart />} />
            <Route 
              path="/checkout" 
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders/:orderId" 
              element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard Routes */}
            <Route 
              path="/dashboard/*" 
              element={
                <ProtectedRoute
                  requiredRole="organizer"
                  requiredEmail={primaryOrganizerEmail}
                >
                  <Dashboard />
                </ProtectedRoute>
              } 
            />

            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finances"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminFinances />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/venues"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminVenues />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/venues/new"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAddVenue />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

export default App;
