import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import CheckInPage from './pages/CheckInPage';
import EventsPage from './pages/EventsPage';
import LoginPage from './pages/LoginPage';

const App = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId/check-in"
        element={
          <ProtectedRoute>
            <CheckInPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
};

export default App;