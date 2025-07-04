import { create } from 'zustand';

interface AppState {
  autoSave: boolean;
  theme: 'light' | 'dark';
  serialConnected: boolean;
}

interface AppActions {
  setAutoSave: (value: boolean) => void;
  setTheme: (value: 'light' | 'dark') => void;
  setSerialConnected: (value: boolean) => void;
}

export const useAppConfigStore = create<AppState & AppActions>((set) => ({
  autoSave: true,
  setAutoSave: (value) => set({ autoSave: value }),
  theme: 'dark',
  setTheme: (value) => set({ theme: value }),
  serialConnected: false,
  setSerialConnected: (value) => set({ serialConnected: value }),
}));
