import { createContext, useContext, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setStudents as setStudentsAction, addStudent as addStudentAction, updateStudent as updateStudentAction } from '../state/studentsSlice'

const StudentsContext = createContext()

export const StudentsProvider = ({ children }) => {
  const dispatch = useDispatch()
  const students = useSelector(state => state.students.items)

  const setStudents = useCallback((list) => {
    dispatch(setStudentsAction(list))
  }, [dispatch])

  const addStudent = useCallback((newStudent) => {
    dispatch(addStudentAction(newStudent))
  }, [dispatch])

  const updateStudent = useCallback((updated) => {
    dispatch(updateStudentAction(updated))
  }, [dispatch])

  return (
    <StudentsContext.Provider value={{ students, setStudents, addStudent, updateStudent }}>
      {children}
    </StudentsContext.Provider>
  )
}

export const useStudents = () => useContext(StudentsContext)