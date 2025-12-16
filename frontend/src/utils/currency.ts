/**
 * Currency utility for Maldivan Rufiyaa (MVR)
 * Symbol: Rf
 */

interface CurrencySettings {
    symbol: string;
    code: string;
    name: string;
    decimals: number;
}

const DEFAULT_CURRENCY: CurrencySettings = {
    symbol: 'Rf',
    code: 'MVR',
    name: 'Maldivian Rufiyaa',
    decimals: 2
};

/**
 * Get currency settings from localStorage or return default
 */
const getCurrencySettings = (): CurrencySettings => {
    try {
        const stored = localStorage.getItem('currency_settings');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load currency settings:', e);
    }
    return DEFAULT_CURRENCY;
};

/**
 * Save currency settings to localStorage
 */
export const saveCurrencySettings = (settings: CurrencySettings): void => {
    try {
        localStorage.setItem('currency_settings', JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save currency settings:', e);
    }
};

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: from settings)
 * @returns Formatted currency string (e.g., "Rf 100.00")
 */
export const formatCurrency = (amount: number | string | null | undefined, decimals?: number): string => {
    const numAmount = Number(amount || 0);
    const settings = getCurrencySettings();
    const decimalPlaces = decimals !== undefined ? decimals : settings.decimals;
    return `${settings.symbol} ${numAmount.toFixed(decimalPlaces)}`;
};

/**
 * Format currency without symbol (just the number)
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: from settings)
 * @returns Formatted number string (e.g., "100.00")
 */
export const formatAmount = (amount: number | string | null | undefined, decimals?: number): string => {
    const numAmount = Number(amount || 0);
    const settings = getCurrencySettings();
    const decimalPlaces = decimals !== undefined ? decimals : settings.decimals;
    return numAmount.toFixed(decimalPlaces);
};

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (): string => {
    return getCurrencySettings().symbol;
};

/**
 * Get currency code
 */
export const getCurrencyCode = (): string => {
    return getCurrencySettings().code;
};

/**
 * Currency symbol constant (for backward compatibility)
 */
export const CURRENCY_SYMBOL = 'Rf';
