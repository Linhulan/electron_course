import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { CounterData } from '../common/types';
import { formatCurrency } from '../common/common';
import { useTranslation } from 'react-i18next';
import styles from '../ImportDataViewer.module.css';
import { HighlightText } from './HighlightText';

interface VirtualDetailTableProps {
  details: CounterData[];
  height: number;
  isErrorRow: (detail: CounterData) => boolean;
  searchTerm?: string; // 添加搜索词参数
}

interface DetailRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    details: CounterData[];
    isErrorRow: (detail: CounterData) => boolean;
    searchTerm?: string; // 添加搜索词参数
  };
}

const DetailRow: React.FC<DetailRowProps> = ({ index, style, data }) => {
  const { details, isErrorRow, searchTerm } = data;
  const detail = details[index];
  const hasError = isErrorRow(detail);
  const rowClassName = hasError 
    ? `${styles.tableRow} ${styles.tableRowError}` 
    : styles.tableRow;

  return (
    <div style={style}>
      <div className={rowClassName}>
        <div className={styles.colNo}>{detail.no}</div>
        <div className={styles.colCurrency}>{detail.currencyCode}</div>
        <div className={styles.colDenomination}>
          {formatCurrency(detail.denomination, { currency: detail.currencyCode })}
        </div>
        <div className={styles.colSerial} title={detail.serialNumber}>
          <HighlightText 
            text={detail.serialNumber || '-'} 
            searchTerm={searchTerm || ''} 
          />
        </div>
        <div className={styles.colError}>
          {detail.errorCode && detail.errorCode !== 'E0' ? detail.errorCode : '-'}
        </div>
      </div>
    </div>
  );
};

export const VirtualDetailTable: React.FC<VirtualDetailTableProps> = ({
  details,
  height,
  isErrorRow,
  searchTerm
}) => {
  const { t } = useTranslation();
  
  // 每行的高度 (根据CSS调整: padding: 12px 16px + border)
  const ROW_HEIGHT = 43;

  const itemData = {
    details,
    isErrorRow,
    searchTerm
  };

  if (details.length === 0) {
    return (
      <div className={styles.noDetails}>
        <div className={styles.noDetailsIcon}>📄</div>
        <div className={styles.noDetailsText}>
          {t('importViewer.noDetails', 'No detail records found')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailsTable}>
      {/* 表头 */}
      <div className={styles.tableHeader}>
        <div className={styles.colNo}>{t('importViewer.tableNo', 'No.')}</div>
        <div className={styles.colCurrency}>{t('importViewer.tableCurrency', 'Currency')}</div>
        <div className={styles.colDenomination}>{t('importViewer.tableDenomination', 'Denomination')}</div>
        <div className={styles.colSerial}>{t('importViewer.tableSerialNumber', 'Serial Number')}</div>
        <div className={styles.colError}>{t('importViewer.tableErrorCode', 'Error Code')}</div>
      </div>
      
      {/* 虚拟滚动内容 */}
      <div className={styles.tableContent}>
        <List
          height={height}
          itemCount={details.length}
          itemSize={ROW_HEIGHT}
          itemData={itemData}
          width="100%"
        >
          {DetailRow}
        </List>
      </div>
    </div>
  );
};
