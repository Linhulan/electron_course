import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionData, CounterData } from './common/types';
import styles from './ImportDataViewer.module.css';
import toast from 'react-hot-toast';
import { VirtualSessionList } from './components/VirtualSessionList';
import { VirtualDetailTable } from './components/VirtualDetailTable';
import { debugLog } from './protocols';
import { usePageDataStore } from './contexts/store';

interface ImportDataViewerProps {
  className?: string;
}

interface SearchFilters {
  sessionID?: string;
  currencyCode?: string;
  serialNumber?: string;
  denomination?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  hasError?: boolean;
}

interface SearchResult {
  session: SessionData;
  detail: CounterData;
  matchType: 'session' | 'detail';
  matchField: string;
}

export const ImportDataViewer: React.FC<ImportDataViewerProps> = ({ className }) => {
  const { t } = useTranslation();
  
  // Refs for height calculation
  const sessionsListRef = useRef<HTMLDivElement>(null);
  const detailsContentRef = useRef<HTMLDivElement>(null);
  
  // 状态管理
  // const [importedData, setImportedData] = useState<SessionData[]>([]);
  const importedData = usePageDataStore(state => state.importedData);
  const setImportedData = usePageDataStore(state => state.setImportedData);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [isImporting, setIsImporting] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredDetails, setFilteredDetails] = useState<Map<string, CounterData[]>>(new Map());
  const [sortBy, setSortBy] = useState<'timestamp' | 'sessionID' | 'totalCount' | 'totalAmount'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sessionsHeight, setSessionsHeight] = useState(600);
  const [detailsHeight, setDetailsHeight] = useState(500);
  // const [isSearching, setIsSearching] = useState(false);
  // const [searchHistory, setSearchHistory] = useState<SearchFilters[]>([]);

  // 导入数据处理
  const handleImportExcel = async () => {
    setIsImporting(true);
    const toastId = toast.loading(t('importViewer.importing', 'Importing...'), { position: 'top-center' });
    try {
      const result = await window.electron.importFromExcel();
      
      // 检查用户是否取消了文件选择
      if (!result || result.cancelled) {
        toast.dismiss(toastId);
        return;
      }
      
      if (result.success && result.sessionData) {
        // 增量导入：合并新数据和现有数据
        const existingIds = new Set(importedData.map(session => session.id));
        const newSessions = result.sessionData.filter(session => !existingIds.has(session.id));
        const mergedData = [...importedData, ...newSessions];
        
        setImportedData(mergedData);
        
        if (newSessions.length > 0) {
          toast.success(`${newSessions.length} ${t('importViewer.importSuccess', 'new sessions imported successfully!')}`, { position: 'top-center', id: toastId });
          // 自动选择第一个新导入的Session
          setSelectedSession(newSessions[0]);
        } else if (result.sessionData.length > 0) {
          toast.success(t('importViewer.duplicateData', 'All sessions already exist, no new data imported'), { position: 'top-center', id: toastId });
        } else {
          toast.error(t('importViewer.noDataImported', 'Imported data is empty!'), { position: 'top-center', id: toastId });
        }
      } else {
        // 检查具体的错误类型并给出相应提示
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors[0];
          if (errorMessage.includes('not found') || errorMessage.includes('File not found')) {
            toast.error(t('importViewer.fileNotFound', 'Selected file not found'), { position: 'top-center', id: toastId });
          } else if (errorMessage.includes('format') || errorMessage.includes('invalid')) {
            toast.error(t('importViewer.invalidFileFormat', 'Invalid file format or corrupted file'), { position: 'top-center', id: toastId });
          } else {
            toast.error(t('importViewer.importFailed', 'Import failed!'), { position: 'top-center', id: toastId });
          }
        } else {
          // 如果没有成功导入或没有数据，关闭loading提示
          toast.dismiss(toastId);
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      // 检查是否是用户取消操作的错误
      if (error instanceof Error && (error.message.includes('cancelled') || error.message.includes('canceled'))) {
        toast.dismiss(toastId);
      } else {
        toast.error(t('importViewer.importFailed', 'Import failed!'), { position: 'top-center', id: toastId });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDirectory = async () => {
    setIsImporting(true);
    const toastId = toast.loading(t('importViewer.importing', 'Importing...'), { position: 'top-center' });
    try {
      const result = await window.electron.importFromDirectory(undefined, { skipDuplicates: true });
      
      // 检查用户是否取消了文件选择
      if (!result || result.cancelled) {
        toast.dismiss(toastId);
        return;
      }
      
      if (result.success && result.sessionData) {
        // 增量导入：合并新数据和现有数据
        const existingIds = new Set(importedData.map(session => session.id));
        const newSessions = result.sessionData.filter(session => !existingIds.has(session.id));
        const mergedData = [...importedData, ...newSessions];
        
        setImportedData(mergedData);
        
        if (newSessions.length > 0) {
          setSelectedSession(newSessions[0]);
          toast.success(`${newSessions.length} new Sessions ${t('importViewer.importSuccess', 'Import successful!')}`, { id: toastId });
        } else if (result.sessionData.length > 0) {
          toast.success(t('importViewer.duplicateData', 'All sessions already exist, no new data imported'), { id: toastId });
        } else {
          toast.success(t('importViewer.noDataImported', 'Imported data is empty!'), { id: toastId });
        }
      } else {
        // 检查是否是没有找到文件的错误
        if (result.errors && result.errors.some(error => error.includes('No Excel files found'))) {
          toast.error(t('importViewer.noExcelFilesFound', 'No Excel files found in the selected directory'), { id: toastId });
        } else {
          // 如果没有成功导入或没有数据，关闭loading提示
          toast.dismiss(toastId);
        }
      }
    } catch (error) {
      console.error('Batch import failed:', error);
      // 检查是否是用户取消操作的错误
      if (error instanceof Error && (error.message.includes('cancelled') || error.message.includes('canceled'))) {
        toast.dismiss(toastId);
      } else {
        toast.error(t('importViewer.importFailed', 'Import failed!'), { id: toastId });
      }
    } finally {
      setIsImporting(false);
    }
  };

  // 清除导入数据
  const handleClearImportedData = () => {
    setImportedData([]);
    setSelectedSession(null);
    setSearchFilters({});
    setSearchResults([]);
    setFilteredDetails(new Map());
    setShowSearchResults(false);
  };

  // 检查是否有有效的搜索条件
  const hasValidSearchFilters = useCallback(() => {
    return Object.values(searchFilters).some(value => 
      value !== undefined && value !== '' && value !== null
    );
  }, [searchFilters]);

  // 保存当前搜索条件到历史
  const saveSearchToHistory = useCallback(() => {
    if (hasValidSearchFilters()) {
      // setSearchHistory(prev => {
      //   const newHistory = [searchFilters, ...prev.filter(h => 
      //     JSON.stringify(h) !== JSON.stringify(searchFilters)
      //   )];
      //   return newHistory.slice(0, 5); // 只保留最近5次搜索
      // });
    }
  }, [hasValidSearchFilters]);

  // 从历史记录中应用搜索条件
  // const applySearchFromHistory = useCallback((filters: SearchFilters) => {
  //   setSearchFilters(filters);
  // }, []);

  // 搜索功能 - 优化为支持自由组合的AND逻辑
  const performSearch = useCallback(() => {
    if (!importedData.length) return;

    // 如果没有任何搜索条件，显示所有数据
    if (!hasValidSearchFilters()) {
      setSearchResults([]);
      setFilteredDetails(new Map());
      setShowSearchResults(false);
      return;
    }

    const results: SearchResult[] = [];
    const sessionFilteredDetails = new Map<string, CounterData[]>();
    
    importedData.forEach(session => {
      // 检查Session级别的所有条件（AND逻辑）
      const sessionConditions = [];
      const sessionMatchFields: string[] = [];

      // Session ID 条件
      if (searchFilters.sessionID) {
        const matches = session.id.toString().toLowerCase().includes(searchFilters.sessionID.toLowerCase());
        sessionConditions.push(matches);
        if (matches) sessionMatchFields.push('sessionID');
      }

      // 货币代码条件（Session级别）
      if (searchFilters.currencyCode) {
        const matches = session.currencyCode?.toLowerCase().includes(searchFilters.currencyCode.toLowerCase()) || false;
        sessionConditions.push(matches);
        if (matches) sessionMatchFields.push('currencyCode');
      }

      // 日期范围条件
      if (searchFilters.startDate || searchFilters.endDate) {
        const sessionDate = new Date(session.startTime);
        const startDate = searchFilters.startDate ? new Date(searchFilters.startDate) : null;
        const endDate = searchFilters.endDate ? new Date(searchFilters.endDate) : null;
        
        const matches = (!startDate || sessionDate >= startDate) && (!endDate || sessionDate <= endDate);
        sessionConditions.push(matches);
        if (matches) sessionMatchFields.push('dateRange');
      }

      // 错误状态条件
      if (searchFilters.hasError !== undefined) {
        const hasError = (session.errorCount || 0) > 0;
        const matches = hasError === searchFilters.hasError;
        sessionConditions.push(matches);
        if (matches) sessionMatchFields.push('hasError');
      }

      // Status条件（Session级别）
      if (searchFilters.status) {
        const matches = session.status === searchFilters.status;
        sessionConditions.push(matches);
        if (matches) sessionMatchFields.push('status');
      }

      // Session级别匹配：所有指定的条件都必须满足
      const sessionMatches = sessionConditions.length === 0 || sessionConditions.every(condition => condition);

      // 收集匹配的详细记录（仅当Session级别条件满足时）
      const matchedDetails: CounterData[] = [];
      
      if (sessionMatches && session.details) {
        session.details.forEach(detail => {
          const detailConditions = [];
          const detailMatchFields: string[] = [];

          // 冠字号条件
          if (searchFilters.serialNumber) {
            const searchSerial = searchFilters.serialNumber.toLowerCase();
            const detailSerial = detail.serialNumber?.toLowerCase() || '';
            const matches = detailSerial.includes(searchSerial);
            detailConditions.push(matches);
            if (matches) detailMatchFields.push('serialNumber');
          }

          // 面额条件
          if (searchFilters.denomination) {
            const searchDenom = parseFloat(searchFilters.denomination);
            const matches = !isNaN(searchDenom) && detail.denomination === searchDenom;
            detailConditions.push(matches);
            if (matches) detailMatchFields.push('denomination');
          }

          // 货币代码条件（Detail级别，与Session级别的货币条件可以不同）
          if (searchFilters.currencyCode) {
            const searchCurrency = searchFilters.currencyCode.toLowerCase();
            const detailCurrency = detail.currencyCode?.toLowerCase() || '';
            const matches = detailCurrency.includes(searchCurrency);
            detailConditions.push(matches);
            if (matches) detailMatchFields.push('detailCurrency');
          }

          // Status条件（Detail级别）
          if (searchFilters.status) {
            const matches = detail.status === searchFilters.status;
            detailConditions.push(matches);
            if (matches) detailMatchFields.push('detailStatus');
          }

          // Detail级别匹配：如果有detail级别的搜索条件，所有指定的条件都必须满足
          const hasDetailSearchCriteria = searchFilters.serialNumber || 
                                        searchFilters.denomination || 
                                        (searchFilters.currencyCode && session.details) ||
                                        (searchFilters.status && session.details);
          
          const detailMatches = !hasDetailSearchCriteria || 
                               (detailConditions.length > 0 && detailConditions.every(condition => condition));

          if (detailMatches && hasDetailSearchCriteria) {
            matchedDetails.push(detail);
            results.push({
              session,
              detail,
              matchType: 'detail',
              matchField: detailMatchFields.join('+')
            });
          }
        });
      }

      // 决定如何处理这个Session
      const hasDetailSearchCriteria = searchFilters.serialNumber || 
                                     searchFilters.denomination ||
                                     (searchFilters.status && session.details);

      if (sessionMatches) {
        if (hasDetailSearchCriteria) {
          // 有Detail级别的搜索条件，只显示匹配的details
          if (matchedDetails.length > 0) {
            sessionFilteredDetails.set(session.id, matchedDetails);
          }
        } else {
          // 只有Session级别的搜索条件，显示所有details
          sessionFilteredDetails.set(session.id, session.details || []);
          results.push({
            session,
            detail: {} as CounterData,
            matchType: 'session',
            matchField: sessionMatchFields.join('+')
          });
        }
      }
    });

    setSearchResults(results);
    setFilteredDetails(sessionFilteredDetails);
    setShowSearchResults(results.length > 0 || Object.keys(searchFilters).some(key => searchFilters[key as keyof SearchFilters] !== undefined && searchFilters[key as keyof SearchFilters] !== ''));
    
    // 保存有效的搜索条件到历史
    if (results.length > 0) {
      saveSearchToHistory();
    }
    else 
    {
      setSelectedSession(null);
    }
  }, [importedData, searchFilters, hasValidSearchFilters, saveSearchToHistory]);

  // 清除搜索
  const clearSearch = () => {
    setSearchFilters({});
    setSearchResults([]);
    setFilteredDetails(new Map());
    setShowSearchResults(false);
    
    // 清除搜索后自动选中第一个原始数据的session
    if (importedData.length > 0) {
      setSelectedSession(importedData[0]);
    }
  };

  // 排序后的数据
  const sortedData = useMemo(() => {
    const dataToSort = showSearchResults 
      ? searchResults.map(r => r.session).filter((session, index, arr) => 
          arr.findIndex(s => s.id === session.id) === index
        )
      : importedData;

    return [...dataToSort].sort((a, b) => {
      let aValue: string | number | Date, bValue: string | number | Date;
      
      switch (sortBy) {
        case 'sessionID':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'totalCount':
          aValue = a.totalCount;
          bValue = b.totalCount;
          break;
        case 'totalAmount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case 'timestamp':
        default:
          aValue = new Date(a.startTime);
          bValue = new Date(b.startTime);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [importedData, searchResults, showSearchResults, sortBy, sortOrder]);

  // 处理Session选择
  const handleSessionSelect = (session: SessionData) => {
    setSelectedSession(session);
  };  

  // 获取货币显示信息（多货币时显示MULTI）
  const getCurrencyDisplay = (session: SessionData) => {
    // 检查是否有多货币记录
    if (session.currencyCountRecords && session.currencyCountRecords.size > 1) {
      // 过滤出有效的货币代码（3个字母的标准格式）
      const validCurrencies = Array.from(session.currencyCountRecords.keys())
        .filter(code => code && /^[A-Z]{3}$/.test(code));
      
      if (validCurrencies.length > 1) {
        return 'MULTI';
      } else if (validCurrencies.length === 1) {
        return validCurrencies[0];
      }
    }
    
    // 检查是否有单一货币记录
    if (session.currencyCountRecords && session.currencyCountRecords.size === 1) {
      const currency = Array.from(session.currencyCountRecords.keys())[0];
      if (currency && /^[A-Z]{3}$/.test(currency)) {
        return currency;
      }
    }
    
    // 回退到原始货币代码，也要验证格式
    if (session.currencyCode && /^[A-Z]{3}$/.test(session.currencyCode)) {
      return session.currencyCode;
    }
    
    return 'N/A';
  };

  // 判断是否为错误行
  const isErrorRow = (detail: CounterData): boolean => {
    return detail.status === 'error' || (detail.errorCode !== undefined && detail.errorCode !== '' && detail.errorCode !== 'E0');
  };

  // 自动搜索：当搜索条件改变时自动执行搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 500); // 500ms防抖延迟

    return () => clearTimeout(timeoutId);
  }, [performSearch]);

  // 动态计算虚拟滚动容器高度
  useEffect(() => {
    const calculateHeights = () => {
      if (sessionsListRef.current) {
        const rect = sessionsListRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 20; // 20px 底部间距
        setSessionsHeight(Math.max(300, availableHeight));
      }
      
      if (detailsContentRef.current) {
        const rect = detailsContentRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 20; // 20px 底部间距
        setDetailsHeight(Math.max(300, availableHeight));
      }
    };

    calculateHeights();
    
    const handleResize = () => {
      calculateHeights();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [importedData, selectedSession]);

  // 当搜索状态改变时，确保选中合适的session
  useEffect(() => {
    if (showSearchResults && sortedData.length > 0) {
      // 搜索状态开启且有结果时，选中第一个搜索结果
      debugLog('Search results available, selecting first:', sortedData[0]?.id);
      setSelectedSession(sortedData[0]);
    } else if (!showSearchResults && importedData.length > 0) {
      // 搜索状态关闭时, 选中第一个原始数据
      debugLog('Search cleared, selecting first from imported data:', importedData[0]?.id);
      setSelectedSession(importedData[0]);
    }
  }, [showSearchResults, sortedData, importedData]);

  return (
    <div className={`${styles.importDataViewer} ${className || ''}`}>
      {/* 功能区域 */}
      <div className={styles.viewerHeader}>
        <div className={styles.headerTitle}>
          <h2>📂 {t('importViewer.title', 'Import Data Viewer')}</h2>
          <span className={styles.dataCount}>
            {importedData.length} {t('importViewer.sessionsLoaded', 'sessions loaded')}
          </span>
        </div>

        {/* 导入按钮区 */}
        <div className={styles.importControls}>
          <button 
            className={`${styles.importBtn} ${styles.clearFilter}`}
            onClick={clearSearch}
            disabled={!hasValidSearchFilters()}
          >
            🔍 {t('importViewer.clearFilters', 'Clear Filters')}
          </button>
          <button 
            className={`${styles.importBtn} ${styles.singleImport}`}
            onClick={handleImportExcel}
            disabled={isImporting}
          >
            {isImporting ? t('importViewer.importing', 'Importing...') : t('importViewer.importFile', 'Import Excel File')}
          </button>
          <button 
            className={`${styles.importBtn} ${styles.batchImport}`}
            onClick={handleImportDirectory}
            disabled={isImporting}
          >
            {isImporting ? t('importViewer.importing', 'Importing...') : t('importViewer.importDirectory', 'Import Directory')}
          </button>
          <button 
            className={`${styles.importBtn} ${styles.clearImport}`}
            onClick={handleClearImportedData}
            disabled={isImporting || importedData.length === 0}
          >
            🗑️ {t('importViewer.clearData', 'Clear Data')}
          </button>
          
        </div>
      </div>

      {/* 搜索筛选区域 */}
      <div className={`${styles.searchPanel} searchPanel`}>
        <div className={styles.searchFilters}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>{t('importViewer.currencyCode', 'Currency Code')}</label>
              <input
                type="text"
                value={searchFilters.currencyCode || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, currencyCode: e.target.value}))}
                placeholder={t('importViewer.currencyPlaceholder', 'e.g. CNY, USD')}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>{t('importViewer.denomination', 'Denomination')}</label>
              <input
                type="number"
                value={searchFilters.denomination || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, denomination: e.target.value}))}
                placeholder={t('importViewer.denominationPlaceholder', 'e.g. 100')}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>{t('importViewer.serialNumber', 'Serial Number (冠字号)')}</label>
              <input
                type="text"
                value={searchFilters.serialNumber || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, serialNumber: e.target.value}))}
                placeholder={t('importViewer.serialPlaceholder', 'Enter serial number')}
              />
              {searchFilters.serialNumber && (
                <div className={styles.searchHint}>
                  {(() => {
                    const matchCount = searchResults.filter(r => r.matchType === 'detail' && r.matchField.includes('serialNumber')).length;
                    return matchCount > 0 ? (
                      <>
                        <span className={styles.matchCount}>{matchCount}</span>
                        <span>{t('importViewer.serialMatches', 'serial number matches found')}</span>
                      </>
                    ) : showSearchResults ? (
                      <>
                        <span className={styles.noMatch}>0</span>
                        <span>{t('importViewer.noSerialMatches', 'No matches found')}</span>
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>{t('importViewer.sessionID', 'Session ID')}</label>
              <input
                type="text"
                value={searchFilters.sessionID || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, sessionID: e.target.value}))}
                placeholder={t('importViewer.sessionIDPlaceholder', 'Enter session ID')}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>{t('importViewer.startDate', 'Start Date')}</label>
              <input
                type="datetime-local"
                value={searchFilters.startDate || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, startDate: e.target.value}))}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>{t('importViewer.endDate', 'End Date')}</label>
              <input
                type="datetime-local"
                value={searchFilters.endDate || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, endDate: e.target.value}))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className={styles.viewerContent}>
        {/* 左侧Session列表 */}
        <div className={styles.sessionsPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.headerTitleGroup}>
              <h3>{t('importViewer.sessionList', 'Session List')}</h3>
              <span className={styles.sessionCount}>
                {(() => {
                  const currentCount = sortedData.length;
                  const totalCount = importedData.length;
                  
                  if (showSearchResults && currentCount !== totalCount) {
                    return (
                      <span className={styles.matchCount}>
                        {currentCount} / {totalCount}
                      </span>
                    );
                  } else {
                    return (
                      <span className={styles.totalCount}>
                        {totalCount} {t('importViewer.totalSessions', 'sessions')}
                      </span>
                    );
                  }
                })()}
              </span>
            </div>
            
            {/* 排序控制 */}
            <div className={styles.sortControls}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'timestamp' | 'sessionID' | 'totalCount' | 'totalAmount')}
                className={styles.sortSelect}
              >
                <option value="timestamp">{t('importViewer.sortByTime', 'Sort by Time')}</option>
                <option value="sessionID">{t('importViewer.sortBySessionID', 'Sort by Session ID')}</option>
                <option value="totalCount">{t('importViewer.sortByCount', 'Sort by Count')}</option>
                <option value="totalAmount">{t('importViewer.sortByAmount', 'Sort by Amount')}</option>
              </select>
              <button 
                className={styles.sortOrderBtn}
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className={styles.sessionsList} ref={sessionsListRef}>
            <VirtualSessionList
              sessions={sortedData}
              selectedSession={selectedSession}
              onSessionSelect={handleSessionSelect}
              height={sessionsHeight}
              getCurrencyDisplay={getCurrencyDisplay}
            />
          </div>
        </div>

        {/* 右侧详情面板 */}
        <div className={styles.detailsPanel}>
          {selectedSession ? (
            <>
              <div className={styles.panelHeader}>
                <h3>{t('importViewer.sessionDetails', 'Session Details')} - #{selectedSession.no}</h3>
                <div className={styles.sessionSummary}>
                  <span>
                    {(() => {
                      const detailsToShow = showSearchResults && filteredDetails.has(selectedSession.id) 
                        ? filteredDetails.get(selectedSession.id) 
                        : selectedSession.details;
                      const count = detailsToShow?.length || 0;
                      const totalCount = selectedSession.details?.length || 0;
                      
                      if (showSearchResults && filteredDetails.has(selectedSession.id)) {
                        return `${count} / ${totalCount} ${t('importViewer.records', 'records')} (filtered)`;
                      } else {
                        return `${count} ${t('importViewer.records', 'records')}`;
                      }
                    })()}
                  </span>
                </div>
              </div>

              <div className={styles.detailsContent} ref={detailsContentRef}>
                {(() => {
                  // 获取要显示的details：如果有搜索过滤，显示过滤后的；否则显示全部
                  const detailsToShow = showSearchResults && filteredDetails.has(selectedSession.id) 
                    ? filteredDetails.get(selectedSession.id) 
                    : selectedSession.details;
                  
                  return detailsToShow && detailsToShow.length > 0 ? (
                    <VirtualDetailTable
                      details={detailsToShow}
                      height={detailsHeight}
                      isErrorRow={isErrorRow}
                      searchTerm={searchFilters.serialNumber}
                    />
                  ) : (
                    <div className={styles.noDetails}>
                      <div className={styles.noDetailsIcon}>📄</div>
                      <div className={styles.noDetailsText}>
                        {showSearchResults 
                          ? t('importViewer.noMatchingDetails', 'No matching detail records found')
                          : t('importViewer.noDetails', 'No detail records found')
                        }
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className={styles.noSelection}>
              <div className={styles.noSelectionIcon}>👈</div>
              <div className={styles.noSelectionText}>
                {t('importViewer.selectSession', 'Select a session to view details')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDataViewer;
