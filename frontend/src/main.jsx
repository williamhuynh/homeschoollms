import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import * as Sentry from '@sentry/react'
import { store, rehydrateStore } from './state/store'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Initialize Sentry for error tracking (production only)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    
    // Only enable in production
    enabled: import.meta.env.PROD,
    
    // Capture 100% of errors, sample 10% of transactions for performance
    tracesSampleRate: 0.1,
    
    // Don't send errors from localhost
    beforeSend(event) {
      if (window.location.hostname === 'localhost') {
        return null
      }
      return event
    },
  })
}

// Register service worker for PWA support
// Auto-updates when new version is available
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      // Auto-reload when new version is available
      // Service worker will update automatically due to autoUpdate mode
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
  })
}

rehydrateStore().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  )
})
