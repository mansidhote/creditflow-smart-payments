export interface ParsedTerm {
  netDays: number;
  discountDays: number;
  discountPct: number;
}

export function parseCreditTerm(terms: string): ParsedTerm {
  // Match "2/10 Net 30" style
  const discountMatch = terms.match(/(\d+(?:\.\d+)?)\/(\d+)\s+Net\s+(\d+)/i);
  if (discountMatch) {
    return {
      discountPct: parseFloat(discountMatch[1]),
      discountDays: parseInt(discountMatch[2]),
      netDays: parseInt(discountMatch[3]),
    };
  }

  // Match "Net 30" style
  const netMatch = terms.match(/Net\s+(\d+)/i);
  if (netMatch) {
    return {
      netDays: parseInt(netMatch[1]),
      discountDays: 0,
      discountPct: 0,
    };
  }

  return { netDays: 30, discountDays: 0, discountPct: 0 };
}

export function calcEAC(discountPct: number, discountDays: number, netDays: number): number | null {
  if (discountPct <= 0 || netDays <= discountDays) return null;
  return (discountPct / (100 - discountPct)) * (365 / (netDays - discountDays)) * 100;
}

export function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function getDaysLeft(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysLeftColor(days: number): string {
  if (days <= 0) return 'text-critical';
  if (days <= 3) return 'text-warning';
  return 'text-success';
}

export function getDaysLeftLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Today';
  return `${days} days`;
}

export const COMMON_TERMS = [
  'Net 30',
  'Net 45',
  'Net 60',
  '2/10 Net 30',
  '3/10 Net 30',
  '2/10 Net 45',
  '3/15 Net 45',
];

export const SUPPLIER_CATEGORIES = [
  'Raw Materials',
  'Packaging',
  'Electronics',
  'Textiles',
  'Chemicals',
  'Food & Agri',
  'Machinery',
  'Other',
] as const;

export const BUSINESS_TYPES = [
  'Wholesale',
  'Retail',
  'Manufacturing',
  'Distribution',
  'Other',
] as const;
