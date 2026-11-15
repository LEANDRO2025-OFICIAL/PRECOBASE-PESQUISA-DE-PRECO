"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FolderSearch,
  LayoutDashboard,
  LogOut,
  Newspaper,
  PackageSearch,
  Plus,
  Search,
  Settings2,
  Zap,
} from "lucide-react";
import { logoutAction } from "@/app/(app)/actions";
import { iniciais } from "@/lib/format";

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number };

const ICONS = {
  painel: <LayoutDashboard />,
  cestas: <FolderSearch />,
  rapida: <Zap />,
  produtos: <PackageSearch />,
  fornecedores: <Building2 />,
  informativos: <Newspaper />,
  config: <Settings2 />,
};

export function AppShell({
  user,
  tenant,
  cestasAtivas,
  children,
}: {
  user: { nome: string; papel: string };
  tenant: { nome: string; municipio: string | null; uf: string | null; plano: string };
  cestasAtivas: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const groups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: "Visão geral",
      items: [{ href: "/", label: "Painel", icon: ICONS.painel }],
    },
    {
      title: "Pesquisa de preços",
      items: [
        { href: "/cestas", label: "Cestas de preços", icon: ICONS.cestas, badge: cestasAtivas },
        { href: "/pesquisa-rapida", label: "Pesquisa rápida", icon: ICONS.rapida },
      ],
    },
    {
      title: "Catálogos",
      items: [
        { href: "/produtos", label: "Produtos", icon: ICONS.produtos },
        { href: "/fornecedores", label: "Fornecedores", icon: ICONS.fornecedores },
      ],
    },
    {
      title: "Conteúdo",
      items: [
        { href: "/informativos", label: "Informativos", icon: ICONS.informativos },
        { href: "/configuracoes", label: "Configurações", icon: ICONS.config },
      ],
    },
  ];

  const ativo = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const atual =
    groups
      .flatMap((g) => g.items)
      .filter((i) => ativo(i.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "Painel";

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand" style={{ textDecoration: "none" }}>
          <span className="brand-mark">P</span>
          <div>
            <div className="brand-name">PreçoBase</div>
            <div className="brand-tag">Pesquisa de preços</div>
          </div>
        </Link>

        <nav className="nav">
          {groups.map((grupo) => (
            <div className="nav-group" key={grupo.title}>
              <div className="nav-title">{grupo.title}</div>
              {grupo.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  aria-current={ativo(item.href) ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="nav-foot">
          <div className="tenant-chip">
            <div className="avatar">{iniciais(user.nome)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="tenant-name truncate" title={tenant.nome}>
                {tenant.nome}
              </div>
              <div className="tenant-role">
                {user.nome.split(" ")[0]} · {user.papel}
              </div>
            </div>
            <form action={logoutAction} style={{ marginLeft: "auto" }}>
              <button className="btn-icon" type="submit" title="Sair" aria-label="Sair" style={{ color: "#7f9a94" }}>
                <LogOut />
              </button>
            </form>
          </div>
          <div className="sidebar-version">
            <span>v1.0 · Lei 14.133/2021</span>
            <span>{tenant.plano}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            PreçoBase <span style={{ color: "var(--line-strong)" }}>/</span> <strong>{atual}</strong>
          </div>
          <div className="topbar-actions">
            <Link href="/pesquisa-rapida" className="btn btn-ghost btn-sm">
              <Search />
              Pesquisa rápida
            </Link>
            <Link href="/cestas/nova" className="btn btn-primary btn-sm">
              <Plus />
              Nova cesta
            </Link>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
