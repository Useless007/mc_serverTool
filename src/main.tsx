import React from 'react'
import ReactDOM from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <TooltipProvider>
        <div className="dark min-h-screen">
          <App />
        </div>
      </TooltipProvider>
    </React.StrictMode>
  )
}