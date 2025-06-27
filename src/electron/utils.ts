import { ipcMain, WebContents, WebFrameMain } from "electron";
import { pathToFileURL } from "url";
import { getUIPath } from "./pathResolver.js";
import getSymbolFromCurrency from 'currency-symbol-map';

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

export function ipcMainHandle<Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: (
    ...args: unknown[]
  ) => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>
) {
  ipcMain.handle(key, (event, ...args) => {
    validateEventFrame(event.senderFrame);
    return handler(...args);
  });
}

export function ipcMainOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: (payload: EventPayloadMapping[Key]) => void
) {
  ipcMain.on(key, (event, payload) => {
    validateEventFrame(event.senderFrame);
    return handler(payload);
  });
}

export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key]
) {
  webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain | null) {
  if (frame === null) {
    return;
  }

  console.log("Frame URL:", frame.url);

  // 开发环境：允许localhost
  if (isDev() && new URL(frame.url).host === "localhost:5123") {
    return;
  }

  // 生产环境：更灵活的文件URL验证
  if (!isDev()) {
    const frameUrl = new URL(frame.url);

    // 必须是file协议
    if (frameUrl.protocol !== "file:") {
      throw new Error("Malicious event: Invalid protocol");
    }

    // 检查路径是否包含预期的文件名
    if (
      frameUrl.pathname.endsWith("/index.html") ||
      frameUrl.pathname.endsWith("/dist-react/index.html")
    ) {
      return;
    }

    // 如果URL完全匹配预期路径也允许
    const expectedUrl = pathToFileURL(getUIPath()).toString();
    console.log("Expected URL:", expectedUrl);
    if (frame.url === expectedUrl) {
      return;
    }

    throw new Error("Malicious event: Invalid frame URL");
  }

  // 开发环境的严格检查
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error("Malicious event");
  }
}

/* 货币格式化接口函数---------------------------------------------------------------- */

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
    currency = "USD",
    locale = "zh-CN",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showCurrencySymbol = true,
    isDenomination = false,
  } = options;

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: showCurrencySymbol ? "currency" : "decimal",
      currency: showCurrencySymbol ? currency : undefined,
      minimumFractionDigits: isDenomination ? 0 : minimumFractionDigits,
      maximumFractionDigits: isDenomination ? 0 : maximumFractionDigits,
    }).format(amount);

    // 某些货币 Intl 可能会格式成 "XXX 123"（不是真正的符号），我们手动处理 fallback
    if (
      showCurrencySymbol &&
      (formatted.includes(currency) || formatted === `${amount}`) // 判断是否没有真实货币符号
    ) {
      const symbol = getSymbolFromCurrency(currency) || currency;
      return `${symbol}${
        isDenomination
          ? amount.toFixed(0)
          : amount.toFixed(maximumFractionDigits)
      }`;
    }

    return formatted;

  } catch (err) {
    // Intl 格式失败时 fallback
    const symbol = getSymbolFromCurrency(currency) || currency;
    return `${symbol}${
      isDenomination ? amount.toFixed(0) : amount.toFixed(maximumFractionDigits)
    }`;
  }
};

/**
 * 格式化面额显示（整数，带货币符号）
 * @param denomination 面额数值
 * @returns 格式化后的面额字符串，如 "¥100"
 */
export const formatDenomination = (
  denomination: number,
  options: CurrencyFormatOptions = {}
): string => {
  return formatCurrency(denomination, { isDenomination: true, ...options });
};

/**
 * 格式化金额显示（保留小数，带货币符号）
 * @param amount 金额数值
 * @param fractionDigits 小数位数，默认 2
 * @returns 格式化后的金额字符串，如 "¥1,234.56"
 */
export const formatAmount = (
  amount: number,
  options: CurrencyFormatOptions = {}
): string => {
  const fractionDigits = 2; // 默认小数位数为2
  options = {
    ...options,
    minimumFractionDigits: options.minimumFractionDigits ?? fractionDigits,
    maximumFractionDigits: options.maximumFractionDigits ?? fractionDigits,
  };
  return formatCurrency(amount, { ...options });
};

/**
 * 格式化数字显示（无货币符号，用于表格等）
 * @param amount 数值
 * @param fractionDigits 小数位数，默认 2
 * @returns 格式化后的数字字符串，如 "1,234.56"
 */
export const formatNumber = (
  amount: number,
  fractionDigits: number = 2
): string => {
  return formatCurrency(amount, {
    showCurrencySymbol: false,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};
