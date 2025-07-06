import React, { useMemo } from 'react';
import styles from '../ImportDataViewer.module.css';

interface HighlightTextProps {
  text: string;
  searchTerm: string;
  className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({ text, searchTerm, className }) => {
  const highlightedText = useMemo(() => {
    if (!searchTerm || !text || searchTerm.trim() === '') {
      return <span className={className}>{text || '-'}</span>;
    }

    // 清理搜索词，移除多余空格
    const cleanSearchTerm = searchTerm.trim();
    
    // 转义特殊字符以防止正则表达式错误
    const escapedSearchTerm = cleanSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    try {
      // 使用正则表达式进行不区分大小写的匹配
      const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
      const parts = text.split(regex);

      if (parts.length === 1) {
        // 没有匹配，返回原文本
        return <span className={className}>{text}</span>;
      }

      return (
        <span className={className}>
          {parts.map((part, index) => {
            if (part.toLowerCase() === cleanSearchTerm.toLowerCase()) {
              return (
                <mark key={index} className={styles.highlightMatch}>
                  {part}
                </mark>
              );
            }
            return part;
          })}
        </span>
      );
    } catch (error) {
      // 如果正则表达式出错，返回原文本
      console.warn('HighlightText regex error:', error);
      return <span className={className}>{text}</span>;
    }
  }, [text, searchTerm, className]);

  return highlightedText;
};
