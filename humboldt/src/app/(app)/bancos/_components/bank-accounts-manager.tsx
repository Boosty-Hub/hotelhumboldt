"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Landmark, Plus, Pencil, Power, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BANK_ACCOUNT_TYPES,
  BANK_ACCOUNT_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  CURRENCY_METHODS,
  type BankAccountType,
  type PaymentMethod,
} from "@/lib/constants";
import { createBankAccount, updateBankAccount, toggleBankAccountActive } from "../actions";

export interface AccountRow {
  id: string;
  name: string;
  bank: string | null;
  accountNumber: string | null;
  phone: string | null;
  documentId: string | null;
  currency: string;
  methods: string[];
  type: string;
  active: boolean;
  movimientos: number;
  pendientes: number;
}

type FormState = {
  id?: string;
  name: string;
  bank: string;
  accountNumber: string;
  phone: string;
  documentId: string;
  currency: "BS" | "USD";
  methods: PaymentMethod[];
  type: BankAccountType;
};

const EMPTY: FormState = {
  name: "",
  bank: "",
  accountNumber: "",
  phone: "",
  documentId: "",
  currency: "BS",
  methods: [],
  type: "BANCO",
};

export function BankAccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(a: AccountRow) {
    setForm({
      id: a.id,
      name: a.name,
      bank: a.bank ?? "",
      accountNumber: a.accountNumber ?? "",
      phone: a.phone ?? "",
      documentId: a.documentId ?? "",
      currency: a.currency === "USD" ? "USD" : "BS",
      methods: a.methods.filter((m): m is PaymentMethod =>
        (PAYMENT_METHODS as readonly string[]).includes(m)
      ),
      type: (BANK_ACCOUNT_TYPES as readonly string[]).includes(a.type)
        ? (a.type as BankAccountType)
        : "BANCO",
    });
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.methods.length === 0) {
      toast.error("Elegí al menos un método de pago para el banco.");
      return;
    }
    startTransition(async () => {
      const esBanco = form.type === "BANCO";
      const payload = {
        name: form.name,
        bank: form.bank,
        accountNumber: form.accountNumber,
        // El pago móvil solo aplica a cuentas bancarias.
        phone: esBanco ? form.phone : "",
        documentId: esBanco ? form.documentId : "",
        currency: form.currency,
        methods: form.methods,
        type: form.type,
      };
      const res = form.id
        ? await updateBankAccount({ id: form.id, ...payload })
        : await createBankAccount(payload);
      if (res.ok) {
        toast.success(res.message ?? "Guardado.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggle(a: AccountRow) {
    startTransition(async () => {
      const res = await toggleBankAccountActive({ id: a.id, active: !a.active });
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuentas de recepción</CardTitle>
        <CardDescription>
          Dónde recibís los pagos: bancos (transferencia / pago móvil), Zelle y cajas de efectivo.
          Cada pago se asocia a una cuenta para poder conciliar.
        </CardDescription>
        <CardAction>
          <Button onClick={openNew}>
            <Plus data-icon="inline-start" />
            Nueva cuenta
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay cuentas. Creá la primera con «Nueva cuenta».
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Movimientos</TableHead>
                <TableHead className="text-right">Por conciliar</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} className={a.active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Landmark className="size-4 shrink-0 text-sky-900" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {a.name}
                          {!a.active && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (inactiva)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[a.bank, a.accountNumber, a.phone && `PM ${a.phone}`]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {BANK_ACCOUNT_TYPE_LABELS[a.type as BankAccountType] ?? a.type}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.currency}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.movimientos}</TableCell>
                  <TableCell className="text-right">
                    {a.pendientes > 0 ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                        {a.pendientes}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/bancos/${a.id}`} aria-label={`Conciliar ${a.name}`}>
                          <ListChecks className="size-3.5" />
                          Conciliar
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label="Editar">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggle(a)}
                        disabled={pending}
                        aria-label={a.active ? "Desactivar" : "Activar"}
                      >
                        <Power className={a.active ? "size-3.5" : "size-3.5 text-muted-foreground"} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
            <DialogDescription>
              Definí dónde se reciben los pagos. El alias es lo que verás al registrar un pago.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Alias</Label>
              <Input
                id="acc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej.: Banesco Bs, Zelle Hotel, Caja USD"
                required
                disabled={pending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as BankAccountType }))}
                  disabled={pending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {BANK_ACCOUNT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => {
                    const currency = v as "BS" | "USD";
                    const allowed = CURRENCY_METHODS[currency];
                    setForm((f) => ({
                      ...f,
                      currency,
                      // Al cambiar de moneda, descartá métodos incompatibles.
                      methods: f.methods.filter((m) => allowed.includes(m)),
                    }));
                  }}
                  disabled={pending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BS">Bolívares (Bs)</SelectItem>
                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Métodos de pago que recibe</Label>
              <div className="grid grid-cols-1 gap-1.5 rounded-md border p-2.5 sm:grid-cols-2">
                {CURRENCY_METHODS[form.currency].map((m) => {
                  const checked = form.methods.includes(m);
                  return (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            methods:
                              v === true
                                ? [...f.methods, m]
                                : f.methods.filter((x) => x !== m),
                          }))
                        }
                        disabled={pending}
                      />
                      {PAYMENT_METHOD_LABELS[m]}
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Al registrar un pago a este banco solo aparecerán estos métodos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-bank">Banco (opcional)</Label>
              <Input
                id="acc-bank"
                value={form.bank}
                onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                placeholder="Ej.: Banesco, Mercantil"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-number">
                {form.type === "ZELLE"
                  ? "Correo Zelle (opcional)"
                  : form.type === "EFECTIVO"
                  ? "Referencia (opcional)"
                  : "Nº de cuenta · transferencia (opcional)"}
              </Label>
              <Input
                id="acc-number"
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                placeholder={form.type === "ZELLE" ? "correo@dominio.com" : undefined}
                disabled={pending}
              />
            </div>

            {form.type === "BANCO" && (
              <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Pago móvil
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-phone">Teléfono</Label>
                    <Input
                      id="acc-phone"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="0414-1234567"
                      inputMode="tel"
                      disabled={pending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-doc">Cédula / RIF</Label>
                    <Input
                      id="acc-doc"
                      value={form.documentId}
                      onChange={(e) => setForm((f) => ({ ...f, documentId: e.target.value }))}
                      placeholder="V-12345678 / J-12345678-9"
                      disabled={pending}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {form.id ? "Guardar" : "Crear cuenta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
