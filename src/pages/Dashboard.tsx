import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatINR, getDaysLeft, getDaysLeftColor, getDaysLeftLabel, calcEAC } from '@/lib/creditTerms';
import KPICard from '@/components/KPICard';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertTriangle, IndianRupee, Clock, TrendingDown, Sparkles, Loader2, Zap } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & { suppliers: { name: string } | null };

export default function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchInvoices = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('invoices')
      .select('*, suppliers(name)')
      .eq('user_id', user.id)
      .neq('status', 'PAID')
      .order('due_date', { ascending: true });
    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [user]);

  const totalOutstanding = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPenalties = invoices.reduce((s, i) => {
    const days = getDaysLeft(i.due_date);
    if (days < 0 && (i.penalty_rate || 0) > 0) {
      const overdue = Math.abs(days);
      if (i.penalty_type === 'monthly') {
        const months = Math.ceil(overdue / 30);
        return s + (i.amount * (i.penalty_rate || 0) / 100 * months);
      }
      return s + (i.amount * (i.penalty_rate || 0) / 100 * overdue);
    }
    return s;
  }, 0);
  const urgentPayments = invoices.filter(i => getDaysLeft(i.due_date) <= 3);
  const savingsAvailable = invoices
    .filter(i => i.discount_deadline && getDaysLeft(i.discount_deadline) > 0)
    .reduce((s, i) => s + (i.amount * (i.discount_pct || 0) / 100), 0);
  const missedSavings = invoices
    .filter(i => i.discount_deadline && getDaysLeft(i.discount_deadline) <= 0 && i.status !== 'PAID')
    .reduce((s, i) => s + (i.amount * (i.discount_pct || 0) / 100), 0);

  const discountAlerts = invoices.filter(
    i => i.discount_deadline && getDaysLeft(i.discount_deadline) > 0 && getDaysLeft(i.discount_deadline) <= 3
  );

  const markAsPaid = async (invoice: Invoice) => {
    if (!user) return;
    const discountCaptured = invoice.discount_deadline && getDaysLeft(invoice.discount_deadline) > 0
      ? invoice.amount * (invoice.discount_pct || 0) / 100 : 0;
    // include penalty when paying from dashboard
    const daysLeft = getDaysLeft(invoice.due_date);
    let penaltyAmount = 0;
    if (daysLeft < 0 && (invoice.penalty_rate || 0) > 0) {
      const overdue = Math.abs(daysLeft);
      if (invoice.penalty_type === 'monthly') {
        const months = Math.ceil(overdue / 30);
        penaltyAmount = invoice.amount * (invoice.penalty_rate || 0) / 100 * months;
      } else {
        penaltyAmount = invoice.amount * (invoice.penalty_rate || 0) / 100 * overdue;
      }
    }
    const amountPaid = invoice.amount - discountCaptured + penaltyAmount;

    await supabase.from('payments').insert({
      user_id: user.id, invoice_id: invoice.id,
      amount_paid: amountPaid, discount_captured: discountCaptured,
    });
    await supabase.from('invoices').update({ status: 'PAID' as const }).eq('id', invoice.id);
    toast.success(`Payment recorded: ${formatINR(Math.round(amountPaid))}${discountCaptured > 0 ? ` (saved ${formatINR(Math.round(discountCaptured))})` : ''}${penaltyAmount > 0 ? ` (including penalty ${formatINR(Math.round(penaltyAmount))})` : ''}`);
    fetchInvoices();
  };

  const loadDemoData = async () => {
    if (!user) return;
    setSeeding(true);
    const suppliers = [
      { name: 'Mehta Packaging Solutions', category: 'Packaging' as const },
      { name: 'Sharma Raw Materials Ltd', category: 'Raw Materials' as const },
      { name: 'TechVision Electronics', category: 'Electronics' as const },
      { name: 'Patel Textiles & Fabrics', category: 'Textiles' as const },
      { name: 'GreenChem Industries', category: 'Chemicals' as const },
      { name: 'Agri Fresh Traders', category: 'Food & Agri' as const },
    ];

    const { data: suppliersData } = await supabase.from('suppliers').insert(
      suppliers.map(s => ({ ...s, user_id: user.id, contact_phone: '+91 98765 43210', contact_email: `info@${s.name.split(' ')[0].toLowerCase()}.in` }))
    ).select();

    if (!suppliersData) { setSeeding(false); return; }

    const today = new Date();
    const d = (offset: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date.toISOString().split('T')[0];
    };

    const invoiceData = [
      { supplier_id: suppliersData[0].id, amount: 32000, terms: '2/10 Net 30', invoice_date: d(-25), due_date: d(-25 + 30), discount_deadline: d(-25 + 10), discount_pct: 2, discount_days: 10, status: 'OVERDUE' as const },
      { supplier_id: suppliersData[1].id, amount: 85000, terms: 'Net 30', invoice_date: d(-20), due_date: d(-20 + 30), status: 'DUE_SOON' as const },
      { supplier_id: suppliersData[2].id, amount: 150000, terms: '3/10 Net 30', invoice_date: d(-5), due_date: d(-5 + 30), discount_deadline: d(-5 + 10), discount_pct: 3, discount_days: 10, status: 'ACTIVE' as const },
      { supplier_id: suppliersData[3].id, amount: 45000, terms: 'Net 45', invoice_date: d(-10), due_date: d(-10 + 45), status: 'ACTIVE' as const },
      { supplier_id: suppliersData[4].id, amount: 220000, terms: '2/10 Net 45', invoice_date: d(-3), due_date: d(-3 + 45), discount_deadline: d(-3 + 10), discount_pct: 2, discount_days: 10, status: 'ACTIVE' as const },
      { supplier_id: suppliersData[5].id, amount: 68000, terms: 'Net 60', invoice_date: d(-15), due_date: d(-15 + 60), status: 'ACTIVE' as const },
      { supplier_id: suppliersData[0].id, amount: 18000, terms: 'Net 30', invoice_date: d(-28), due_date: d(-28 + 30), status: 'DUE_SOON' as const },
      { supplier_id: suppliersData[1].id, amount: 95000, terms: '3/15 Net 45', invoice_date: d(-2), due_date: d(-2 + 45), discount_deadline: d(-2 + 15), discount_pct: 3, discount_days: 15, status: 'ACTIVE' as const },
    ];

    await supabase.from('invoices').insert(invoiceData.map(i => ({ ...i, user_id: user.id })));
    await supabase.from('profiles').update({ cash_balance: 150000 }).eq('user_id', user.id);
    await refreshProfile();
    await fetchInvoices();
    setSeeding(false);
    toast.success('Demo data loaded successfully!');
  };

  // Check if user has suppliers
  const [hasSuppliers, setHasSuppliers] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setHasSuppliers((count || 0) > 0));
  }, [user, invoices]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {profile?.full_name || 'User'} — {profile?.business_name}
          </p>
        </div>
        {profile && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Cash Balance</p>
            <p className="text-lg font-mono font-bold text-primary">{formatINR(profile.cash_balance)}</p>
          </div>
        )}
      </div>

      {hasSuppliers === false && (
        <div className="bg-card border border-primary/20 rounded-lg p-6 text-center">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="font-heading font-bold text-lg mb-1">Get Started with Demo Data</h3>
          <p className="text-sm text-muted-foreground mb-4">Load sample suppliers and invoices to explore CreditFlow</p>
          <Button onClick={loadDemoData} disabled={seeding}>
            {seeding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : 'Load Demo Data'}
          </Button>
        </div>
      )}

      {/* Discount alert banner */}
      {discountAlerts.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-warning">
              {discountAlerts.length} discount deadline{discountAlerts.length > 1 ? 's' : ''} expiring within 3 days!
            </p>
            <p className="text-xs text-muted-foreground">
              Potential savings: {formatINR(discountAlerts.reduce((s, i) => s + (i.amount * (i.discount_pct || 0) / 100), 0))}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Outstanding" value={formatINR(totalOutstanding)} icon={<IndianRupee className="h-5 w-5" />} />
        <KPICard title="Urgent Payments" value={String(urgentPayments.length)} subtitle="Due within 3 days" icon={<Clock className="h-5 w-5" />} variant="critical" />
        <KPICard title="Savings Available" value={formatINR(savingsAvailable)} subtitle="Live discount windows" icon={<TrendingDown className="h-5 w-5" />} variant="success" />
        <KPICard title="Missed Savings" value={formatINR(missedSavings)} subtitle="Expired discounts" icon={<AlertTriangle className="h-5 w-5" />} variant="warning" />
        <KPICard title="Estimated Penalties" value={formatINR(totalPenalties)} subtitle="Overdue penalties" icon={<Zap className="h-5 w-5" />} variant="warning" />
      </div>

      {/* AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {urgentPayments.length > 0 && (
          <div className="bg-card border border-critical/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-critical" />
              <p className="text-xs font-medium text-critical">URGENT</p>
            </div>
            <p className="text-sm">
              {urgentPayments.length} payment{urgentPayments.length > 1 ? 's' : ''} due within 3 days totaling {formatINR(urgentPayments.reduce((s, i) => s + i.amount, 0))}. Prioritize these to avoid penalties.
            </p>
          </div>
        )}
        {savingsAvailable > 0 && (
          <div className="bg-card border border-success/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <p className="text-xs font-medium text-success">OPPORTUNITY</p>
            </div>
            <p className="text-sm">
              Pay early to capture {formatINR(savingsAvailable)} in discounts. The annualized return makes this a strong cash deployment.
            </p>
          </div>
        )}
        {invoices.some(i => getDaysLeft(i.due_date) > 30) && (
          <div className="bg-card border border-info/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-info" />
              <p className="text-xs font-medium text-info">DEFERRAL</p>
            </div>
            <p className="text-sm">
              {invoices.filter(i => getDaysLeft(i.due_date) > 30).length} invoices have 30+ days remaining. Defer payments to preserve working capital.
            </p>
          </div>
        )}
      </div>

      {/* Payment Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-heading font-bold">Supplier Payments</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No active invoices. Add suppliers and invoices to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-3">Supplier</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Terms</th>
                  <th className="text-left p-3">Due Date</th>
                  <th className="text-right p-3">Penalty</th>
                  <th className="text-right p-3">Days Left</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const days = getDaysLeft(inv.due_date);
                  return (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm">{inv.suppliers?.name || 'Unknown'}</td>
                      <td className="p-3 text-sm text-right font-mono">{formatINR(inv.amount)}</td>
                      <td className="p-3"><StatusBadge status={inv.terms} /></td>
                      <td className="p-3 text-sm font-mono">{new Date(inv.due_date).toLocaleDateString('en-IN')}</td>
                      {/* penalty column */}
                      {(() => {
                        const daysLocal = getDaysLeft(inv.due_date);
                        let penalty = 0;
                        if (daysLocal < 0 && (inv.penalty_rate || 0) > 0) {
                          const overdue = Math.abs(daysLocal);
                          if (inv.penalty_type === 'monthly') {
                            const months = Math.ceil(overdue / 30);
                            penalty = inv.amount * (inv.penalty_rate || 0) / 100 * months;
                          } else {
                            penalty = inv.amount * (inv.penalty_rate || 0) / 100 * overdue;
                          }
                        }
                        return (
                          <td className={`p-3 text-sm text-right font-mono ${penalty > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {penalty > 0 ? formatINR(Math.round(penalty)) : '—'}
                          </td>
                        );
                      })()}
                      <td className={`p-3 text-sm text-right font-mono font-medium ${getDaysLeftColor(days)}`}>
                        {getDaysLeftLabel(days)}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant={days <= 3 ? 'default' : days <= 7 ? 'secondary' : 'ghost'}
                          onClick={() => markAsPaid(inv)}
                        >
                          {days <= 3 ? 'Pay Now' : days <= 7 ? 'Schedule' : 'Hold'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
