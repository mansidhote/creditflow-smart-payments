import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { SUPPLIER_CATEGORIES } from '@/lib/creditTerms';
import type { Tables } from '@/integrations/supabase/types';

type Supplier = Tables<'suppliers'>;

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<(Supplier & { invoice_count: number; total_outstanding: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Other' as string, contact_phone: '', contact_email: '' });

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data: suppData } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('name');
    const { data: invData } = await supabase.from('invoices').select('supplier_id, amount, status').eq('user_id', user.id);

    const enriched = (suppData || []).map(s => {
      const supplierInvoices = (invData || []).filter(i => i.supplier_id === s.id);
      return {
        ...s,
        invoice_count: supplierInvoices.filter(i => i.status !== 'PAID').length,
        total_outstanding: supplierInvoices.filter(i => i.status !== 'PAID').reduce((sum, i) => sum + i.amount, 0),
      };
    });
    setSuppliers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, [user]);

  const handleSave = async () => {
    if (!user || !form.name.trim()) { toast.error('Supplier name is required'); return; }
    if (editing) {
      await supabase.from('suppliers').update({
        name: form.name, category: form.category as any,
        contact_phone: form.contact_phone || null, contact_email: form.contact_email || null,
      }).eq('id', editing.id);
      toast.success('Supplier updated');
    } else {
      await supabase.from('suppliers').insert({
        user_id: user.id, name: form.name, category: form.category as any,
        contact_phone: form.contact_phone || null, contact_email: form.contact_email || null,
      });
      toast.success('Supplier added');
    }
    setOpen(false);
    setEditing(null);
    setForm({ name: '', category: 'Other', contact_phone: '', contact_email: '' });
    fetchSuppliers();
  };

  const handleEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, category: s.category, contact_phone: s.contact_phone || '', contact_email: s.contact_email || '' });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    toast.success('Supplier deleted');
    fetchSuppliers();
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Suppliers</h1>
        <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: '', category: 'Other', contact_phone: '', contact_email: '' }); } }}>
          <SheetTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Supplier</Button>
          </SheetTrigger>
          <SheetContent className="bg-card">
            <SheetHeader>
              <SheetTitle className="font-heading">{editing ? 'Edit' : 'Add'} Supplier</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier name" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPLIER_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="info@supplier.in" />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add'} Supplier</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-heading font-bold text-lg mb-1">No suppliers yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your first supplier to start tracking invoices</p>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Supplier</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-right p-3">Active Invoices</th>
                  <th className="text-right p-3">Outstanding</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-sm font-medium">{s.name}</td>
                    <td className="p-3"><StatusBadge status={s.category} /></td>
                    <td className="p-3 text-sm text-right font-mono">{s.invoice_count}</td>
                    <td className="p-3 text-sm text-right font-mono">{s.total_outstanding.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-critical" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
