import i18n from '../i18n';

/**
 * 货币格式化配置选项
 */
export interface CurrencyFormatOptions {
  /** 货币代码，默认 'CNY' */
  currency?: string;
  /** 区域设置，默认 'zh-CN' */
  locale?: string;
  /** 最小小数位数，默认 2 */
  minimumFractionDigits?: number;
  /** 最大小数位数，默认 2 */
  maximumFractionDigits?: number;
  /** 是否显示货币符号，默认 true */
  showCurrencySymbol?: boolean;
  /** 是否为面额格式（如 ¥100），默认 false */
  isDenomination?: boolean;
}

/**
 * 格式化货币显示
 * @param amount 金额数值
 * @param options 格式化选项
 * @returns 格式化后的货币字符串
 * 
 * @example
 * formatCurrency(1234.56) // "¥1,234.56"
 * formatCurrency(100, { isDenomination: true }) // "¥100"
 * formatCurrency(1234.567, { maximumFractionDigits: 3 }) // "¥1,234.567"
 * formatCurrency(1234, { showCurrencySymbol: false }) // "1,234.00"
 */
export const formatCurrency = (
  amount: number, 
  options: CurrencyFormatOptions = {}
): string => {
  const {
    currency = 'USD',
    locale = 'zh-CN',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showCurrencySymbol = true,
    isDenomination = false
  } = options;

  // 面额格式：整数显示，无小数点
  const hasDecimalCurrency = ["KWD", "BHD", "OMR", "BSD"];

  if (isDenomination) 
  {
    if (hasDecimalCurrency.includes(currency)) {
      // 对于某些货币（如科威特第纳尔、巴林第纳尔等），即使是面额也需要保留小数点
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }).format(amount);
    }

    const formatted = new Intl.NumberFormat(locale, {
      style: showCurrencySymbol ? 'currency' : 'decimal',
      currency: showCurrencySymbol ? currency : undefined,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    
    return formatted;
  }

  // 普通金额格式
  const formatted = new Intl.NumberFormat(locale, {
    style: showCurrencySymbol ? 'currency' : 'decimal',
    currency: showCurrencySymbol ? currency : undefined,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);

  return formatted;
};

/**
 * 格式化面额显示（整数，带货币符号）
 * @param denomination 面额数值
 * @returns 格式化后的面额字符串，如 "¥100"
 */
export const formatDenomination = (denomination: number, options: CurrencyFormatOptions = {}): string => {
  return formatCurrency(denomination, { isDenomination: true, ...options });
};

/**
 * 格式化金额显示（保留小数，带货币符号）
 * @param amount 金额数值
 * @param fractionDigits 小数位数，默认 2
 * @returns 格式化后的金额字符串，如 "¥1,234.56"
 */
export const formatAmount = (amount: number, options: CurrencyFormatOptions = {}): string => {
  return formatCurrency(amount, {
    ...options,
    minimumFractionDigits: options.minimumFractionDigits || 2,
    maximumFractionDigits: options.maximumFractionDigits || 2
  });
};

/**
 * 格式化数字显示（无货币符号，用于表格等）
 * @param amount 数值
 * @param fractionDigits 小数位数，默认 2
 * @returns 格式化后的数字字符串，如 "1,234.56"
 */
export const formatNumber = (amount: number, fractionDigits: number = 2): string => {
  return formatCurrency(amount, {
    showCurrencySymbol: false,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};

/**
 * 格式化日期时间，提高可读性，支持i18n
 * @param timestamp 时间戳字符串
 * @returns 格式化后的日期时间字符串，如 "今天 14:30"、"昨天 13:20"、"周一 09:00"
 */
export const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const timeStr = date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  if (recordDate.getTime() === today.getTime()) {
    return `${i18n.t('datetime.today')} ${timeStr}`;
  } else if (recordDate.getTime() === yesterday.getTime()) {
    return `${i18n.t('datetime.yesterday')} ${timeStr}`;
  } else {
    const diffTime = now.getTime() - recordDate.getTime();
    const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
    
    if (diffDays <= 6) {
      const weekdayKeys = [
        'datetime.weekdays.sunday',
        'datetime.weekdays.monday', 
        'datetime.weekdays.tuesday',
        'datetime.weekdays.wednesday',
        'datetime.weekdays.thursday',
        'datetime.weekdays.friday',
        'datetime.weekdays.saturday'
      ];
      return `${i18n.t(weekdayKeys[date.getDay()])} ${timeStr}`;
    } else {
      const monthDay = `${date.getMonth() + 1}-${date.getDate()}`;
      return `${monthDay} ${timeStr}`;
    }
  }
};
