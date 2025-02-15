import { createContext, useContext, useState } from 'react'

const StudentsContext = createContext()

export const StudentsProvider = ({ children }) => {
  const [students, setStudents] = useState([])

  const addStudent = (newStudent) => {
    setStudents(prev => [...prev, newStudent])
  }

  return (
    <StudentsContext.Provider value={{ students, setStudents, addStudent }}>
      {children}
    </StudentsContext.Provider>
  )
}

export const useStudents = () => useContext(StudentsContext)