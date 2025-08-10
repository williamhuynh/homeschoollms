import { createContext, useContext, useState } from 'react'

const StudentsContext = createContext()

export const StudentsProvider = ({ children }) => {
  const [students, setStudents] = useState([])

  const addStudent = (newStudent) => {
    setStudents(prev => [...prev, newStudent])
  }

  const updateStudent = (updated) => {
    setStudents(prev => prev.map(s => {
      const sid = s._id || s.id || s.slug
      const uid = updated._id || updated.id || updated.slug
      return sid === uid ? { ...s, ...updated } : s
    }))
  }

  return (
    <StudentsContext.Provider value={{ students, setStudents, addStudent, updateStudent }}>
      {children}
    </StudentsContext.Provider>
  )
}

export const useStudents = () => useContext(StudentsContext)