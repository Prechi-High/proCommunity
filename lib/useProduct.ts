import { useQueries, useQuery } from '@tanstack/react-query';

import { loadProduct } from './products';

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => loadProduct(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProducts(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['product', id] as const,
      queryFn: () => loadProduct(id),
      enabled: Boolean(id),
      staleTime: 5 * 60 * 1000,
    })),
  });
}
