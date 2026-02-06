/**
 * Logger utility that integrates with Sentry in production
 * and provides console logging in development.
 * 
 * Usage:
 *   import { logger } from '../utils/logger'
 *   
 *   logger.debug('Detailed info', { data })  // Dev only
 *   logger.info('User action', { userId })   // Dev only
 *   logger.warn('Something unusual', { ctx }) // Dev + Sentry breadcrumb
 *   logger.error('Failed!', error)           // Dev + Sentry capture
 */

import * as Sentry from '@sentry/react'

const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD

/**
 * Debug level - only logs in development
 * Use for detailed debugging info that would clutter production
 */
function debug(...args) {
  if (isDev) {
    console.log('[DEBUG]', ...args)
  }
}

/**
 * Info level - only logs in development
 * Use for general information about app flow
 */
function info(...args) {
  if (isDev) {
    console.log('[INFO]', ...args)
  }
}

/**
 * Warn level - logs in dev, adds Sentry breadcrumb in prod
 * Use for unexpected but non-critical issues
 */
function warn(...args) {
  if (isDev) {
    console.warn('[WARN]', ...args)
  }
  
  if (isProd) {
    // Add as breadcrumb so it shows up in error context
    Sentry.addBreadcrumb({
      category: 'warning',
      message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
      level: 'warning',
    })
  }
}

/**
 * Extract structured debug info from an error (especially AxiosError).
 * Returns a plain object safe for Sentry extra context.
 */
function extractErrorDetails(err) {
  if (!err) return {}

  const details = {}

  // Axios-specific fields
  if (err.response) {
    details.httpStatus = err.response.status
    details.httpStatusText = err.response.statusText
    details.responseBody = err.response.data
    details.backendDetail = err.response.data?.detail
  }
  if (err.config) {
    details.requestUrl = err.config.url
    details.requestMethod = err.config.method?.toUpperCase()
  }
  if (err.code) {
    details.errorCode = err.code // e.g. "ERR_NETWORK", "ECONNABORTED"
  }

  return details
}

/**
 * Error level - always logs, captures to Sentry in prod
 * Use for actual errors that need attention
 *
 * @param {string} message - Human-readable description of what failed
 * @param {Error|Object} errorOrContext - The thrown error or a context object
 * @param {Object} [extra] - Additional structured context (e.g. { step, fileCount })
 */
function error(message, errorOrContext, extra = {}) {
  const axiosDetails = errorOrContext instanceof Error ? extractErrorDetails(errorOrContext) : {}
  const mergedExtra = { message, ...axiosDetails, ...extra }

  // Always log to console with full detail
  console.error('[ERROR]', message, errorOrContext, mergedExtra)

  if (isProd) {
    if (errorOrContext instanceof Error) {
      Sentry.captureException(errorOrContext, {
        extra: mergedExtra
      })
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: { ...mergedExtra, context: errorOrContext }
      })
    }
  }
}

/**
 * Set user context for Sentry
 * Call this after login
 */
function setUser(user) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Add a breadcrumb for tracking user journey
 */
function breadcrumb(category, message, data = {}) {
  if (isProd) {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: 'info',
    })
  }
  if (isDev) {
    console.log(`[BREADCRUMB:${category}]`, message, data)
  }
}

export const logger = {
  debug,
  info,
  warn,
  error,
  setUser,
  breadcrumb,
}

export default logger
