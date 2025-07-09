import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { SessionData } from '../common/types';
import { formatCurrency, formatDateTime } from '../common/common';
import { useTranslation } from 'react-i18next';
import styles from '../ImportDataViewer.module.css';

interface VirtualSessionListProps {
  sessions: SessionData[];
  selectedSession: SessionData | null;
  onSessionSelect: (session: SessionData) => void;
  height: number;
  getCurrencyDisplay: (session: SessionData) => string;
}

interface SessionItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    sessions: SessionData[];
    selectedSession: SessionData | null;
    onSessionSelect: (session: SessionData) => void;
    getCurrencyDisplay: (session: SessionData) => string;
  };
}

const SessionItem: React.FC<SessionItemProps> = ({ index, style, data }) => {
  const { t } = useTranslation();
  const { sessions, selectedSession, onSessionSelect, getCurrencyDisplay } = data;
  const session = sessions[index];
  const isSelected = selectedSession?.id === session.id;

  return (
    <div style={style}>
      <div style={{ padding: '4px 8px' }}> {/* 添加padding来模拟原来的间距 */}
        <div
          className={`${styles.sessionItem} ${isSelected ? styles.selected : ''}`}
          onClick={() => onSessionSelect(session)}
        >
          <div className={styles.sessionHeader}>
            <div className={styles.sessionNo}>
              #{session.no}
            </div>
            <div className={`${styles.sessionCurrency} ${getCurrencyDisplay(session) === 'MULTI' ? styles.multiCurrency : ''}`}>
              {getCurrencyDisplay(session)}
            </div>
          </div>
          
          <div className={styles.sessionInfo}>
            <div className={styles.sessionTime}>
              📅 {formatDateTime(session.startTime)}
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
                {formatCurrency(session.totalAmount || 0, { currency: session.currencyCode })}
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
      </div>
    </div>
  );
};

export const VirtualSessionList: React.FC<VirtualSessionListProps> = ({
  sessions,
  selectedSession,
  onSessionSelect,
  height,
  getCurrencyDisplay
}) => {
  // 每个Session项目的高度 (根据CSS调整: padding 16px*2 + 内容约60px + margin 8px)
  const { t } = useTranslation();
  const ITEM_HEIGHT = 130;

  const itemData = {
    sessions,
    selectedSession,
    onSessionSelect,
    getCurrencyDisplay
  };

  if (sessions.length === 0) {
    return (
      <div className={styles.noData}>
        <div className={styles.noDataIcon}>📭</div>
        <div className={styles.noDataText}>
          {t('importViewer.noSessionsLoaded', 'No sessions loaded')}
        </div>
        <div className={styles.noDataHint}>
          {t('importViewer.importHint', 'Click Import to load data')}
        </div>
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={sessions.length}
      itemSize={ITEM_HEIGHT}
      itemData={itemData}
      width="100%"
    >
      {SessionItem}
    </List>
  );
};
