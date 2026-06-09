import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => toast.error(`Lỗi: ${error.message}`),
  }),
  mutationCache: new MutationCache({
    onError: (error) => toast.error(`Lỗi: ${error.message}`),
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
);
