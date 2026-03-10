import React from 'react'
import ReactDOM from 'react-dom/client'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { App } from './App'
import './index.css'
import 'reactflow/dist/style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider>
      <SidebarProvider>
        <App />
      </SidebarProvider>
    </TooltipProvider>
  </React.StrictMode>,
)
