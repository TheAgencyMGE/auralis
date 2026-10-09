import { createRoot } from 'react-dom/client'
import '../styles/tokens.css'
import './overlay.css'
import { OverlayApp } from './Overlay'

createRoot(document.getElementById('root')!).render(<OverlayApp />)
