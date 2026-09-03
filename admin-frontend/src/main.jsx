import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './vanguard-design-system.css'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)

