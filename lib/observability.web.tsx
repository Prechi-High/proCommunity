import { type ComponentType, type ReactNode } from 'react';

/** Web keeps the initial shell dependency-light. Native observability remains unchanged. */
export function ObservabilityProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function wrapRoot(component: ComponentType) {
  return component;
}
