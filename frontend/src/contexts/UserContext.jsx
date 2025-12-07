import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCurrentUser, getSubscriptionStatus, getSubscriptionUsage } from '../services/api'
import { logger } from '../utils/logger'

const UserContext = createContext()

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Subscription state
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)

  // Function to fetch current user data
  const fetchUserData = async () => {
    setLoading(true)
    setError(null)
    try {
      const userData = await getCurrentUser()
      setUser(userData)
    } catch (err) {
      logger.error("Failed to fetch user data", err)
      setError("Failed to load user information.")
    } finally {
      setLoading(false)
    }
  }

  // Function to fetch subscription data
  const fetchSubscriptionData = useCallback(async () => {
    if (!user) return
    
    setSubscriptionLoading(true)
    try {
      const [statusData, usageData] = await Promise.all([
        getSubscriptionStatus(),
        getSubscriptionUsage()
      ])
      setSubscription(statusData)
      setUsage(usageData)
    } catch (err) {
      logger.error("Failed to fetch subscription data", err)
      // Don't set error - subscription data is supplementary
    } finally {
      setSubscriptionLoading(false)
    }
  }, [user])

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData()
  }, [])

  // Fetch subscription data when user is available
  useEffect(() => {
    if (user) {
      fetchSubscriptionData()
    }
  }, [user, fetchSubscriptionData])

  // Helper function to check if user is admin (includes super_admin)
  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'super_admin'
  }

  // Helper function to check if user is super admin
  const isSuperAdmin = () => {
    return user?.role === 'super_admin'
  }

  // Helper function to get effective subscription tier
  const getEffectiveTier = () => {
    if (subscription?.is_grandfathered) return 'basic'
    return subscription?.tier || user?.subscription_tier || 'free'
  }

  // Helper function to check if user can add students
  const canAddStudent = () => {
    if (!usage) return true // Allow by default until we know usage
    return !usage.is_at_student_limit
  }

  // Helper function to check if user can add evidence
  const canAddEvidence = () => {
    if (!usage) return true // Allow by default until we know usage
    return !usage.is_at_evidence_limit
  }

  // Helper function to check if user can generate reports
  const canGenerateReports = () => {
    if (!usage) return false // Block by default for safety
    return usage.can_generate_reports
  }

  // Helper to check if user is on free tier
  const isFreeTier = () => {
    return getEffectiveTier() === 'free'
  }

  // Helper to check if user is grandfathered
  const isGrandfathered = () => {
    return subscription?.is_grandfathered || user?.is_grandfathered || false
  }

  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      loading, 
      error, 
      fetchUserData, 
      isAdmin,
      isSuperAdmin,
      // Subscription helpers
      subscription,
      usage,
      subscriptionLoading,
      fetchSubscriptionData,
      getEffectiveTier,
      canAddStudent,
      canAddEvidence,
      canGenerateReports,
      isFreeTier,
      isGrandfathered,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext) 