import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Providers } from './context'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)
