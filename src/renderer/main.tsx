import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from './i18n'
import App from './App'
import './App.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

console.log('[renderer] window.api available:', !!window.api)

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
)
