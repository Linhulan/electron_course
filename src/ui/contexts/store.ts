import { create } from 'zustand';

interface AppState {
  autoSave: boolean;
}

interface AppActions {
  setAutoSave: (value: boolean) => void;
}

export const useAppConfigStore = create<AppState & AppActions>((set) => ({
  autoSave: true,
  setAutoSave: (value) => set({ autoSave: value }),
}));
