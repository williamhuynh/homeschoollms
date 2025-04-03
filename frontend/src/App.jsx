import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/auth/LoginPage'
import StudentSelection from './pages/students/StudentSelection'
import StudentProgressPage from './pages/progress/StudentProgressPage'
import SubjectContentPage from './pages/progress/SubjectContentPage'
import LearningOutcomePage from './pages/progress/LearningOutcomePage'
import ContentCreatePage from './pages/content/ContentCreatePage'
import AdminPage from './pages/admin/AdminPage'
import BottomNav from './components/navigation/BottomNav'
import AddStudent from './pages/students/AddStudent'
import { StudentsProvider } from './contexts/StudentsContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  // Check for token on initial load
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('token') !== null;
  });

  // For development purposes only - remove in production
  const isAuthenticatedOverride = true;

  // Update authentication state when token changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(localStorage.getItem('token') !== null);
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


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
            <Route 
              path="/students/new" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <AddStudent /> : 
                  <Navigate to="/login" replace />
              } 
            />
            {/* Student detail page - redirects to progress */}
            <Route 
              path="/students/:studentId" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <Navigate to="progress" replace /> : 
                  <Navigate to="/login" replace />
              } 
            />
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
              path="/students/:studentId/learning-outcomes/:learningOutcomeId" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <>
                    <LearningOutcomePage />
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
            <Route 
              path="/admin" 
              element={
                isAuthenticatedOverride || isAuthenticated ? 
                  <AdminPage /> : 
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
