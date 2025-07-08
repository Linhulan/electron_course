import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { SessionData } from '../common/types';
import { useTranslation } from 'react-i18next';

interface VirtualCountingRecordsProps {
  sessions: Array<SessionData & {
    displayCurrency: string;
    displayAmount: string;
    formattedCount: string;
    formattedEndDate: string | null;
    hasError: boolean;
  }>;
  height: number; // 保留参数兼容性，但不再使用
  onSessionClick: (sessionId: string) => void;
}

interface RecordItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    sessions: VirtualCountingRecordsProps['sessions'];
    onSessionClick: (sessionId: string) => void;
  };
}

const RecordItem: React.FC<RecordItemProps> = ({ index, style, data }) => {
  const { t } = useTranslation();
  const { sessions, onSessionClick } = data;
  const item = sessions[index];

  return (
    <div style={style}>
      <div style={{ padding: '0px' }}> {/* 添加padding来匹配原始样式 */}
        <div
          className="table-row clickable"
          onClick={() => onSessionClick(item.id)}
          title={t("counter.clickToViewDetails", "Click to view details")}
        >
          <div className="col-time">
            <div className="time-primary">
              {new Date(item.timestamp).toLocaleTimeString()}
            </div>
            {item.endTime && (
              <div className="time-secondary">
                {t("counter.session.date")}: {item.formattedEndDate}
              </div>
            )}
          </div>
          <div className="col-count">
            <div className="count-value">{item.formattedCount}</div>
            <div className="count-unit">{t("counter.detailTable.pcs")}</div>
          </div>
          <div className="col-amount">
            <div className="amount-value">{item.displayAmount}</div>
          </div>
          <div className="col-currency">
            <div
              className="currency-value"
              data-currency={item.displayCurrency}
            >
              {item.displayCurrency}
            </div>
          </div>
          <div className="col-error">
            <div
              className={`error-value ${
                item.hasError ? "has-error" : "no-error"
              }`}
            >
              {item.errorCount || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VirtualCountingRecords: React.FC<VirtualCountingRecordsProps> = ({
  sessions,
  height, // 保留使用传入的height参数
  onSessionClick
}) => {
  const { t } = useTranslation();

  // 每个记录项的高度 (根据CSS调整: 基础高度50px + padding等)
  const ITEM_HEIGHT = 56;
  
  // 表头的固定高度
  const HEADER_HEIGHT = 50;
  
  // 计算虚拟滚动列表的可用高度
  const listHeight = Math.max(200, height - HEADER_HEIGHT); // 最小200px高度

  const itemData = {
    sessions,
    onSessionClick
  };

  if (sessions.length === 0) {
    return (
      <div className="no-data enhanced">
        <div className="no-data-illustration">
          <div className="illustration-circle">
            <span className="no-data-icon">📝</span>
          </div>
          <div className="illustration-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div className="no-data-content">
          <div className="no-data-text">{t("counter.noData.title")}</div>
          <div className="no-data-hint">{t("counter.noData.subtitle")}</div>
          <div className="no-data-suggestion">
            💡{" "}
            {t(
              "counter.noData.suggestion",
              "Connect to serial port and start counting to see records here"
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="virtual-counting-records">
      {/* 表头 - 固定在顶部 */}
      <div className="table-header">
        <div className="col-time">
          <span className="header-icon">🕒</span>
          {t("counter.table.time")}
        </div>
        <div className="col-count">{t("counter.table.count")}</div>
        <div className="col-amount">{t("counter.table.amount")}</div>
        <div className="col-currency">
          {t("counter.table.currency", "Currency")}
        </div>
        <div className="col-error">{t("counter.table.errorPcs")}</div>
      </div>
      
      {/* 虚拟滚动列表 */}
      <div style={{ flex: 1 }}>
        <List
          height={listHeight}
          itemCount={sessions.length}
          itemSize={ITEM_HEIGHT}
          itemData={itemData}
          width="100%"
        >
          {RecordItem}
        </List>
      </div>
    </div>
  );
};
