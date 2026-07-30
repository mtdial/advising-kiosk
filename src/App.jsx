import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import KioskPage from './pages/KioskPage'
import LoginPage from './pages/LoginPage'
import AdvisorPage from './pages/AdvisorPage'
import AdminPage from './pages/AdminPage'
import CollegeAdminPage from './pages/CollegeAdminPage'
import SuiteAdminPage from './pages/SuiteAdminPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/advisor"
            element={
              <ProtectedRoute>
                <AdvisorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/college-admin"
            element={
              <ProtectedRoute requireFlag="isCollegeAdmin">
                <CollegeAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suite-admin"
            element={
              <ProtectedRoute requireFlag="isSuiteAdmin">
                <SuiteAdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
