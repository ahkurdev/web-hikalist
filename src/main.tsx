import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthApp } from './AuthApp'
import { createSupabaseAuthGateway } from './lib/authGateway'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element is missing')

createRoot(rootElement).render(
  <StrictMode>
    <AuthApp gateway={createSupabaseAuthGateway()} search={window.location.search} />
  </StrictMode>,
)
