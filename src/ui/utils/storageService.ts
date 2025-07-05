// import { SessionData, ProtobufSerializationService } from './serialization';

// export interface StorageOptions {
//   location: 'localStorage' | 'indexedDB' | 'file' | 'memory';
//   compress?: boolean;
//   encryption?: boolean;
// }

// export class DataStorageService {
//   private serializationService: ProtobufSerializationService;
//   private memoryStorage: Map<string, string> = new Map();

//   constructor() {
//     this.serializationService = new ProtobufSerializationService();
//   }

//   /**
//    * 存储单个 SessionData
//    */
//   async saveSessionData(
//     key: string, 
//     sessionData: SessionData, 
//     options: StorageOptions = { location: 'localStorage' }
//   ): Promise<void> {
//     try {
//       const serializedData = this.serializationService.serializeSessionDataToBase64(sessionData);
      
//       switch (options.location) {
//         case 'localStorage':
//           await this.saveToLocalStorage(key, serializedData);
//           break;
//         case 'indexedDB':
//           await this.saveToIndexedDB(key, serializedData);
//           break;
//         case 'file':
//           await this.saveToFile(key, serializedData);
//           break;
//         case 'memory':
//           this.saveToMemory(key, serializedData);
//           break;
//         default:
//           throw new Error(`Unsupported storage location: ${options.location}`);
//       }

//       console.log(`✅ SessionData saved to ${options.location} with key: ${key}`);
//     } catch (error) {
//       console.error(`❌ Failed to save SessionData:`, error);
//       throw error;
//     }
//   }

//   /**
//    * 加载单个 SessionData
//    */
//   async loadSessionData(
//     key: string, 
//     options: StorageOptions = { location: 'localStorage' }
//   ): Promise<SessionData | null> {
//     try {
//       let serializedData: string | null = null;

//       switch (options.location) {
//         case 'localStorage':
//           serializedData = await this.loadFromLocalStorage(key);
//           break;
//         case 'indexedDB':
//           serializedData = await this.loadFromIndexedDB(key);
//           break;
//         case 'file':
//           serializedData = await this.loadFromFile(key);
//           break;
//         case 'memory':
//           serializedData = this.loadFromMemory(key);
//           break;
//         default:
//           throw new Error(`Unsupported storage location: ${options.location}`);
//       }

//       if (!serializedData) {
//         return null;
//       }

//       const sessionData = this.serializationService.deserializeSessionDataFromBase64(serializedData);
//       console.log(`✅ SessionData loaded from ${options.location} with key: ${key}`);
//       return sessionData;
//     } catch (error) {
//       console.error(`❌ Failed to load SessionData:`, error);
//       return null;
//     }
//   }

//   /**
//    * 批量存储 SessionData
//    */
//   async saveSessionDataBatch(
//     key: string,
//     sessionDataArray: SessionData[],
//     options: StorageOptions = { location: 'localStorage' }
//   ): Promise<void> {
//     try {
//       const serializedData = this.serializationService.serializeSessionDataBatchToBase64(sessionDataArray);
      
//       switch (options.location) {
//         case 'localStorage':
//           await this.saveToLocalStorage(key, serializedData);
//           break;
//         case 'indexedDB':
//           await this.saveToIndexedDB(key, serializedData);
//           break;
//         case 'file':
//           await this.saveToFile(key, serializedData);
//           break;
//         case 'memory':
//           this.saveToMemory(key, serializedData);
//           break;
//       }

//       console.log(`✅ ${sessionDataArray.length} SessionData items saved to ${options.location} with key: ${key}`);
//     } catch (error) {
//       console.error(`❌ Failed to save SessionData batch:`, error);
//       throw error;
//     }
//   }

//   /**
//    * 批量加载 SessionData
//    */
//   async loadSessionDataBatch(
//     key: string,
//     options: StorageOptions = { location: 'localStorage' }
//   ): Promise<SessionData[]> {
//     try {
//       let serializedData: string | null = null;

//       switch (options.location) {
//         case 'localStorage':
//           serializedData = await this.loadFromLocalStorage(key);
//           break;
//         case 'indexedDB':
//           serializedData = await this.loadFromIndexedDB(key);
//           break;
//         case 'file':
//           serializedData = await this.loadFromFile(key);
//           break;
//         case 'memory':
//           serializedData = this.loadFromMemory(key);
//           break;
//       }

//       if (!serializedData) {
//         return [];
//       }

//       const sessionDataArray = this.serializationService.deserializeSessionDataBatchFromBase64(serializedData);
//       console.log(`✅ ${sessionDataArray.length} SessionData items loaded from ${options.location} with key: ${key}`);
//       return sessionDataArray;
//     } catch (error) {
//       console.error(`❌ Failed to load SessionData batch:`, error);
//       return [];
//     }
//   }

//   /**
//    * 删除存储的数据
//    */
//   async deleteSessionData(
//     key: string,
//     options: StorageOptions = { location: 'localStorage' }
//   ): Promise<void> {
//     try {
//       switch (options.location) {
//         case 'localStorage':
//           localStorage.removeItem(key);
//           break;
//         case 'indexedDB':
//           await this.deleteFromIndexedDB(key);
//           break;
//         case 'file':
//           // 在 Electron 环境中可以删除文件
//           console.warn('File deletion not implemented in browser environment');
//           break;
//         case 'memory':
//           this.memoryStorage.delete(key);
//           break;
//       }
//       console.log(`✅ Data deleted from ${options.location} with key: ${key}`);
//     } catch (error) {
//       console.error(`❌ Failed to delete data:`, error);
//       throw error;
//     }
//   }

