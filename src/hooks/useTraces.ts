import type { Trace } from '../domain/trace.types';
import { useLocalStorageState } from './useLocalStorageState';

export function useTraces() {
  const [traces, setTraces] = useLocalStorageState<Trace[]>('capclair.traces', []);

  const saveTrace = (trace: Trace) => {
    if (trace.positions.length < 2) return;
    setTraces((current) => [trace, ...current].slice(0, 20));
  };

  const deleteTrace = (traceId: string) => {
    setTraces((current) => current.filter((trace) => trace.id !== traceId));
  };

  return { traces, saveTrace, deleteTrace };
}
