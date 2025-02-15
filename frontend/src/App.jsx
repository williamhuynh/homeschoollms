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



function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  return (
    <ChakraProvider>
      <StudentsProvider>
        <BrowserRouter>
          <Routes>
            <Route 
              path="/" 
              element={
                isAuthenticated ? 
                  <Navigate to="/students" replace /> : 
                  <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="/login" 
              element={<LoginPage setIsAuthenticated={setIsAuthenticated} />}
            />
            <Route 
              path="/students" 
              element={
                isAuthenticated ? 
                  <StudentSelection /> : 
                  <Navigate to="/login" replace />
              } 
            />
            <Route path="/students/new" element={<AddStudent />} />
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
              path="/students/:studentId/content/create" 
              element={
                isAuthenticated ? 
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