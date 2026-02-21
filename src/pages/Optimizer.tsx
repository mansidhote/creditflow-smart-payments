import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { toast } from 'sonner';
import { Brain, Loader2 } from 'lucide-react';
import { formatINR } from '@/lib/creditTerms';

interface PlanItem {
  invoiceId: string;
  priority: string;
  action: string;
  reason: string;
  discountSaving: number;
  eac: number | null;
  supplierName?: string;
  amount?: number;
}

interface OptimizerResult {
  plan: PlanItem[];
  totalSavings: number;
  healthScore: number;
  summary: string;
}

export default function Optimizer() {
  const { user, profile } = useAuth();
  const [cashAvailable, setCashAvailable] = useState(String(profile?.cash_balance || 0));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);

  const runOptimizer = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-payments', {
        body: { userId: user.id, cashAvailable: parseFloat(cashAvailable) || 0 },
      });
      if (error) throw error;
      setResult(data);
      toast.success('Analysis complete!');
    } catch (e: any) {
      toast.error(e.message || 'Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  const actionColors: Record<string, string> = {
    PAY_NOW: 'text-critical',
    PAY_THIS_WEEK: 'text-warning',
    DEFER: 'text-info',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">AI Payment Optimizer</h1>
        <p className="text-sm text-muted-foreground">Intelligent payment prioritization powered by AI</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label>Available Cash (₹)</Label>
            <Input type="number" value={cashAvailable} onChange={e => setCashAvailable(e.target.value)} className="font-mono" />
          </div>
          <Button onClick={runOptimizer} disabled={loading} className="min-w-[160px]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Brain className="h-4 w-4 mr-2" />Run Optimizer</>}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-card border border-primary/20 rounded-lg p-6">
            <h3 className="font-heading font-bold text-lg mb-2 text-primary">AI Summary</h3>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-5 text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                    strokeDasharray={`${(result.healthScore / 100) * 94.2} 94.2`} strokeLinecap="round" />
                </svg>
                <span className="absolute font-mono font-bold text-lg">{result.healthScore}</span>
              </div>
              <p className="text-xs text-muted-foreground">Health Score</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5 text-center">
              <p className="text-2xl font-mono font-bold text-primary">{formatINR(result.totalSavings)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Potential Savings</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5 text-center">
              <p className="text-2xl font-mono font-bold">{result.plan.filter(p => p.action === 'PAY_NOW').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Immediate Payments</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5 text-center">
              <p className="text-2xl font-mono font-bold">{result.plan.filter(p => p.action === 'DEFER').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Deferrable</p>
            </div>
          </div>

          {/* Payment Plan */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-heading font-bold">Ranked Payment Plan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3">Priority</th>
                    <th className="text-left p-3">Supplier</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-left p-3">Action</th>
                    <th className="text-left p-3">Reason</th>
                    <th className="text-right p-3">Saving</th>
                    <th className="text-right p-3">EAC %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.plan.map((item, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3"><StatusBadge status={item.priority} /></td>
                      <td className="p-3 text-sm">{item.supplierName || '-'}</td>
                      <td className="p-3 text-sm text-right font-mono">{item.amount ? formatINR(item.amount) : '-'}</td>
                      <td className="p-3 text-sm font-mono font-medium">
                        <span className={actionColors[item.action] || ''}>{item.action.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground max-w-xs">{item.reason}</td>
                      <td className="p-3 text-sm text-right font-mono text-success">{item.discountSaving > 0 ? formatINR(item.discountSaving) : '-'}</td>
                      <td className="p-3 text-sm text-right font-mono">{item.eac ? `${item.eac.toFixed(1)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
