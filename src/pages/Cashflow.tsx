import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR, getDaysLeft, getDaysLeftColor, getDaysLeftLabel } from '@/lib/creditTerms';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & { suppliers: { name: string } | null };

export default function Cashflow() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('invoices').select('*, suppliers(name)').eq('user_id', user.id).neq('status', 'PAID')
      .order('due_date').then(({ data }) => {
        setInvoices((data as Invoice[]) || []);
        setLoading(false);
      });
  }, [user]);

  // Group by week for chart
  const weeklyData = (() => {
    const today = new Date();
    const weeks: { label: string; amount: number; start: Date }[] = [];
    for (let w = 0; w < 6; w++) {
      const start = new Date(today);
      start.setDate(start.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const weekInvoices = invoices.filter(inv => {
        const due = new Date(inv.due_date);
        return due >= start && due <= end;
      });
      weeks.push({
        label: `Week ${w + 1}`,
        amount: weekInvoices.reduce((s, i) => s + i.amount, 0),
        start,
      });
    }
    return weeks;
  })();

  const deferrals = invoices.filter(i => getDaysLeft(i.due_date) > 30);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Cash Flow</h1>

      {/* Weekly Bar Chart */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-heading font-bold mb-4">Projected Outflows — Next 6 Weeks</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(220 10% 50%)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(220 10% 50%)', fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(220 18% 9%)', border: '1px solid hsl(220 14% 16%)', borderRadius: 8, color: 'hsl(0 0% 93%)' }}
                formatter={(value: number) => [formatINR(value), 'Outflow']}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {weeklyData.map((entry, i) => (
                  <Cell key={i} fill={entry.amount > 100000 ? 'hsl(0 72% 51%)' : 'hsl(145 100% 62% / 0.7)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Calendar */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-heading font-bold">Payment Calendar</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No upcoming payments</div>
        ) : (
          <div className="divide-y divide-border/50">
            {invoices.map(inv => {
              const days = getDaysLeft(inv.due_date);
              return (
                <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${days <= 3 ? 'bg-critical' : days <= 7 ? 'bg-warning' : 'bg-success'}`} />
                    <div>
                      <p className="text-sm font-medium">{inv.suppliers?.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.due_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium text-sm">{formatINR(inv.amount)}</p>
                    <p className={`text-xs font-mono ${getDaysLeftColor(days)}`}>{getDaysLeftLabel(days)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deferral Opportunities */}
      {deferrals.length > 0 && (
        <div className="bg-card border border-info/20 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-bold">Deferral Opportunities</h3>
            <p className="text-xs text-muted-foreground">Invoices with 30+ days remaining — safe to defer</p>
          </div>
          <div className="divide-y divide-border/50">
            {deferrals.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{inv.suppliers?.name}</p>
                  <p className="text-xs text-muted-foreground">{inv.terms} — Due {new Date(inv.due_date).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium text-sm text-info">{formatINR(inv.amount)} freed</p>
                  <p className="text-xs text-muted-foreground">{getDaysLeft(inv.due_date)} days remaining</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
