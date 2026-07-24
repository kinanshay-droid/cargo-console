import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PricingRule, PricingRuleInput, PricingUnit, PricingStatus } from "@/lib/pricing-engine.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: PricingRule | null;
  onSubmit: (input: PricingRuleInput) => Promise<void> | void;
  saving?: boolean;
};

const empty: PricingRuleInput = {
  name: "",
  priority: 100,
  currency: "USD",
  base_price: 0,
  unit: "shipment",
  rate: 0,
  minimum_charge: 0,
  fuel_surcharge_pct: 0,
  insurance_pct: 0,
  tax_pct: 0,
  status: "draft",
};

export function PricingRuleForm({ open, onOpenChange, initial, onSubmit, saving }: Props) {
  const [f, setF] = useState<PricingRuleInput>(() => (initial ? { ...(initial as unknown as PricingRuleInput) } : { ...empty }));

  const set = <K extends keyof PricingRuleInput>(k: K, v: PricingRuleInput[K]) => setF((s) => ({ ...s, [k]: v }));

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initial ? "עריכת חוקיות תמחור" : "חוקיות תמחור חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="שם החוק *">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="עדיפות (גבוה יותר = מנצח)">
            <Input type="number" value={f.priority ?? 100} onChange={(e) => set("priority", num(e.target.value))} />
          </Field>
          <Field label="סטטוס">
            <Select value={f.status ?? "draft"} onValueChange={(v) => set("status", v as PricingStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">טיוטה</SelectItem>
                <SelectItem value="published">מפורסם</SelectItem>
                <SelectItem value="archived">בארכיון</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="מטבע">
            <Input value={f.currency ?? "USD"} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
          </Field>

          <div className="col-span-2 mt-2 text-sm font-semibold text-slate-500">בסיס תמחור</div>
          <Field label="יחידה">
            <Select value={f.unit ?? "shipment"} onValueChange={(v) => set("unit", v as PricingUnit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shipment">משלוח</SelectItem>
                <SelectItem value="kg">ק"ג (משקל)</SelectItem>
                <SelectItem value="cbm">CBM (נפח)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="מחיר בסיס"><Input type="number" step="0.01" value={f.base_price ?? 0} onChange={(e) => set("base_price", num(e.target.value))} /></Field>
          <Field label="תעריף ליחידה"><Input type="number" step="0.01" value={f.rate ?? 0} onChange={(e) => set("rate", num(e.target.value))} /></Field>
          <Field label="חיוב מינימום"><Input type="number" step="0.01" value={f.minimum_charge ?? 0} onChange={(e) => set("minimum_charge", num(e.target.value))} /></Field>
          <Field label="דלק (%)"><Input type="number" step="0.01" value={f.fuel_surcharge_pct ?? 0} onChange={(e) => set("fuel_surcharge_pct", num(e.target.value))} /></Field>
          <Field label="ביטוח (%)"><Input type="number" step="0.01" value={f.insurance_pct ?? 0} onChange={(e) => set("insurance_pct", num(e.target.value))} /></Field>
          <Field label="מס (%)"><Input type="number" step="0.01" value={f.tax_pct ?? 0} onChange={(e) => set("tax_pct", num(e.target.value))} /></Field>

          <div className="col-span-2 mt-2 text-sm font-semibold text-slate-500">תנאי התאמה (השאר ריק = תואם הכל)</div>
          <Field label="שירות"><Input value={f.service_type ?? ""} onChange={(e) => set("service_type", e.target.value || null)} /></Field>
          <Field label="טווח טמפרטורה"><Input value={f.temperature_range ?? ""} onChange={(e) => set("temperature_range", e.target.value || null)} /></Field>
          <Field label="אריזה"><Input value={f.packaging ?? ""} onChange={(e) => set("packaging", e.target.value || null)} /></Field>
          <Field label="סוג משלוח"><Input value={f.shipment_type ?? ""} onChange={(e) => set("shipment_type", e.target.value || null)} /></Field>
          <Field label="Incoterm"><Input value={f.incoterm ?? ""} onChange={(e) => set("incoterm", e.target.value || null)} /></Field>
          <Field label="מדינת מוצא"><Input value={f.origin_country ?? ""} onChange={(e) => set("origin_country", e.target.value || null)} /></Field>
          <Field label="מדינת יעד"><Input value={f.destination_country ?? ""} onChange={(e) => set("destination_country", e.target.value || null)} /></Field>
          <Field label="נמל מוצא (IATA)"><Input value={f.origin_airport ?? ""} onChange={(e) => set("origin_airport", e.target.value || null)} /></Field>
          <Field label="נמל יעד (IATA)"><Input value={f.destination_airport ?? ""} onChange={(e) => set("destination_airport", e.target.value || null)} /></Field>
          <Field label="משקל מ־"><Input type="number" value={f.weight_from ?? ""} onChange={(e) => set("weight_from", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="משקל עד"><Input type="number" value={f.weight_to ?? ""} onChange={(e) => set("weight_to", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="תוקף מ־"><Input type="date" value={f.effective_from ?? ""} onChange={(e) => set("effective_from", e.target.value || null)} /></Field>
          <Field label="תוקף עד"><Input type="date" value={f.effective_to ?? ""} onChange={(e) => set("effective_to", e.target.value || null)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button disabled={saving || !f.name} onClick={() => onSubmit(f)}>
            {saving ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
