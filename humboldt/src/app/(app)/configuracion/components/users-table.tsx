"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KeyRound, Loader2, LockKeyhole, MoreHorizontal, ShieldOff, UserCog, UserPlus, UserX, UserCheck } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PinInput } from "@/components/pin-input";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import {
  clearUserPinAction,
  createUserAction,
  resetUserPasswordAction,
  setUserPinAction,
  toggleUserActiveAction,
  updateUserRoleAction,
} from "../actions";
import type { SafeUser } from "../types";

const PIN_LENGTH = 4;

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-sky-100 text-sky-800 border-sky-200",
  GERENTE: "bg-violet-100 text-violet-800 border-violet-200",
  EJECUTIVO: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface UsersTableProps {
  users: SafeUser[];
  currentUserId: string;
}

/** Gestión de usuarios (solo ADMIN): crear, rol, contraseña, activar/desactivar. */
export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [pending, startTransition] = useTransition();

  // Diálogos
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<SafeUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<SafeUser | null>(null);
  const [pinTarget, setPinTarget] = useState<SafeUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<SafeUser | null>(null);

  // Formularios
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "EJECUTIVO", password: "" });
  const [newRole, setNewRole] = useState<string>("EJECUTIVO");
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createUserAction(newUser);
      if (res.ok) {
        toast.success(res.message ?? "Usuario creado.");
        setCreateOpen(false);
        setNewUser({ name: "", email: "", role: "EJECUTIVO", password: "" });
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleRoleSave() {
    if (!roleTarget) return;
    startTransition(async () => {
      const res = await updateUserRoleAction({ userId: roleTarget.id, role: newRole });
      if (res.ok) {
        toast.success(res.message ?? "Rol actualizado.");
        setRoleTarget(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordTarget) return;
    startTransition(async () => {
      const res = await resetUserPasswordAction({
        userId: passwordTarget.id,
        password: newPassword,
      });
      if (res.ok) {
        toast.success(res.message ?? "Contraseña restablecida.");
        setPasswordTarget(null);
        setNewPassword("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handlePinSave(e: React.FormEvent) {
    e.preventDefault();
    if (!pinTarget) return;
    startTransition(async () => {
      const res = await setUserPinAction({ userId: pinTarget.id, pin: newPin });
      if (res.ok) {
        toast.success(res.message ?? "PIN configurado.");
        setPinTarget(null);
        setNewPin("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handlePinClear(user: SafeUser) {
    startTransition(async () => {
      const res = await clearUserPinAction({ userId: user.id });
      if (res.ok) toast.success(res.message ?? "PIN eliminado.");
      else toast.error(res.error);
    });
  }

  function handleToggleActive(user: SafeUser, active: boolean) {
    if (!active) {
      setDeactivateTarget(user);
      return;
    }
    startTransition(async () => {
      const res = await toggleUserActiveAction({ userId: user.id, active: true });
      if (res.ok) toast.success(res.message ?? "Usuario activado.");
      else toast.error(res.error);
    });
  }

  function confirmDeactivate() {
    const user = deactivateTarget;
    if (!user) return;
    startTransition(async () => {
      const res = await toggleUserActiveAction({ userId: user.id, active: false });
      if (res.ok) toast.success(res.message ?? "Usuario desactivado.");
      else toast.error(res.error);
      setDeactivateTarget(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios del sistema</CardTitle>
        <CardDescription>
          {users.length} {users.length === 1 ? "usuario" : "usuarios"} — los usuarios inactivos no
          pueden iniciar sesión.
        </CardDescription>
        <CardAction>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Nuevo usuario
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="hidden sm:table-cell">Creado</TableHead>
              <TableHead className="w-10 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id} className={user.active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-950 text-[11px] font-semibold text-white">
                        {initials(user.name)}
                      </div>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {user.name}
                          {isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (tú)
                            </span>
                          )}
                          {user.hasPin && (
                            <span
                              className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium text-emerald-600"
                              title="Tiene PIN de acceso configurado"
                            >
                              <LockKeyhole className="size-3" /> PIN
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ROLE_COLORS[user.role] ?? ROLE_COLORS.EJECUTIVO}
                    >
                      {ROLE_LABELS[user.role as Role] ?? user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.active}
                      disabled={pending || isSelf}
                      onCheckedChange={(checked) => handleToggleActive(user, checked)}
                      aria-label={`Activar o desactivar a ${user.name}`}
                    />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {format(user.createdAt, "d MMM yyyy", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Acciones para ${user.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => {
                            setNewRole(user.role);
                            setRoleTarget(user);
                          }}
                        >
                          <UserCog /> Cambiar rol
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setNewPassword("");
                            setPasswordTarget(user);
                          }}
                        >
                          <KeyRound /> Restablecer contraseña
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setNewPin("");
                            setPinTarget(user);
                          }}
                        >
                          <LockKeyhole /> {user.hasPin ? "Cambiar PIN" : "Configurar PIN"}
                        </DropdownMenuItem>
                        {user.hasPin && (
                          <DropdownMenuItem onSelect={() => handlePinClear(user)}>
                            <ShieldOff /> Quitar PIN
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {user.active ? (
                          <DropdownMenuItem
                            disabled={isSelf}
                            variant="destructive"
                            onSelect={() => setDeactivateTarget(user)}
                          >
                            <UserX /> Desactivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => handleToggleActive(user, true)}>
                            <UserCheck /> Activar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Crear usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              El usuario podrá iniciar sesión con su correo y la contraseña inicial.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nombre completo</Label>
              <Input
                id="new-name"
                value={newUser.name}
                onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                placeholder="María Pérez"
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Correo electrónico</Label>
              <Input
                id="new-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                placeholder="mperez@hotelhumboldt.com"
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={newUser.role}
                onValueChange={(v) => setNewUser((u) => ({ ...u, role: v }))}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Contraseña inicial</Label>
              <Input
                id="new-password"
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Compártela con el usuario; podrá cambiarla luego con un administrador.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cambiar rol */}
      <Dialog open={roleTarget !== null} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar rol</DialogTitle>
            <DialogDescription>
              {roleTarget
                ? `Define el nivel de acceso de ${roleTarget.name}.`
                : "Define el nivel de acceso."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={newRole} onValueChange={setNewRole} disabled={pending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Los administradores gestionan usuarios y configuración; los gerentes ven costos y
              márgenes; los ejecutivos gestionan sus oportunidades.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleRoleSave} disabled={pending}>
              {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Guardar rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restablecer contraseña */}
      <Dialog
        open={passwordTarget !== null}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              {passwordTarget
                ? `Define una nueva contraseña para ${passwordTarget.name}.`
                : "Define una nueva contraseña."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Nueva contraseña</Label>
              <Input
                id="reset-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
                disabled={pending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordTarget(null)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Restablecer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Configurar / cambiar PIN */}
      <Dialog
        open={pinTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPinTarget(null);
            setNewPin("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pinTarget?.hasPin ? "Cambiar PIN" : "Configurar PIN"}</DialogTitle>
            <DialogDescription>
              {pinTarget
                ? `PIN de ${PIN_LENGTH} dígitos para que ${pinTarget.name} inicie sesión rápido.`
                : "Define un PIN de acceso."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePinSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="block text-center">Nuevo PIN</Label>
              <PinInput
                value={newPin}
                onChange={setNewPin}
                length={PIN_LENGTH}
                disabled={pending}
                mask={false}
                autoFocus
              />
              <p className="text-center text-xs text-muted-foreground">
                Evita PINs obvios (1234, 1111, años). Compártelo con el usuario.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPinTarget(null);
                  setNewPin("");
                }}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || newPin.length !== PIN_LENGTH}>
                {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Guardar PIN
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar desactivación */}
      <AlertDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `${deactivateTarget.name} no podrá iniciar sesión hasta que vuelva a ser activado. Sus oportunidades y registros se conservan.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeactivate} disabled={pending}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
