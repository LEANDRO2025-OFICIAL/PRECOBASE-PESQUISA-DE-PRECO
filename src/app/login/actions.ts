"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const tenantIdRaw = String(formData.get("tenantId") ?? "");

  if (!email || !senha) return { error: "Informe o usuário e a senha." };

  const tenantId = Number(tenantIdRaw) || undefined;
  const user = await prisma.user.findFirst({
    where: {
      email,
      ativo: true,
      ...(tenantId ? { tenantId } : {}),
    },
    include: { tenant: true },
  });

  if (!user || !verifyPassword(senha, user.senhaHash)) {
    return { error: "Usuário ou senha inválidos para a instituição selecionada." };
  }
  if (user.tenant.contratoAte && user.tenant.contratoAte < new Date()) {
    return { error: "O contrato da instituição está vencido. Procure o administrador." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { ultimoAcesso: new Date() } });
  await createSession(user.id, user.tenantId, user.nome, user.papel);
  redirect("/cestas");
}
