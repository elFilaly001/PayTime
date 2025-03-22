import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Register from '../pages/Register'
import OTP from '../pages/OTP'
import HomePage from '../pages/Home'
import Settings from '../pages/Settings'
import Friends from '../pages/Friends'
import ProtectedRoute from './ProtectedRoute'
import History from '../pages/History'

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
        <Route 
          path='/history' 
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />

        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
              <Login />
          } 
        />
        <Route 
          path="/register" 
          element={
              <Register />
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
