import { createContext, useContext, useState, type ReactNode } from 'react';

type AppMode = 'use' | 'manage';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    return (safeGetItem('app_mode') as AppMode) || 'use';
  });

  function setMode(m: AppMode) {
    setModeState(m);
    safeSetItem('app_mode', m);
  }

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextType {
  const ctx = useContext(ModeContext);
  if (!ctx) return { mode: 'use', setMode: () => {} }; // 安全降级，不抛错
  return ctx;
}
