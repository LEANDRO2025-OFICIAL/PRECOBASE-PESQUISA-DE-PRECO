import { requireSession } from "@/lib/auth";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const session = await requireSession();

  return <ConfiguracoesClient session={session} />;
}