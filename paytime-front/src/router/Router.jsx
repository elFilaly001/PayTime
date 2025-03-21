import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Register from '../pages/Register'
import OTP from '../pages/OTP'
import HomePage from '../pages/Home'
import Settings from '../pages/Settings'
import Friends from '../pages/Friends'
import ProtectedRoute from './ProtectedRoute'

// Public route that redirects authenticated users
const PublicRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('accessToken');
  
  // If user is already logged in, redirect to home page
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Protected Routes */}
        <Route 
          path='/' 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route 
          path='/settings' 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route 
          path='/friend-list' 
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />

        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
        <Route path="/otp" element={<OTP />} />
        
        {/* Catch all - redirect to home or login */}
        <Route 
          path="*" 
          element={
            localStorage.getItem('accessToken') 
              ? <Navigate to="/" replace /> 
              : <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}
