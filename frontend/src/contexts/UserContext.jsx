import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser } from '../services/api'

const UserContext = createContext()

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Function to fetch current user data
  const fetchUserData = async () => {
    setLoading(true)
    setError(null)
    try {
      const userData = await getCurrentUser()
      setUser(userData)
    } catch (err) {
      console.error("Failed to fetch user data:", err)
      setError("Failed to load user information.")
    } finally {
      setLoading(false)
    }
  }

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData()
  }, [])

  // Helper function to check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'developer'
  }

  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      loading, 
      error, 
      fetchUserData, 
      isAdmin 
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext) 