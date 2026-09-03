import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './i18n/config'
import { ErrorBoundary } from './ErrorBoundary'

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
