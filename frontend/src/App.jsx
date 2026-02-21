import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import * as Sentry from '@sentry/react'
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
// ProtectedRoute available for future use if needed
// import ProtectedRoute from './components/auth/ProtectedRoute'
import SplashScreen from './components/common/SplashScreen'
import StudentEditPage from './pages/students/StudentEditPage'
import AIChatPage from './pages/ai/AIChatPage'
import SubscriptionPage from './pages/subscription/SubscriptionPage'
import ErrorBoundary from './components/reports/ErrorBoundary'
import { logger } from './utils/logger'

function App() {
  // Check for Supabase session on initial load
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and set up Supabase auth state listener
  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const session = await getSession();
        setIsAuthenticated(!!session);
        
        // Set user context for Sentry
        if (session?.user) {
          logger.setUser({ id: session.user.id, email: session.user.email });
        }
      } catch (error) {
        logger.error('Error checking session', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.debug('Auth state changed', { event });
        setIsAuthenticated(!!session);
        
        // Update Sentry user context
        if (session?.user) {
          logger.setUser({ id: session.user.id, email: session.user.email });
        } else {
          logger.setUser(null);
        }
      }
    );
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Show loading state
  if (isLoading) {
    return <SplashScreen />;
  }


  return (
    <Sentry.ErrorBoundary fallback={<ErrorBoundary />}>
      <ChakraProvider>
        <UserProvider>
          <StudentsProvider>
            <BrowserRouter>
              <FileUploadModalProvider>
              <Routes>
                <Route path="/" element={
                  isAuthenticated ? 
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
                    isAuthenticated ? 
                      <StudentSelection /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/students/new" 
                  element={
                    isAuthenticated ? 
                      <AddStudent /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                {/* Student detail page - redirects to progress */}
                <Route 
                  path="/students/:studentId" 
                  element={
                    isAuthenticated ? 
                      <Navigate to="progress" replace /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/students/:studentId/progress" 
                  element={
                    isAuthenticated ? 
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
                    isAuthenticated ? 
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
                    isAuthenticated ? 
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
                    isAuthenticated ? 
                      <ContentCreatePage /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/students/:studentId/ai-upload" 
                  element={
                    isAuthenticated ? 
                      <AIEvidenceUploadPage /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/students/:studentId/ai-chat" 
                  element={
                    isAuthenticated ? 
                      <>
                        <AIChatPage />
                        <BottomNav />
                      </> : 
                      <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/students/:studentId/reports" 
                  element={
                    isAuthenticated ? 
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
                    isAuthenticated ? 
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
                    isAuthenticated ?
                      <>
                        <AdminPage />
                        <BottomNav />
                      </> :
                      <Navigate to="/login" replace />
                  }
                />
                {/* Profile Page Route */}
                <Route
                  path="/profile"
                  element={
                    isAuthenticated ?
                      <>
                        <ProfilePage />
                        <BottomNav />
                      </> :
                      <Navigate to="/login" replace />
                  }
                />
                {/* Avatar Settings Page Route */}
                <Route 
                  path="/profile/avatar" 
                  element={
                    isAuthenticated ? 
                      <AvatarSettingsPage /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                {/* Student edit page */}
                <Route 
                  path="/students/:studentId/edit" 
                  element={
                    isAuthenticated ? 
                      <StudentEditPage /> : 
                      <Navigate to="/login" replace />
                  } 
                />
                {/* Subscription Page Route */}
                <Route
                  path="/subscription"
                  element={
                    isAuthenticated ?
                      <>
                        <SubscriptionPage />
                        <BottomNav />
                      </> :
                      <Navigate to="/login" replace />
                  }
                />
              </Routes>
              </FileUploadModalProvider>
            </BrowserRouter>
          </StudentsProvider>
        </UserProvider>
      </ChakraProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
