import { createContext, useContext, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStudents } from './StudentsContext'
import FileUploadModal from '../components/common/FileUploadModal'

// Create context
const FileUploadModalContext = createContext(null)

// Provider component
export const FileUploadModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [modalProps, setModalProps] = useState({
    studentId: null,
    studentGrade: null,
    learningOutcomeId: null,
    learningOutcomeDescription: null,
    initialLearningAreaCode: null,
    initialLearningOutcomeCode: null
  })
  
  // Get current student from context
  const { students } = useStudents()
  
  // Get current route params
  const params = useParams()
  
  // Open modal with context
  const openModal = (props = {}) => {
    // Try to get studentId from props or route params
    const studentId = props.studentId || params.studentId
    
    // If we have a studentId, try to get the student's grade
    let studentGrade = props.studentGrade
    if (studentId && !studentGrade && students) {
      const student = students.find(s => s._id === studentId)
      if (student) {
        studentGrade = student.grade_level
      }
    }
    
    setModalProps({
      studentId,
      studentGrade,
      learningOutcomeId: props.learningOutcomeId || null,
      learningOutcomeDescription: props.learningOutcomeDescription || null,
      initialLearningAreaCode: props.initialLearningAreaCode || null,
      initialLearningOutcomeCode: props.initialLearningOutcomeCode || null
    })
    
    setIsOpen(true)
  }
  
  // Close modal
  const closeModal = () => {
    setIsOpen(false)
  }
  
  // Handle submission
  const handleSubmit = (result) => {
    // If there's a custom onSubmit handler in props, call it
    if (modalProps.onSubmit) {
      modalProps.onSubmit(result)
    }
    
    // Close the modal
    closeModal()
    
    // Optionally, we could trigger a refresh of data here
  }
  
  return (
    <FileUploadModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      
      {/* Render the modal once */}
      <FileUploadModal
        isOpen={isOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        {...modalProps}
      />
    </FileUploadModalContext.Provider>
  )
}

// Custom hook to use the context
export const useFileUploadModal = () => {
  const context = useContext(FileUploadModalContext)
  if (!context) {
    throw new Error('useFileUploadModal must be used within a FileUploadModalProvider')
  }
  return context
}

export default FileUploadModalContext
