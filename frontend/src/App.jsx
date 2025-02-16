import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LoginPage from './pages/auth/LoginPage'
import StudentSelection from './pages/students/StudentSelection'
import StudentProgressPage from './pages/progress/StudentProgressPage'
import SubjectContentPage from './pages/progress/SubjectContentPage'
import ContentCreatePage from './pages/content/ContentCreatePage'
import BottomNav from './components/navigation/BottomNav'
import AddStudent from './pages/students/AddStudent'
import { StudentsProvider } from './contexts/StudentsContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  // Original authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Temporary override for testing
  // Comment this line to restore normal authentication behavior
  const isAuthenticatedOverride = true

  return (
    <ChakraProvider>
      <StudentsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              isAuthenticatedOverride || isAuthenticated ? 
                <Navigate to="/students" replace /> : 
                <Navigate to="/login" replace />
            } />
            <Route 
              path="/login" 
              element={<LoginPage setIsAuthenticated={setIsAuthenticated} />}
            />
            <Route 
              path="/students" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <StudentSelection /> : 
                  <Navigate to="/login" replace />
              } 
            />
            <Route path="/students/new" element={<AddStudent />} />
            <Route 
              path="/students/:studentId/progress" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <>
                    <StudentProgressPage />
                    <BottomNav />
                  </> : 
                  <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="/students/:studentId/subjects/:subject" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <>
                    <SubjectContentPage />
                    <BottomNav />
                  </> : 
                  <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="/students/:studentId/content/create" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <ContentCreatePage /> : 
                  <Navigate to="/login" replace />
              } 
            />
          </Routes>
        </BrowserRouter>
      </StudentsProvider>
    </ChakraProvider>
  )
}

export default App