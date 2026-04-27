import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hand off from the inline HTML loader to the React LoadingScreen once
// React has mounted and the GLB-progress UI is on screen.
const initial = document.getElementById('initial-loader')
if (initial) {
  initial.style.opacity = '0'
  setTimeout(() => initial.remove(), 500)
}
