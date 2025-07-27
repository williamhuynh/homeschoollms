import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import { supabase, getSession } from './services/supabase'
import StudentSelection from './pages/students/StudentSelection'
import StudentProgressPage from './pages/progress/StudentProgressPage'
import SubjectContentPage from './pages/progress/SubjectContentPage'
import LearningOutcomePage from './pages/progress/LearningOutcomePage'
import ContentCreatePage from './pages/content/ContentCreatePage_LEGACY'
import AIEvidenceUploadPage from './pages/evidence/AIEvidenceUploadPage'
import AdminPage from './pages/admin/AdminPage'
import ProfilePage from './pages/profile/ProfilePage'
import AvatarSettingsPage from './pages/profile/AvatarSettingsPage'
import ReportsPage from './pages/reports/ReportsPage'
import ReportViewPage from './pages/reports/ReportViewPage'
import BottomNav from './components/navigation/BottomNav'
import AddStudent from './pages/students/AddStudent'
import { StudentsProvider } from './contexts/StudentsContext'
import { FileUploadModalProvider } from './contexts/FileUploadModalContext'
import { UserProvider } from './contexts/UserContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  // Check for Supabase session on initial load
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // For development purposes only - remove in production
  const isAuthenticatedOverride = false;

  // Initialize and set up Supabase auth state listener
  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const session = await getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Supabase auth event:', event);
        setIsAuthenticated(!!session);
      }
    );
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Show loading state
  if (isLoading && !isAuthenticatedOverride) {
    return <div>Loading...</div>;
  }


  return (
    <ChakraProvider>
      <UserProvider>
        <StudentsProvider>
          <BrowserRouter>
            <FileUploadModalProvider>
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
                path="/register" 
                element={<RegisterPage />}
              />
              <Route 
                path="/reset-password" 
                element={<ResetPasswordPage />}
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
                path="/students/:studentId/ai-upload" 
                element={
                  isAuthenticatedOverride || isAuthenticated ? 
                    <AIEvidenceUploadPage /> : 
                    <Navigate to="/login" replace />
                } 
              />
              <Route 
                path="/students/:studentId/reports" 
                element={
                  isAuthenticatedOverride || isAuthenticated ? 
                    <>
                      <ReportsPage />
                      <BottomNav />
                    </> : 
                    <Navigate to="/login" replace />
                } 
              />
              <Route 
                path="/students/:studentId/reports/:reportId" 
                element={
                  isAuthenticatedOverride || isAuthenticated ? 
                    <>
                      <ReportViewPage />
                      <BottomNav />
                    </> : 
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
              {/* Profile Page Route */}
              <Route 
                path="/profile" 
                element={
                  isAuthenticatedOverride || isAuthenticated ? 
                    <ProfilePage /> : 
                    <Navigate to="/login" replace />
                } 
              />
              {/* Avatar Settings Page Route */}
              <Route 
                path="/profile/avatar" 
                element={
                  isAuthenticatedOverride || isAuthenticated ? 
                    <AvatarSettingsPage /> : 
                    <Navigate to="/login" replace />
                } 
              />
            </Routes>
            </FileUploadModalProvider>
          </BrowserRouter>
        </StudentsProvider>
      </UserProvider>
    </ChakraProvider>
  )
}

export default App
