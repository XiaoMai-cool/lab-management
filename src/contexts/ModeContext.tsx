import { createContext, useContext, useState, type ReactNode } from 'react';

type AppMode = 'use' | 'manage';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  hasChosenMode: boolean;
  setHasChosenMode: (v: boolean) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    return (localStorage.getItem('app_mode') as AppMode) || 'use';
  });
  const [hasChosenMode, setHasChosenMode] = useState(() => {
    return localStorage.getItem('has_chosen_mode') === 'true';
  });

  function setMode(m: AppMode) {
    setModeState(m);
    localStorage.setItem('app_mode', m);
  }

  function setHasChosenModeWrapped(v: boolean) {
    setHasChosenMode(v);
    if (v) localStorage.setItem('has_chosen_mode', 'true');
    else localStorage.removeItem('has_chosen_mode');
  }

  return (
    <ModeContext.Provider value={{ mode, setMode, hasChosenMode, setHasChosenMode: setHasChosenModeWrapped }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextType {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
