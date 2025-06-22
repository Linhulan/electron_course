
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
  if (isDenomination) {
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
export const formatDenomination = (denomination: number): string => {
  return formatCurrency(denomination, { isDenomination: true });
};

/**
 * 格式化金额显示（保留小数，带货币符号）
 * @param amount 金额数值
 * @param fractionDigits 小数位数，默认 2
 * @returns 格式化后的金额字符串，如 "¥1,234.56"
 */
export const formatAmount = (amount: number, fractionDigits: number = 2): string => {
  return formatCurrency(amount, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
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
