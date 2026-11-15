import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const [tenant, cestasAtivas] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tid } }),
    prisma.cesta.count({
      where: { tenantId: session.tid, status: { in: ["EM_ABERTO", "EM_ANDAMENTO"] } },
    }),
  ]);

  if (!tenant) redirect("/login");

  return (
    <AppShell
      user={{ nome: session.nome, papel: session.papel }}
      tenant={{ nome: tenant.nome, municipio: tenant.municipio, uf: tenant.uf, plano: tenant.plano }}
      cestasAtivas={cestasAtivas}
    >
      {children}
    </AppShell>
  );
}
