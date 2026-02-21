import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'critical';
}

const variantStyles = {
  default: 'border-border',
  success: 'border-success/30',
  warning: 'border-warning/30',
  critical: 'border-critical/30',
};

const iconStyles = {
  default: 'bg-muted text-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-critical/10 text-critical',
};

export default function KPICard({ title, value, subtitle, icon, variant = 'default' }: KPICardProps) {
  return (
    <div className={cn('bg-card border rounded-lg p-5', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-mono font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg', iconStyles[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
