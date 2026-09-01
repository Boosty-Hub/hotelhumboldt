"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PinInput } from "@/components/pin-input";
import { Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { loginAction, loginWithPinAction } from "./actions";

const PIN_LENGTH = 4;

export interface PinUser {
  id: string;
  name: string;
}

function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-sky-700" />
      <p className="text-sm font-medium text-muted-foreground">Iniciando sesión…</p>
    </div>
  );
}

export function LoginForm({ pinUsers }: { pinUsers: PinUser[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pinUserId, setPinUserId] = useState("");
  const [pin, setPin] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();

  const busy = pending || redirecting;
  const pinEnabled = pinUsers.length > 0;

  function enterApp() {
    setRedirecting(true);
    router.push(callbackUrl);
    router.refresh();
  }

  function onSubmitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await loginAction(
        form.get("email") as string,
        form.get("password") as string
      );
      if (res?.error) setError(res.error);
      else enterApp();
    });
  }

  function submitPin(value: string) {
    if (!pinUserId) {
      setError("Elegí tu usuario.");
      return;
    }
    if (value.length !== PIN_LENGTH || busy) return;
    setError(null);
    startTransition(async () => {
      const res = await loginWithPinAction(pinUserId, value);
      if (res?.error) {
        setError(res.error);
        setPin("");
      } else {
        enterApp();
      }
    });
  }

  return (
    <>
      {redirecting && <LoadingOverlay />}

      <Tabs
        defaultValue="email"
        onValueChange={() => {
          setError(null);
          setPin("");
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="email">
            <Mail data-icon="inline-start" />
            Correo
          </TabsTrigger>
          <TabsTrigger value="pin">
            <KeyRound data-icon="inline-start" />
            PIN
          </TabsTrigger>
        </TabsList>

        {/* ── Correo + contraseña ── */}
        <TabsContent value="email" className="pt-2">
          <form onSubmit={onSubmitEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nombre@hotelhumboldt.com"
                autoComplete="email"
                disabled={busy}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={busy}
                  required
                  className="pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={busy}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar sesión
            </Button>
          </form>
        </TabsContent>

        {/* ── Usuario + PIN de 4 dígitos ── */}
        <TabsContent value="pin" className="pt-2">
          {pinEnabled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPin(pin);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="pin-user">Usuario</Label>
                <Select
                  value={pinUserId}
                  onValueChange={(v) => {
                    setPinUserId(v);
                    setError(null);
                    setPin("");
                  }}
                  disabled={busy}
                >
                  <SelectTrigger id="pin-user" className="w-full">
                    <SelectValue placeholder="Elegí tu usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {pinUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="block text-center">PIN de acceso</Label>
                <PinInput
                  value={pin}
                  onChange={setPin}
                  length={PIN_LENGTH}
                  disabled={busy || !pinUserId}
                  onComplete={submitPin}
                  mask
                />
                <p className="text-center text-xs text-muted-foreground">
                  Ingresa tu PIN de {PIN_LENGTH} dígitos.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !pinUserId || pin.length !== PIN_LENGTH}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar con PIN
              </Button>
            </form>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay usuarios con PIN configurado. Pídele a un administrador
              que te asigne uno, o entra con tu correo.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <p className="mt-4 text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
