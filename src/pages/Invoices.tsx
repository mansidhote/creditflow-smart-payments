import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Plus, FileText } from "lucide-react";
import {
  parseCreditTerm,
  calcEAC,
  formatINR,
  getDaysLeft,
  getDaysLeftColor,
  getDaysLeftLabel,
  COMMON_TERMS,
} from "@/lib/creditTerms";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices"> & { suppliers: { name: string } | null };
type Supplier = Tables<"suppliers">;

export default function Invoices() {
  const { user, profile, refreshProfile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState({
    supplier_id: "",
    amount: "",
    terms: "Net 30",
    custom_terms: "",
    invoice_date: new Date().toISOString().split("T")[0],
    notes: "",
    penalty_rate: "",
    penalty_type: "daily",
  });

  const fetchData = async () => {
    if (!user) return;
    const [{ data: inv }, { data: sup }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, suppliers(name)")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),
    ]);
    setInvoices((inv as Invoice[]) || []);
    setSuppliers(sup || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !form.supplier_id || !form.amount) {
      toast.error("Please fill required fields");
      return;
    }
    const terms = form.terms === "Custom" ? form.custom_terms : form.terms;
    const parsed = parseCreditTerm(terms);
    const invoiceDate = new Date(form.invoice_date);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + parsed.netDays);
    let discountDeadline: string | null = null;
    if (parsed.discountPct > 0) {
      const dd = new Date(invoiceDate);
      dd.setDate(dd.getDate() + parsed.discountDays);
      discountDeadline = dd.toISOString().split("T")[0];
    }

    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      supplier_id: form.supplier_id,
      amount: parseFloat(form.amount),
      terms,
      invoice_date: form.invoice_date,
      due_date: dueDate.toISOString().split("T")[0],
      discount_deadline: discountDeadline,
      discount_pct: parsed.discountPct,
      discount_days: parsed.discountDays,
      notes: form.notes || null,
      penalty_rate: form.penalty_rate ? parseFloat(form.penalty_rate) : 0,
      penalty_type: form.penalty_type || "daily",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Auto-insert alerts
    const invRes = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (invRes.data) {
      const alertRows: any[] = [];
      const dueDateObj = dueDate;
      [7, 3, 0].forEach((daysBefore) => {
        const triggerAt = new Date(dueDateObj);
        triggerAt.setDate(triggerAt.getDate() - daysBefore);
        const type =
          daysBefore === 7
            ? "DUE_7_DAYS"
            : daysBefore === 3
              ? "DUE_3_DAYS"
              : "DUE_TODAY";
        alertRows.push({
          user_id: user.id,
          invoice_id: invRes.data.id,
          type,
          trigger_at: triggerAt.toISOString(),
        });
      });
      if (discountDeadline) {
        const dd = new Date(discountDeadline);
        dd.setDate(dd.getDate() - 1);
        alertRows.push({
          user_id: user.id,
          invoice_id: invRes.data.id,
          type: "DISCOUNT_EXPIRING" as const,
          trigger_at: dd.toISOString(),
        });
      }
      await supabase.from("alerts").insert(alertRows);
    }

    toast.success("Invoice created");
    setOpen(false);
    setForm({
      supplier_id: "",
      amount: "",
      terms: "Net 30",
      custom_terms: "",
      invoice_date: new Date().toISOString().split("T")[0],
      notes: "",
      penalty_rate: "",
      penalty_type: "daily",
    });
    fetchData();
  };

  const markAsPaid = async (invoice: Invoice) => {
    if (!user || !profile) return;

    const discountCaptured =
      invoice.discount_deadline && getDaysLeft(invoice.discount_deadline) > 0
        ? (invoice.amount * (invoice.discount_pct || 0)) / 100
        : 0;

    // calculate penalty if overdue
    const daysLeft = getDaysLeft(invoice.due_date);
    let penaltyAmount = 0;
    if (daysLeft < 0 && (invoice.penalty_rate || 0) > 0) {
      const overdue = Math.abs(daysLeft);
      if (invoice.penalty_type === "monthly") {
        const months = Math.ceil(overdue / 30);
        penaltyAmount =
          ((invoice.amount * (invoice.penalty_rate || 0)) / 100) * months;
      } else {
        // daily
        penaltyAmount =
          ((invoice.amount * (invoice.penalty_rate || 0)) / 100) * overdue;
      }
    }
    const totalPaid = invoice.amount - discountCaptured + penaltyAmount;

    if (profile.cash_balance < totalPaid) {
      toast.error(`Insufficient balance. You have ${formatINR(profile.cash_balance)} but need ${formatINR(totalPaid)}.`);
      return;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      user_id: user.id,
      invoice_id: invoice.id,
      amount_paid: invoice.amount - discountCaptured,
      discount_captured: discountCaptured,
    });

    if (paymentError) {
      toast.error("Failed to record payment. Please try again.");
      return;
    }

    await supabase
      .from("invoices")
      .update({ status: "PAID" as const })
      .eq("id", invoice.id);

    await supabase
      .from("profiles")
      .update({
        cash_balance: profile.cash_balance - totalPaid,
      })
      .eq("user_id", user.id);

    await refreshProfile();
    await fetchData();
    toast.success(
      `Paid ${formatINR(Math.round(totalPaid))}${discountCaptured > 0 ? ` (saved ${formatINR(Math.round(discountCaptured))})` : ""}${penaltyAmount > 0 ? ` (including penalty ${formatINR(Math.round(penaltyAmount))})` : ""}`,
    );
  };

  const filtered =
    tab === "all"
      ? invoices
      : tab === "paid"
        ? invoices.filter((i) => i.status === "PAID")
        : tab === "active"
          ? invoices.filter((i) => i.status === "ACTIVE")
          : tab === "due_soon"
            ? invoices.filter((i) => {
                const daysLeftVal = getDaysLeft(i.due_date);
                return (
                  i.status !== "PAID" && daysLeftVal >= 0 && daysLeftVal <= 3
                );
              })
            : tab === "overdue"
              ? invoices.filter(
                  (i) => i.status !== "PAID" && getDaysLeft(i.due_date) < 0,
                )
              : invoices;

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Invoices</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">New Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, supplier_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label>Penalty rate (%)</Label>
                <Input
                  type="number"
                  value={form.penalty_rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, penalty_rate: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Penalty type</Label>
                <Select
                  value={form.penalty_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, penalty_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Credit Terms</Label>
                <Select
                  value={form.terms}
                  onValueChange={(v) => setForm((f) => ({ ...f, terms: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TERMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                    <SelectItem value="Custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {form.terms === "Custom" && (
                  <Input
                    value={form.custom_terms}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, custom_terms: e.target.value }))
                    }
                    placeholder="e.g. 2/10 Net 30"
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoice_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Optional notes"
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Create Invoice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="due_soon">Due Soon</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-heading font-bold text-lg mb-1">
            No invoices found
          </h3>
          <p className="text-sm text-muted-foreground">
            {tab === "all"
              ? "Create your first invoice to start tracking payments"
              : `No ${tab.replace("_", " ")} invoices`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((inv) => {
            const days = getDaysLeft(inv.due_date);
            const eac = calcEAC(
              inv.discount_pct || 0,
              inv.discount_days || 0,
              parseCreditTerm(inv.terms).netDays,
            );
            const discountDays = inv.discount_deadline
              ? getDaysLeft(inv.discount_deadline)
              : null;
            // compute penalty for display
            let penaltyDisplay = 0;
            if (days < 0 && (inv.penalty_rate || 0) > 0) {
              const overdue = Math.abs(days);
              if (inv.penalty_type === "monthly") {
                const months = Math.ceil(overdue / 30);
                penaltyDisplay =
                  ((inv.amount * (inv.penalty_rate || 0)) / 100) * months;
              } else {
                penaltyDisplay =
                  ((inv.amount * (inv.penalty_rate || 0)) / 100) * overdue;
              }
            }
            return (
              <div
                key={inv.id}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{inv.suppliers?.name}</p>
                      {penaltyDisplay > 0 && (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium">
                          Penalty
                        </span>
                      )}
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-2xl font-mono font-bold">
                      {formatINR(inv.amount)}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="bg-muted px-2 py-0.5 rounded font-mono">
                        {inv.terms}
                      </span>
                      <span>
                        Due:{" "}
                        {new Date(inv.due_date).toLocaleDateString("en-IN")}
                      </span>
                      {inv.discount_deadline &&
                        discountDays !== null &&
                        (() => {
                          const discountAmount =
                            (inv.amount * (inv.discount_pct || 0)) / 100;
                          return (
                            <span
                              className={
                                discountDays > 0
                                  ? "text-success"
                                  : "text-critical"
                              }
                            >
                              Discount: {formatINR(Math.round(discountAmount))}{" "}
                              ({inv.discount_pct}%){" "}
                              {discountDays > 0
                                ? `${discountDays}d left`
                                : "Expired"}
                            </span>
                          );
                        })()}
                      {eac !== null && (
                        <span className="text-primary font-mono">
                          EAC: {eac.toFixed(1)}%
                        </span>
                      )}
                      {penaltyDisplay > 0 && (
                        <span className="text-amber-600">
                          Penalty: {formatINR(Math.round(penaltyDisplay))} (
                          {inv.penalty_rate}%/{inv.penalty_type})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-medium text-sm ${getDaysLeftColor(days)}`}
                    >
                      {getDaysLeftLabel(days)}
                    </span>
                    {inv.status !== "PAID" && (
                      <Button size="sm" onClick={() => markAsPaid(inv)}>
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
