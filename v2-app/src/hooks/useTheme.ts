import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';

const THEME_CHANGE_EVENT = 'yb_theme_change';

function getStoredMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode');
      if (urlMode === 'dark' || urlMode === 'light') return urlMode;
    }
    const val = localStorage.getItem('yb_theme_mode');
    if (val === 'dark' || val === 'light') return val;
  } catch {
    // ignore
  }
  return 'dark';
}

function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-mode', mode);
  document.documentElement.removeAttribute('data-theme');
  if (mode === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);

  useEffect(() => {
    applyThemeToDOM(mode);

    const handleThemeChange = () => {
      const m = getStoredMode();
      setModeState(m);
      applyThemeToDOM(m);
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener('storage', handleThemeChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    try {
      localStorage.setItem('yb_theme_mode', newMode);
    } catch {
      // ignore
    }
    setModeState(newMode);
    applyThemeToDOM(newMode);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const toggleMode = useCallback(() => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  }, [mode, setMode]);

  return {
    mode,
    isDark: mode === 'dark',
    setMode,
    toggleMode,
  };
}
