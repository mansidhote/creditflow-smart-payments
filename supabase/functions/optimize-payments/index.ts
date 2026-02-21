import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, cashAvailable } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active invoices with supplier names
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*, suppliers(name)")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "DUE_SOON", "OVERDUE"])
      .order("due_date");

    if (error) throw error;
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({
        plan: [], totalSavings: 0, healthScore: 100,
        summary: "No active invoices found. Your payment schedule is clear.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const invoiceDescriptions = invoices.map((inv: any) => {
      const today = new Date();
      const dueDate = new Date(inv.due_date);
      const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return `Invoice ${inv.id}: Supplier="${inv.suppliers?.name}", Amount=₹${inv.amount}, Terms="${inv.terms}", DueDate=${inv.due_date}, DaysLeft=${daysLeft}, DiscountPct=${inv.discount_pct || 0}%, DiscountDays=${inv.discount_days || 0}, DiscountDeadline=${inv.discount_deadline || "none"}, Status=${inv.status}`;
    }).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a financial advisor for small businesses in India.
Analyze the supplier invoices provided and recommend an optimal payment order to:
1. Avoid late payments and penalties (highest priority)
2. Capture early payment discounts (calculate ROI using EAC formula)
3. Preserve working capital by deferring low-urgency payments

EAC formula: (discountPct / (100 - discountPct)) * (365 / (netDays - discountDays)) * 100

Respond ONLY in valid JSON with this exact structure:
{
  "plan": [
    {
      "invoiceId": "string",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "action": "PAY_NOW" | "PAY_THIS_WEEK" | "DEFER",
      "reason": "one sentence plain English",
      "discountSaving": number,
      "eac": number or null
    }
  ],
  "totalSavings": number,
  "healthScore": number between 0-100,
  "summary": "2-3 sentence plain English business digest"
}`;

    const userPrompt = `Available cash: ₹${cashAvailable}\n\nInvoices:\n${invoiceDescriptions}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Enrich plan with supplier names and amounts
    const enrichedPlan = (parsed.plan || []).map((item: any) => {
      const invoice = invoices.find((inv: any) => inv.id === item.invoiceId);
      return {
        ...item,
        supplierName: invoice?.suppliers?.name || "Unknown",
        amount: invoice?.amount || 0,
      };
    });

    return new Response(JSON.stringify({
      ...parsed,
      plan: enrichedPlan,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("optimize-payments error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
