import { create } from 'zustand';

interface AppState {
  autoSave: boolean;
  theme: 'light' | 'dark';
}

interface AppActions {
  setAutoSave: (value: boolean) => void;
  setTheme: (value: 'light' | 'dark') => void;
}

export const useAppConfigStore = create<AppState & AppActions>((set) => ({
  autoSave: true,
  setAutoSave: (value) => set({ autoSave: value }),
  theme: 'dark',
  setTheme: (value) => set({ theme: value }),
}));
