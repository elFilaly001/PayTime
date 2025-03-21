// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem('accessToken');

  if (!isAuthenticated) {
    // Redirect to login page, but save the attempted URL
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
};

export default ProtectedRoute;