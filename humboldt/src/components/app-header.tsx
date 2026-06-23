import { auth, signOut, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, ChevronDown } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { HeaderRate } from "@/components/header-rate";
import { HeaderNotifications } from "@/components/header-notifications";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;

  const canEdit = canManageSettings(user?.role);

  // Tasa y tareas en paralelo (un solo viaje al pooler en vez de dos seguidos).
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  const [latestRate, latestParallel, dueTasks] = await Promise.all([
    prisma.exchangeRate.findFirst({
      where: { kind: "OFICIAL" },
      orderBy: { date: "desc" },
    }),
    prisma.exchangeRate.findFirst({
      where: { kind: "PARALELA" },
      orderBy: { date: "desc" },
    }),
    user?.id
      ? prisma.task.findMany({
          where: { assigneeId: user.id, status: "PENDIENTE", dueAt: { lte: endToday } },
          orderBy: { dueAt: "asc" },
          take: 50,
          include: {
            opportunity: {
              select: { id: true, client: { select: { legalName: true, brandName: true } } },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const rate = latestRate
    ? { rate: latestRate.rate, date: latestRate.date, source: latestRate.source }
    : null;
  const parallel = latestParallel
    ? { rate: latestParallel.rate, date: latestParallel.date, source: latestParallel.source }
    : null;
  const headerTasks = dueTasks.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    dueAt: t.dueAt,
    opportunityId: t.opportunityId,
    clientName: t.opportunity.client.brandName ?? t.opportunity.client.legalName,
  }));

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background px-6 print:hidden">
      <div className="flex items-center gap-2">
        <HeaderRate rate={rate} parallel={parallel} canEdit={canEdit} />
      </div>
      <div className="flex items-center gap-2">
        <HeaderNotifications tasks={headerTasks} />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-sky-100 text-sky-900 text-xs font-semibold">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-medium">{user?.name ?? "Usuario"}</p>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_LABELS[(user?.role as Role) ?? "EJECUTIVO"]}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <p>{user?.name}</p>
            <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
              className="w-full"
            >
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
