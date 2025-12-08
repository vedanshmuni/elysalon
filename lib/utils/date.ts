import { format, parseISO, formatDistance, addDays, startOfDay, endOfDay } from 'date-fns';
import { enIN } from 'date-fns/locale';

/**
 * Format date for display
 */
export function formatDate(date: string | Date, formatStr: string = 'PP'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: enIN });
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'PPp');
}

/**
 * Format time only
 */
export function formatTime(date: string | Date): string {
  return formatDate(date, 'p');
}

/**
 * Relative time (e.g., "2 hours ago")
 */
export function timeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(dateObj, new Date(), { addSuffix: true, locale: enIN });
}

/**
 * Get date range for common periods
 */
export function getDateRange(period: 'today' | 'yesterday' | 'week' | 'month') {
  const now = new Date();

  switch (period) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case 'yesterday':
      return {
        start: startOfDay(addDays(now, -1)),
        end: endOfDay(addDays(now, -1)),
      };
    case 'week':
      return {
        start: startOfDay(addDays(now, -7)),
        end: endOfDay(now),
      };
    case 'month':
      return {
        start: startOfDay(addDays(now, -30)),
        end: endOfDay(now),
      };
  }
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDate(dateObj, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
}
