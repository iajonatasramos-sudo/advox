import { useEffect, useState } from 'react';

type Sinal<T> = { get: () => T; subscribe: (fn: (v: T) => void) => () => void };

/** Lê um sinal do store e re-renderiza quando ele muda. */
export function useSinal<T>(s: Sinal<T>): T {
  const [v, setV] = useState<T>(s.get());
  useEffect(() => s.subscribe(setV), [s]);
  return v;
}
