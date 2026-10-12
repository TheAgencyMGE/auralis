import { createRoot } from 'react-dom/client'
import '../styles/tokens.css'
import '@ui/aqua-theme.css'
import './chrome.css'
import './aqua.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
