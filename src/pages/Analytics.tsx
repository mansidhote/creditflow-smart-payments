import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/creditTerms';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & { suppliers: { name: string } | null };
type Payment = Tables<'payments'>;

export default function Analytics() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('invoices').select('*, suppliers(name)').eq('user_id', user.id),
      supabase.from('payments').select('*').eq('user_id', user.id),
    ]).then(([{ data: inv }, { data: pay }]) => {
      setInvoices((inv as Invoice[]) || []);
      setPayments(pay || []);
      setLoading(false);
    });
  }, [user]);

  // Outstanding by category
  const categoryData = (() => {
    const map: Record<string, number> = {};
    invoices.filter(i => i.status !== 'PAID').forEach(i => {
      // We don't have category on invoice directly, use supplier join if available
      const cat = 'Supplier';
      map[cat] = (map[cat] || 0) + i.amount;
    });
    // Better: group by supplier
    const supplierMap: Record<string, number> = {};
    invoices.filter(i => i.status !== 'PAID').forEach(i => {
      const name = i.suppliers?.name || 'Unknown';
      supplierMap[name] = (supplierMap[name] || 0) + i.amount;
    });
    return Object.entries(supplierMap).map(([name, amount]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, amount })).sort((a, b) => b.amount - a.amount);
  })();

  // Credit terms distribution
  const termsDistribution = (() => {
    const map: Record<string, number> = {};
    invoices.forEach(i => { map[i.terms] = (map[i.terms] || 0) + 1; });
    return Object.entries(map).map(([terms, count]) => ({ terms, count }));
  })();

  // Savings
  const discountsCaptured = payments.reduce((s, p) => s + p.discount_captured, 0);
  const discountsMissed = invoices
    .filter(i => i.status === 'PAID' && i.discount_pct && i.discount_pct > 0)
    .reduce((s, i) => {
      const payment = payments.find(p => p.invoice_id === i.id);
      if (payment && payment.discount_captured === 0) return s + i.amount * (i.discount_pct || 0) / 100;
      return s;
    }, 0);
  const totalDiscountable = discountsCaptured + discountsMissed;
  const captureRate = totalDiscountable > 0 ? (discountsCaptured / totalDiscountable) * 100 : 0;

  // Top suppliers
  const topSuppliers = categoryData.slice(0, 5);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Analytics</h1>

      {/* Savings Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-success/20 rounded-lg p-5">
          <p className="text-xs text-muted-foreground mb-1">Discounts Captured</p>
          <p className="text-2xl font-mono font-bold text-success">{formatINR(discountsCaptured)}</p>
        </div>
        <div className="bg-card border border-critical/20 rounded-lg p-5">
          <p className="text-xs text-muted-foreground mb-1">Discounts Missed</p>
          <p className="text-2xl font-mono font-bold text-critical">{formatINR(discountsMissed)}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-lg p-5">
          <p className="text-xs text-muted-foreground mb-1">Capture Rate</p>
          <p className="text-2xl font-mono font-bold text-primary">{captureRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* Outstanding by Supplier */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-heading font-bold mb-4">Outstanding by Supplier</h3>
        {categoryData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No outstanding invoices</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
                <XAxis type="number" tick={{ fill: 'hsl(220 10% 50%)', fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(220 10% 50%)', fontSize: 11 }} width={120} />
                <Tooltip
                  contentStyle={{ background: 'hsl(220 18% 9%)', border: '1px solid hsl(220 14% 16%)', borderRadius: 8, color: 'hsl(0 0% 93%)' }}
                  formatter={(value: number) => [formatINR(value), 'Outstanding']}
                />
                <Bar dataKey="amount" fill="hsl(145 100% 62% / 0.7)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Terms Distribution */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-heading font-bold mb-4">Credit Terms Distribution</h3>
          {termsDistribution.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {termsDistribution.map(t => (
                <div key={t.terms} className="flex items-center justify-between">
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{t.terms}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(t.count / invoices.length) * 100}%` }} />
                    </div>
                    <span className="text-sm font-mono text-muted-foreground w-8 text-right">{t.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supplier Leaderboard */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-heading font-bold mb-4">Top Suppliers by Outstanding</h3>
          {topSuppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topSuppliers.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-mono font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm">{s.name}</span>
                  </div>
                  <span className="font-mono text-sm font-medium">{formatINR(s.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
