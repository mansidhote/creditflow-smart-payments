import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BUSINESS_TYPES } from '@/lib/creditTerms';
import { Zap } from 'lucide-react';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', businessName: '',
    businessType: 'Other' as string, cashBalance: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.fullName || !form.businessName) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    const { error } = await signUp(form.email, form.password, {
      full_name: form.fullName,
      business_name: form.businessName,
      business_type: form.businessType,
      cash_balance: form.cashBalance || '0',
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-heading font-bold text-gradient">CreditFlow</h1>
          </div>
          <p className="text-muted-foreground">Create your business account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg border border-border">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Rajesh Kumar" />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="rajesh@business.com" />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>Business Name *</Label>
            <Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Kumar Enterprises" />
          </div>
          <div className="space-y-2">
            <Label>Business Type</Label>
            <Select value={form.businessType} onValueChange={v => setForm(f => ({ ...f, businessType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Current Cash Balance (₹)</Label>
            <Input type="number" value={form.cashBalance} onChange={e => setForm(f => ({ ...f, cashBalance: e.target.value }))} placeholder="150000" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
