import { z } from 'zod';

export const DatePrecisionSchema = z.enum([
  'exact',
  'year_month',
  'year_only',
  'approximate',
  'before',
  'after',
  'range',
  'estimated',
  'uncertain',
]);

export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

export const DateCertaintySchema = z.enum([
  'certain',
  'probable',
  'possible',
  'estimated',
  'unknown',
]);

export type DateCertainty = z.infer<typeof DateCertaintySchema>;

export const DateCalendarSchema = z.enum([
  'gregorian',
  'julian',
  'hebrew',
  'french_republican',
  'other',
]);

export type DateCalendar = z.infer<typeof DateCalendarSchema>;

export const DateValueSchema = z.strictObject({
  precision: DatePrecisionSchema,
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  end_year: z.number().int().optional(),
  end_month: z.number().int().min(1).max(12).optional(),
  end_day: z.number().int().min(1).max(31).optional(),
  certainty: DateCertaintySchema.optional(),
  calendar: DateCalendarSchema.default('gregorian').optional(),
  original_text: z.string().optional(),
  normalized_sort_date: z.string().optional(),
  notes: z.string().optional(),
});

export type DateValue = z.infer<typeof DateValueSchema>;

const MONTH_NAMES = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDate(date?: DateValue | null): string {
  if (!date) return '';
  if (date.original_text) {
    if (date.precision === 'exact' && date.year) {
      // Return formatted with original text hint if available
    }
  }

  const pad = (n?: number) => (n ? String(n).padStart(2, '0') : '');
  const formatYMD = (y?: number, m?: number, d?: number) => {
    if (!y) return '';
    if (m && d) return `${d} ${MONTH_NAMES[m]} ${y}`;
    if (m) return `${MONTH_NAMES[m]} ${y}`;
    return String(y);
  };

  const primary = formatYMD(date.year, date.month, date.day);
  const end = formatYMD(date.end_year, date.end_month, date.end_day);

  switch (date.precision) {
    case 'exact':
    case 'year_month':
    case 'year_only':
      return primary || date.original_text || '';
    case 'approximate':
      return `abt. ${primary || date.original_text || ''}`.trim();
    case 'estimated':
      return `est. ${primary || date.original_text || ''}`.trim();
    case 'uncertain':
      return `poss. ${primary || date.original_text || ''}`.trim();
    case 'before':
      return `before ${primary || date.original_text || ''}`.trim();
    case 'after':
      return `after ${primary || date.original_text || ''}`.trim();
    case 'range':
      return primary && end ? `between ${primary} and ${end}` : primary || end || '';
    default:
      return date.original_text || primary || '';
  }
}

export function getDateSortKey(date?: DateValue | null): string {
  if (!date || !date.year) return '9999-99-99';
  const y = String(date.year).padStart(4, '0');
  const m = String(date.month || 1).padStart(2, '0');
  const d = String(date.day || 1).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getApproximateYear(date?: DateValue | null): number | null {
  if (!date) return null;
  if (date.year) return date.year;
  if (date.end_year) return date.end_year;
  if (date.original_text) {
    const match = date.original_text.match(/\b(1\d{3}|20\d{2})\b/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}
