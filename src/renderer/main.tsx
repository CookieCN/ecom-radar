import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

// Log for debugging preload availability
console.log('[renderer] window.api available:', !!window.api)

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
