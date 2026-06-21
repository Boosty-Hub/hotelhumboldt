import { redirect } from "next/navigation";
import { auth, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "../components/users-table";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Gestión de usuarios es exclusiva de ADMIN
  if (!canManageSettings(session.user.role)) redirect("/configuracion/parametros");

  const rows = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      pinHash: true,
    },
  });

  // Nunca enviamos el hash al cliente: lo reducimos a un booleano.
  const users = rows.map(({ pinHash, ...u }) => ({ ...u, hasPin: pinHash !== null }));

  return <UsersTable users={users} currentUserId={session.user.id} />;
}
