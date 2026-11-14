import type { ReactElement, ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '~/lib/get-query-client';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: Readonly<QueryProviderProps>): ReactElement {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
