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
  
  // Store callbacks separately
  const [onSuccessCallback, setOnSuccessCallback] = useState(null)
  const [onSubmitCallback, setOnSubmitCallback] = useState(null)
  
  // Get current student from context
  const { students } = useStudents()
  
  // Get current route params
  const params = useParams()
  
  // Open modal with context
  const openModal = (props = {}) => {
    // Try to get studentId from props or route params (at Provider level)
    const receivedStudentIdProp = props.studentId;
    const paramsStudentId = params.studentId; // Params at Provider level
    const studentId = receivedStudentIdProp || paramsStudentId // Determine the ID to use
    console.log(`FileUploadModalProvider: openModal called. Received prop studentId: ${receivedStudentIdProp}, Params studentId: ${paramsStudentId}, Determined studentId: ${studentId}`); // Log details

    let studentGrade = props.studentGrade
    // Log before attempting to find grade
    console.log(`FileUploadModalProvider: Checking conditions to find grade. Has studentId: ${!!studentId}, Has studentGrade prop: ${!!props.studentGrade}, Has students context: ${!!students}`);
    if (studentId && !studentGrade && students) { // <-- Needs a valid studentId AND no explicit grade prop AND students context
      // Find student by SLUG now, as studentId from URL is the slug
      const student = students.find(s => s.slug === studentId)
      if (student) {
        studentGrade = student.grade_level // <-- Derives grade if student found
        console.log(`FileUploadModalProvider: Found student by slug ${studentId}, setting grade: ${studentGrade}`); // Modify Log
      } else {
        console.warn(`FileUploadModalProvider: Student not found in context for ID: ${studentId}`); // Add Log
      }
    } else if (studentGrade) {
      console.log(`FileUploadModalProvider: Using provided studentGrade prop: ${studentGrade}`);
    } else {
      console.log(`FileUploadModalProvider: Did not derive grade (conditions not met or studentGrade prop already present).`);
    }
    
    // Store modal props without callbacks
    setModalProps({
      studentId,
      studentGrade,
      learningOutcomeId: props.learningOutcomeId || null,
      learningOutcomeDescription: props.learningOutcomeDescription || null,
      initialLearningAreaCode: props.initialLearningAreaCode || null,
      initialLearningOutcomeCode: props.initialLearningOutcomeCode || null
    })
    
    // Store callbacks separately
    if (props.onSuccess && typeof props.onSuccess === 'function') {
      console.log('Setting onSuccess callback:', typeof props.onSuccess);
      setOnSuccessCallback(() => props.onSuccess);
    } else {
      setOnSuccessCallback(null);
    }
    
    if (props.onSubmit && typeof props.onSubmit === 'function') {
      setOnSubmitCallback(() => props.onSubmit);
    } else {
      setOnSubmitCallback(null);
    }
    
    setIsOpen(true)
  }
  
  // Close modal
  const closeModal = () => {
    setIsOpen(false)
    // Reset the learning area and outcome codes to ensure fresh values on next open
    setModalProps(prev => ({
      ...prev,
      initialLearningAreaCode: null,
      initialLearningOutcomeCode: null
    }))
  }
  
  // Handle submission
  const handleSubmit = (result) => {
    console.log('handleSubmit called with result:', result);
    console.log('onSubmitCallback type:', typeof onSubmitCallback);
    console.log('onSuccessCallback type:', typeof onSuccessCallback);
    
    // If there's a custom onSubmit handler, call it
    if (onSubmitCallback && typeof onSubmitCallback === 'function') {
      onSubmitCallback(result)
    }
    
    // Close the modal first
    closeModal()
    
    // Call onSuccess callback after modal is closed if provided
    if (onSuccessCallback && typeof onSuccessCallback === 'function') {
      // Store the callback in a local variable to ensure we're not accessing stale state
      const successCallback = onSuccessCallback;
      
      // Use a small timeout to ensure the modal is closed first
      setTimeout(() => {
        console.log('Calling onSuccess callback...');
        try {
          successCallback();  // Don't pass result, as handleEvidenceUploaded doesn't expect args
        } catch (err) {
          console.error('Error calling onSuccess callback:', err);
        }
      }, 100)
    }
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
