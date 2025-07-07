
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CurrencyCountRecord, SessionData } from '../common/types';
import { CounterStats } from '../CounterDashboard';

interface AppState {
  autoSave: boolean;
  theme: 'light' | 'dark';
  serialConnected: boolean;
}

interface pageData {
  sessions: SessionData[];
  currentSession?: SessionData | null;
  stats: CounterStats;
  importedData: SessionData[];
}

interface pageDataActions {
  setSessions: (updater: (prev: SessionData[]) => SessionData[]) => void;
  setCurrentSession: (currentSession?: SessionData | null) => void;
  setStats: (stats: CounterStats) => void;
  setImportedData: (importedData: SessionData[]) => void;
}

interface AppActions {
  setAutoSave: (value: boolean) => void;
  setTheme: (value: 'light' | 'dark') => void;
  setSerialConnected: (value: boolean) => void;
}

// 类型安全的序列化函数来处理 Map 对象

// 递归地将 Map 对象转换为数组
const deepSerializeMaps = (obj: unknown): unknown => {
  if (obj instanceof Map) {
    return Array.from(obj.entries()).map(([key, value]) => [key, deepSerializeMaps(value)]);
  } else if (Array.isArray(obj)) {
    return obj.map(deepSerializeMaps);
  } else if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepSerializeMaps(value);
    }
    return result;
  }
  return obj;
};

// 递归地将数组恢复为 Map 对象
const deepRestoreMaps = (obj: unknown, mapKeys: Set<string> = new Set(['totalRecords', 'currencyCountRecords', 'denominationBreakdown'])): unknown => {
  if (Array.isArray(obj) && obj.length > 0 && Array.isArray(obj[0]) && obj[0].length === 2) {
    // 这可能是一个序列化的 Map
    const map = new Map();
    obj.forEach(([key, value]: [unknown, unknown]) => {
      map.set(key, deepRestoreMaps(value, mapKeys));
    });
    return map;
  } else if (Array.isArray(obj)) {
    return obj.map(item => deepRestoreMaps(item, mapKeys));
  } else if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (mapKeys.has(key) && Array.isArray(value)) {
        // 这是一个应该恢复为 Map 的字段
        result[key] = deepRestoreMaps(value, mapKeys);
      } else {
        result[key] = deepRestoreMaps(value, mapKeys);
      }
    }
    return result;
  }
  return obj;
};

const customStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    
    try {
      const data = JSON.parse(str);
      console.log('� Restoring data from localStorage:', name);
      
      // 使用递归函数恢复所有 Map 对象
      const restoredData = deepRestoreMaps(data) as Record<string, unknown>;
      
      // 确保关键字段存在
      if (!restoredData.state) restoredData.state = {};
      const state = restoredData.state as Record<string, unknown>;
      if (!state.stats) state.stats = {};
      const stats = state.stats as Record<string, unknown>;
      if (!stats.totalRecords) {
        stats.totalRecords = new Map<string, CurrencyCountRecord>();
      }
      if (!state.sessions) state.sessions = [];
      if (!state.importedData) state.importedData = [];
      
      console.log('✅ Data restoration completed');
      return JSON.stringify(restoredData);
    } catch (error) {
      console.error('❌ Error parsing stored data:', error);
      return null;
    }
  },
  
  setItem: (name: string, value: string) => {
    try {
      console.log('� Saving data to localStorage:', name);
      
      // 使用递归函数序列化所有 Map 对象
      const serializedData = deepSerializeMaps(value);
      
      localStorage.setItem(name, JSON.stringify(serializedData));
      console.log('✅ Data saved successfully');
    } catch (error) {
      console.error('❌ Error storing data:', error);
    }
  },
  
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  }
};

export const usePageDataStore = create<pageData & pageDataActions>()(
  persist(
    (set) => ({
      sessions: [],
      importedData: [],
      currentSession: undefined,
      stats: {
        totalRecords: new Map<string, CurrencyCountRecord>(),
        totalSessions: 0,
        totalAmount: 0,
        totalNotes: 0,
        averageSpeed: 0,
        errorPcs: 0,
      },
      setSessions: (updater: (prev: SessionData[]) => SessionData[]) => set((state) => ({ sessions: updater(state.sessions) })),
      setImportedData: (importedData: SessionData[]) => set({ importedData }),
      setStats: (stats: CounterStats) => set({ stats }),
      setCurrentSession: (currentSession?: SessionData | null) => set({ currentSession }),
    }),
    {
      name: 'app-storage', // localStorage key
      storage: customStorage as any, // 使用自定义存储处理 Map 对象
    }
  )
);

export const useAppConfigStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      autoSave: true,
      setAutoSave: (value) => set({ autoSave: value }),
      theme: 'dark',
      setTheme: (value) => set({ theme: value }),
      serialConnected: false,
      setSerialConnected: (value) => set({ serialConnected: value }),
    }),
    {
      name: 'app-config-storage', // localStorage key
    }
  )
);