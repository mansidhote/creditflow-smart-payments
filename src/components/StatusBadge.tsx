import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-info/10 text-info border-info/20',
  DUE_SOON: 'bg-warning/10 text-warning border-warning/20',
  OVERDUE: 'bg-critical/10 text-critical border-critical/20',
  PAID: 'bg-success/10 text-success border-success/20',
  CRITICAL: 'bg-critical/10 text-critical border-critical/20',
  HIGH: 'bg-warning/10 text-warning border-warning/20',
  MEDIUM: 'bg-info/10 text-info border-info/20',
  LOW: 'bg-muted text-muted-foreground border-border',
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-mono text-xs', statusColors[status] || '', className)}>
      {status}
    </Badge>
  );
}
