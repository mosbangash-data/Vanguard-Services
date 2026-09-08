import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './vanguard-design-system.css'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Smart retry: NEVER retry on 429 (Too Many Requests), 401, 403, or 404
      retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status && (status === 429 || status === 401 || status === 403 || status === 404)) {
          return false
        }
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30s cache validity to avoid redundant query storms
    },
    mutations: {
      retry: false,
    },
  },
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

