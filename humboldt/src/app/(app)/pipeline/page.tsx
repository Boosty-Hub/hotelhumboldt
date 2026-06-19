import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtUsd } from "@/lib/money";
import { PipelineBoard } from "./components/pipeline-board";
import { OPPORTUNITY_INCLUDE } from "./types";

export const metadata = { title: "Pipeline de ventas" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const { op, task } = await searchParams;
  const initialSelectedId = typeof op === "string" ? op : null;
  const initialTaskId = typeof task === "string" ? task : null;

  const [opportunities, users, eventTypes, channels, clients] = await Promise.all([
    prisma.opportunity.findMany({
      include: OPPORTUNITY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.eventTypeOption.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.channelOption.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, legalName: true, brandName: true },
      orderBy: { legalName: "asc" },
    }),
  ]);

  const open = opportunities.filter(
    (o) => o.stage !== "GANADO" && o.stage !== "PERDIDO"
  );
  const openValue = open.reduce((sum, o) => sum + o.estimatedValue, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline de ventas</h1>
        <p className="text-sm text-muted-foreground">
          {open.length} {open.length === 1 ? "oportunidad abierta" : "oportunidades abiertas"} ·{" "}
          {fmtUsd(openValue)} en negociación
        </p>
      </div>

      <PipelineBoard
        opportunities={opportunities}
        users={users}
        eventTypes={eventTypes.map((t) => t.name)}
        channels={channels.map((c) => c.name)}
        clients={clients}
        currentUserId={session?.user?.id ?? ""}
        initialSelectedId={initialSelectedId}
        initialTaskId={initialTaskId}
      />
    </div>
  );
}
