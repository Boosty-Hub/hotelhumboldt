import { redirect } from "next/navigation";

// Deep-link de compatibilidad: /pipeline/[id] → /pipeline?op=[id]
// (el detalle de oportunidad vive en el Sheet del tablero)
export default async function PipelineOpportunityRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pipeline?op=${id}`);
}