//   /**
//    * 列出所有存储的键
//    */
//   async listStoredKeys(options: StorageOptions = { location: 'localStorage' }): Promise<string[]> {
//     try {
//       switch (options.location) {
//         case 'localStorage':
//           return Object.keys(localStorage).filter(key => key.startsWith('session_'));
//         case 'indexedDB':
//           return await this.listIndexedDBKeys();
//         case 'memory':
//           return Array.from(this.memoryStorage.keys());
//         default:
//           return [];
//       }
//     } catch (error) {
//       console.error(`❌ Failed to list keys:`, error);
//       return [];
//     }
//   }

//   // === LocalStorage 实现 ===
//   private async saveToLocalStorage(key: string, data: string): Promise<void> {
//     const storageKey = `session_${key}`;
//     localStorage.setItem(storageKey, data);
//   }

//   private async loadFromLocalStorage(key: string): Promise<string | null> {
//     const storageKey = `session_${key}`;
//     return localStorage.getItem(storageKey);
//   }

//   // === IndexedDB 实现 ===
//   private async saveToIndexedDB(key: string, data: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const request = indexedDB.open('SessionDataDB', 1);
      
//       request.onerror = () => reject(request.error);
      
//       request.onsuccess = () => {
//         const db = request.result;
//         const transaction = db.transaction(['sessions'], 'readwrite');
//         const store = transaction.objectStore('sessions');
        
//         store.put({ id: key, data: data });
        
//         transaction.oncomplete = () => resolve();
//         transaction.onerror = () => reject(transaction.error);
//       };
      
//       request.onupgradeneeded = () => {
//         const db = request.result;
//         if (!db.objectStoreNames.contains('sessions')) {
//           db.createObjectStore('sessions', { keyPath: 'id' });
//         }
//       };
//     });
//   }

//   private async loadFromIndexedDB(key: string): Promise<string | null> {
//     return new Promise((resolve, reject) => {
//       const request = indexedDB.open('SessionDataDB', 1);
      
//       request.onerror = () => reject(request.error);
      
//       request.onsuccess = () => {
//         const db = request.result;
//         const transaction = db.transaction(['sessions'], 'readonly');
//         const store = transaction.objectStore('sessions');
//         const getRequest = store.get(key);
        
//         getRequest.onsuccess = () => {
//           const result = getRequest.result;
//           resolve(result ? result.data : null);
//         };
        
//         getRequest.onerror = () => reject(getRequest.error);
//       };
//     });
//   }

//   private async deleteFromIndexedDB(key: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const request = indexedDB.open('SessionDataDB', 1);
      
//       request.onsuccess = () => {
//         const db = request.result;
//         const transaction = db.transaction(['sessions'], 'readwrite');
//         const store = transaction.objectStore('sessions');
        
//         store.delete(key);
        
//         transaction.oncomplete = () => resolve();
//         transaction.onerror = () => reject(transaction.error);
//       };
//     });
//   }

//   private async listIndexedDBKeys(): Promise<string[]> {
//     return new Promise((resolve, reject) => {
//       const request = indexedDB.open('SessionDataDB', 1);
      
//       request.onsuccess = () => {
//         const db = request.result;
//         const transaction = db.transaction(['sessions'], 'readonly');
//         const store = transaction.objectStore('sessions');
//         const getAllRequest = store.getAllKeys();
        
//         getAllRequest.onsuccess = () => {
//           resolve(getAllRequest.result as string[]);
//         };
        
//         getAllRequest.onerror = () => reject(getAllRequest.error);
//       };
//     });
//   }

//   // === 文件系统实现 (Electron 环境) ===
//   private async saveToFile(key: string, data: string): Promise<void> {
//     if (typeof window !== 'undefined' && (window as any).electronAPI) {
//       // Electron 环境
//       try {
//         await (window as any).electronAPI.saveFile(`session_${key}.dat`, data);
//       } catch (error) {
//         throw new Error(`Failed to save to file: ${error}`);
//       }
//     } else {
//       // 浏览器环境 - 使用下载
//       this.downloadFile(`session_${key}.dat`, data);
//     }
//   }

//   private async loadFromFile(key: string): Promise<string | null> {
//     if (typeof window !== 'undefined' && (window as any).electronAPI) {
//       // Electron 环境
//       try {
//         return await (window as any).electronAPI.loadFile(`session_${key}.dat`);
//       } catch (error) {
//         console.warn(`Failed to load from file: ${error}`);
//         return null;
//       }
//     } else {
//       // 浏览器环境 - 需要用户选择文件
//       throw new Error('File loading in browser requires user interaction');
//     }
//   }

//   private downloadFile(filename: string, data: string): void {
//     const blob = new Blob([data], { type: 'application/octet-stream' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
//   }

//   // === 内存存储实现 ===
//   private saveToMemory(key: string, data: string): void {
//     this.memoryStorage.set(key, data);
//   }

//   private loadFromMemory(key: string): string | null {
//     return this.memoryStorage.get(key) || null;
//   }

//   /**
//    * 获取存储统计信息
//    */
//   async getStorageStats(options: StorageOptions = { location: 'localStorage' }): Promise<{
//     totalKeys: number;
//     totalSize: number;
//     keys: string[];
//   }> {
//     const keys = await this.listStoredKeys(options);
//     let totalSize = 0;

//     for (const key of keys) {
//       try {
//         const data = await this.loadFromLocalStorage(key);
//         if (data) {
//           totalSize += data.length;
//         }
//       } catch (error) {
//         console.warn(`Failed to get size for key ${key}:`, error);
//       }
//     }

//     return {
//       totalKeys: keys.length,
//       totalSize,
//       keys
//     };
//   }
// }

// // 导出单例实例
// export const dataStorageService = new DataStorageService();