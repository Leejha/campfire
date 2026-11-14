import { QueryClient } from '@tanstack/react-query';

let browserQueryClient: QueryClient | null = null;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return createQueryClient();
  if (browserQueryClient === null) browserQueryClient = createQueryClient();
  return browserQueryClient;
}
