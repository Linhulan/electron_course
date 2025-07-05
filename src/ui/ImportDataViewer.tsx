import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionData, CounterData } from './common/types';
import styles from './ImportDataViewer.module.css';

interface ImportDataViewerProps {
  className?: string;
}

interface SearchFilters {
  sessionNo?: string;
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

interface FilteredSessionData extends SessionData {
  filteredDetails?: CounterData[];
}

export const ImportDataViewer: React.FC<ImportDataViewerProps> = ({ className }) => {
  const { t } = useTranslation();
  
  // 状态管理
  const [importedData, setImportedData] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [isImporting, setIsImporting] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredDetails, setFilteredDetails] = useState<Map<number, CounterData[]>>(new Map());
  const [sortBy, setSortBy] = useState<'timestamp' | 'sessionNo' | 'totalCount' | 'totalAmount'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 导入数据处理
  const handleImportExcel = async () => {
    setIsImporting(true);
    try {
      const result = await window.electron.importFromExcel();
      if (result.success && result.sessionData) {
        setImportedData(result.sessionData);
        // 自动选择第一个Session
        if (result.sessionData.length > 0) {
          setSelectedSession(result.sessionData[0]);
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDirectory = async () => {
    setIsImporting(true);
    try {
      const result = await window.electron.importFromDirectory();
      if (result.success && result.sessionData) {
        setImportedData(result.sessionData);
        if (result.sessionData.length > 0) {
          setSelectedSession(result.sessionData[0]);
        }
      }
    } catch (error) {
      console.error('Batch import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // 搜索功能
  const performSearch = useCallback(() => {
    if (!importedData.length) return;

    const results: SearchResult[] = [];
    const sessionFilteredDetails = new Map<number, CounterData[]>();
    
    importedData.forEach(session => {
      // 搜索Session级别的字段
      let sessionMatches = false;
      let sessionMatchField = '';

      if (searchFilters.sessionNo && session.no.toString().includes(searchFilters.sessionNo)) {
        sessionMatches = true;
        sessionMatchField = 'sessionNo';
      }

      if (searchFilters.currencyCode && session.currencyCode?.toLowerCase().includes(searchFilters.currencyCode.toLowerCase())) {
        sessionMatches = true;
        sessionMatchField = 'currencyCode';
      }

      if (searchFilters.startDate || searchFilters.endDate) {
        const sessionDate = new Date(session.startTime);
        const startDate = searchFilters.startDate ? new Date(searchFilters.startDate) : null;
        const endDate = searchFilters.endDate ? new Date(searchFilters.endDate) : null;
        
        if ((!startDate || sessionDate >= startDate) && (!endDate || sessionDate <= endDate)) {
          sessionMatches = true;
          sessionMatchField = 'dateRange';
        }
      }

      if (searchFilters.hasError !== undefined) {
        const hasError = (session.errorCount || 0) > 0;
        if (hasError === searchFilters.hasError) {
          sessionMatches = true;
          sessionMatchField = 'hasError';
        }
      }

      // 收集匹配的详细记录
      const matchedDetails: CounterData[] = [];

      // 搜索Details级别的字段
      if (session.details) {
        session.details.forEach(detail => {
          let detailMatches = false;
          let detailMatchField = '';

          // 冠字号搜索（高级功能）
          if (searchFilters.serialNumber) {
            const searchSerial = searchFilters.serialNumber.toLowerCase();
            const detailSerial = detail.serialNumber?.toLowerCase() || '';
            
            if (detailSerial.includes(searchSerial)) {
              detailMatches = true;
              detailMatchField = 'serialNumber';
              
              // 高级搜索：冠字号+货币代码组合搜索
              if (searchFilters.currencyCode) {
                const searchCurrency = searchFilters.currencyCode.toLowerCase();
                const detailCurrency = detail.currencyCode?.toLowerCase() || '';
                
                if (detailCurrency.includes(searchCurrency)) {
                  detailMatchField = 'serialNumber+currency';
                } else {
                  detailMatches = false; // 如果货币代码不匹配，则不算匹配
                }
              }
            }
          }

          if (searchFilters.denomination) {
            const searchDenom = parseFloat(searchFilters.denomination);
            if (!isNaN(searchDenom) && detail.denomination === searchDenom) {
              detailMatches = true;
              detailMatchField = 'denomination';
            }
          }

          if (searchFilters.status && detail.status === searchFilters.status) {
            detailMatches = true;
            detailMatchField = 'status';
          }

          if (detailMatches) {
            matchedDetails.push(detail);
            results.push({
              session,
              detail,
              matchType: 'detail',
              matchField: detailMatchField
            });
          }
        });
      }

      // 如果Session级别匹配，或者有匹配的details
      if (sessionMatches || matchedDetails.length > 0) {
        if (sessionMatches && matchedDetails.length === 0) {
          // Session级别匹配但没有detail匹配，显示所有details
          sessionFilteredDetails.set(session.id, session.details || []);
          results.push({
            session,
            detail: {} as CounterData, // 空对象，因为这是Session级别的匹配
            matchType: 'session',
            matchField: sessionMatchField
          });
        } else if (matchedDetails.length > 0) {
          // 有匹配的details，只显示匹配的details
          sessionFilteredDetails.set(session.id, matchedDetails);
        }
      }
    });

    setSearchResults(results);
    setFilteredDetails(sessionFilteredDetails);
    setShowSearchResults(results.length > 0);
  }, [importedData, searchFilters]);

  // 清除搜索
  const clearSearch = () => {
    setSearchFilters({});
    setSearchResults([]);
    setFilteredDetails(new Map());
    setShowSearchResults(false);
  };

  // 排序后的数据
  const sortedData = useMemo(() => {
    const dataToSort = showSearchResults 
      ? searchResults.map(r => r.session).filter((session, index, arr) => 
          arr.findIndex(s => s.id === session.id) === index
        )
      : importedData;

    return [...dataToSort].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'sessionNo':
          aValue = a.no;
          bValue = b.no;
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

  // 获取Session的显示状态
  const getSessionDisplayStatus = (session: SessionData) => {
    if (session.status === 'error' || (session.errorCount && session.errorCount > 0)) {
      return { text: 'Error', class: 'statusError' };
    }
    if (session.status === 'completed') {
      return { text: 'Completed', class: 'statusCompleted' };
    }
    return { text: session.status, class: 'statusOther' };
  };

  // 格式化货币
  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

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
        </div>
      </div>

      {/* 搜索筛选区域 */}
      <div className={styles.searchPanel}>
        <div className={styles.searchTitle}>
          <h3>🔍 {t('importViewer.searchFilters', 'Search & Filters')}</h3>
          {showSearchResults && (
            <span className={styles.searchResultsCount}>
              {searchResults.length} {t('importViewer.resultsFound', 'results found')}
            </span>
          )}
        </div>

        <div className={styles.searchFilters}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>{t('importViewer.sessionNo', 'Session No')}</label>
              <input
                type="text"
                value={searchFilters.sessionNo || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, sessionNo: e.target.value}))}
                placeholder={t('importViewer.sessionNoPlaceholder', 'Enter session number')}
              />
            </div>

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
              <label>{t('importViewer.serialNumber', 'Serial Number (冠字号)')}</label>
              <input
                type="text"
                value={searchFilters.serialNumber || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, serialNumber: e.target.value}))}
                placeholder={t('importViewer.serialPlaceholder', 'Enter serial number')}
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
          </div>

          <div className={styles.filterRow}>
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

            <div className={styles.filterGroup}>
              <label>{t('importViewer.status', 'Status')}</label>
              <select
                value={searchFilters.status || ''}
                onChange={(e) => setSearchFilters(prev => ({...prev, status: e.target.value}))}
              >
                <option value="">{t('importViewer.allStatuses', 'All Statuses')}</option>
                <option value="completed">{t('importViewer.completed', 'Completed')}</option>
                <option value="error">{t('importViewer.error', 'Error')}</option>
                <option value="counting">{t('importViewer.counting', 'Counting')}</option>
                <option value="paused">{t('importViewer.paused', 'Paused')}</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>{t('importViewer.errorFilter', 'Error Filter')}</label>
              <select
                value={searchFilters.hasError === undefined ? '' : String(searchFilters.hasError)}
                onChange={(e) => setSearchFilters(prev => ({
                  ...prev, 
                  hasError: e.target.value === '' ? undefined : e.target.value === 'true'
                }))}
              >
                <option value="">{t('importViewer.allRecords', 'All Records')}</option>
                <option value="true">{t('importViewer.withErrors', 'With Errors')}</option>
                <option value="false">{t('importViewer.withoutErrors', 'Without Errors')}</option>
              </select>
            </div>
          </div>

          <div className={styles.searchActions}>
            <button className={styles.searchBtn} onClick={performSearch}>
              🔍 {t('importViewer.search', 'Search')}
            </button>
            <button className={styles.clearBtn} onClick={clearSearch}>
              🗑️ {t('importViewer.clear', 'Clear')}
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className={styles.viewerContent}>
        {/* 左侧Session列表 */}
        <div className={styles.sessionsPanel}>
          <div className={styles.panelHeader}>
            <h3>{t('importViewer.sessionList', 'Session List')}</h3>
            
            {/* 排序控制 */}
            <div className={styles.sortControls}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.sortSelect}
              >
                <option value="timestamp">{t('importViewer.sortByTime', 'Sort by Time')}</option>
                <option value="sessionNo">{t('importViewer.sortBySessionNo', 'Sort by Session No')}</option>
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

          <div className={styles.sessionsList}>
            {sortedData.length === 0 ? (
              <div className={styles.noData}>
                <div className={styles.noDataIcon}>📭</div>
                <div className={styles.noDataText}>
                  {t('importViewer.noSessionsLoaded', 'No sessions loaded')}
                </div>
                <div className={styles.noDataHint}>
                  {t('importViewer.importHint', 'Click Import to load data')}
                </div>
              </div>
            ) : (
              sortedData.map((session) => {
                const statusInfo = getSessionDisplayStatus(session);
                const isSelected = selectedSession?.id === session.id;
                
                return (
                  <div
                    key={session.id}
                    className={`${styles.sessionItem} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div className={styles.sessionHeader}>
                      <div className={styles.sessionNo}>
                        #{session.no}
                      </div>
                      <div className={`${styles.sessionStatus} ${styles[statusInfo.class]}`}>
                        {statusInfo.text}
                      </div>
                    </div>
                    
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionTime}>
                        📅 {new Date(session.startTime).toLocaleString()}
                      </div>
                      <div className={styles.sessionCurrency}>
                        💱 {session.currencyCode || 'N/A'}
                      </div>
                    </div>
                    
                    <div className={styles.sessionStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>{t('importViewer.count', 'Count')}:</span>
                        <span className={styles.statValue}>{session.totalCount}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>{t('importViewer.amount', 'Amount')}:</span>
                        <span className={styles.statValue}>
                          {formatCurrency(session.totalAmount || 0, session.currencyCode)}
                        </span>
                      </div>
                      {(session.errorCount || 0) > 0 && (
                        <div className={`${styles.statItem} ${styles.error}`}>
                          <span className={styles.statLabel}>{t('importViewer.errors', 'Errors')}:</span>
                          <span className={styles.statValue}>{session.errorCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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

              <div className={styles.detailsContent}>
                {(() => {
                  // 获取要显示的details：如果有搜索过滤，显示过滤后的；否则显示全部
                  const detailsToShow = showSearchResults && filteredDetails.has(selectedSession.id) 
                    ? filteredDetails.get(selectedSession.id) 
                    : selectedSession.details;
                  
                  return detailsToShow && detailsToShow.length > 0 ? (
                    <div className={styles.detailsTable}>
                      <div className={styles.tableHeader}>
                        <div className={styles.colNo}>{t('importViewer.tableNo', 'No.')}</div>
                        <div className={styles.colTime}>{t('importViewer.tableTime', 'Time')}</div>
                        <div className={styles.colCurrency}>{t('importViewer.tableCurrency', 'Currency')}</div>
                        <div className={styles.colDenomination}>{t('importViewer.tableDenomination', 'Denomination')}</div>
                        <div className={styles.colSerial}>{t('importViewer.tableSerialNumber', 'Serial Number')}</div>
                        <div className={styles.colStatus}>{t('importViewer.tableStatus', 'Status')}</div>
                        <div className={styles.colError}>{t('importViewer.tableErrorCode', 'Error Code')}</div>
                      </div>
                      
                      <div className={styles.tableContent}>
                        {detailsToShow.map((detail, index) => (
                          <div key={detail.id || index} className={styles.tableRow}>
                            <div className={styles.colNo}>{detail.no}</div>
                            <div className={styles.colTime}>{detail.timestamp}</div>
                            <div className={styles.colCurrency}>{detail.currencyCode}</div>
                            <div className={styles.colDenomination}>
                              {formatCurrency(detail.denomination, detail.currencyCode)}
                            </div>
                            <div className={styles.colSerial} title={detail.serialNumber}>
                              {detail.serialNumber || '-'}
                            </div>
                            <div className={`${styles.colStatus} ${styles['status' + detail.status.charAt(0).toUpperCase() + detail.status.slice(1).toLowerCase()]}`}>
                              {detail.status}
                            </div>
                            <div className={styles.colError}>
                              {detail.errorCode && detail.errorCode !== 'E0' ? detail.errorCode : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
