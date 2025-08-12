import { createContext, useContext } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setStudents as setStudentsAction, addStudent as addStudentAction, updateStudent as updateStudentAction } from '../state/studentsSlice'

const StudentsContext = createContext()

export const StudentsProvider = ({ children }) => {
  const dispatch = useDispatch()
  const students = useSelector(state => state.students.items)

  const setStudents = (list) => {
    dispatch(setStudentsAction(list))
  }

  const addStudent = (newStudent) => {
    dispatch(addStudentAction(newStudent))
  }

  const updateStudent = (updated) => {
    dispatch(updateStudentAction(updated))
  }

  return (
    <StudentsContext.Provider value={{ students, setStudents, addStudent, updateStudent }}>
      {children}
    </StudentsContext.Provider>
  )
}

export const useStudents = () => useContext(StudentsContext)