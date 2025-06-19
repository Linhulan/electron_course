import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
  dropdownDirection?: 'up' | 'down' | 'right';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className = '', 
  compact = false,
  dropdownDirection = 'right'
}) => {const { i18n, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // 点击外部区域关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);    const languages = [
    { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
    { code: 'en-US', label: 'English', flag: '🇺🇸' }
  ];
  
  // 改进的语言检测逻辑
  const getCurrentLanguage = () => {
    const currentLang = i18n.language || 'en-US';
    // 完全匹配
    const exactMatch = languages.find(lang => lang.code === currentLang);
    if (exactMatch) return exactMatch;
    
    // 基础语言匹配 (zh-CN -> zh, en-US -> en)
    const baseLang = currentLang.split('-')[0];
    const baseMatch = languages.find(lang => lang.code.startsWith(baseLang));
    if (baseMatch) return baseMatch;
      // 默认返回英文
    return languages[1];
  };
    const currentLanguage = getCurrentLanguage();
  
  const handleLanguageChange = (langCode: string) => {
    console.log('Changing language to:', langCode);
    try {
      i18n.changeLanguage(langCode);
      setIsExpanded(false); // 选择语言后关闭下拉列表
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };
  
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation(); // 防止事件冒泡
    handleLanguageChange(event.target.value);
  };
  if (compact) {
    return (
      <div className={`language-switcher compact ${className}`}>
        <select
          value={currentLanguage.code}
          onChange={handleSelectChange}
          className="language-select"
          title={t('common.language')}
          onMouseDown={(e) => e.stopPropagation()} // 防止鼠标事件被header拖拽拦截
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.label}
            </option>
          ))}
        </select>
      </div>
    );
  }  return (
    <div className={`language-switcher ${className}`} ref={dropdownRef}>
      <div 
        className="language-switcher-label"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="language-icon">🌐</span>        <span className="language-text">
          {t('common.language')} - {currentLanguage.flag}
        </span>
        <span className={`expand-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>
      
      {isExpanded && (
        <div className={`language-dropdown direction-${dropdownDirection}`}>
          {languages.map(lang => (
            <button
              key={lang.code}
              className={`language-option ${currentLanguage.code === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
              title={lang.label}
            >
              <span className="language-flag">{lang.flag}</span>
              <span className="language-name">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
