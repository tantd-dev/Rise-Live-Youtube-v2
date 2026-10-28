"use client";
// Khung ứng dụng (ProLayout): menu dọc bên trái, mỗi mục là 1 route. Dữ liệu tổng (AppProvider) nằm ở layout
// nên không tải lại khi chuyển trang.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { Alert, Avatar, Badge, Button, Dropdown, Spin, Tooltip } from "antd";
import { LogOut, Moon, Radio, Sun } from "lucide-react";
import { AppProvider, useApp } from "./AppContext";
import { useTheme } from "./Providers";
import { NAV, navFor } from "./nav";
import { ROLE_LABEL } from "@/features/users/types";

function logout() {
  const f = document.createElement("form");
  f.method = "post"; f.action = "/api/auth/logout";
  document.body.appendChild(f); f.submit();
}

function Shell({ children }: { children: ReactNode }) {
  const { data, loadError, can } = useApp();
  const { dark, toggle: toggleTheme } = useTheme();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  // ProLayout đo kích thước màn hình khi dựng → chỉ dựng phía trình duyệt để tránh lệch hydrate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const nav = NAV.filter((n) => can(n.perm));
  const current = navFor(pathname);
  const o = data?.overview;
  const badge = {
    alerts: { n: (o?.alertsCritical ?? 0) + (o?.alertsWarn ?? 0), danger: !!o?.alertsCritical },
    streams: { n: data?.streams.length ?? 0 },
    assets: { n: data?.assets.length ?? 0 },
    machines: { n: data?.machines.length ?? 0 },
  } as Record<string, { n: number; danger?: boolean }>;
  const themeLabel = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";

  if (!mounted) return <div className="center-screen"><Spin size="large" /></div>;
  return (
    <ProLayout
      title="AB Live"
      navTheme={dark ? "realDark" : "light"}
      logo={<Radio size={22} color="#dc2626" />}
      layout="side"
      siderWidth={232}
      contentWidth="Fluid"
      location={{ pathname: current.path }}
      route={{ path: "/", routes: nav.map((n) => ({ path: n.path, name: n.label, icon: n.icon, badge: n.badge })) }}
      menuItemRender={(item, dom) => {
        const b = item.badge ? badge[item.badge as string] : undefined;
        return (
          <Link href={item.path ?? "/"} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{dom}</span>
            {b?.n ? <Badge count={b.n} size="small" overflowCount={999} color={b.danger ? "#dc2626" : "rgba(127,127,127,.35)"} /> : null}
          </Link>
        );
      }}
      onMenuHeaderClick={() => router.push("/")}
      actionsRender={() => [
        <Tooltip key="theme" title={themeLabel}>
          <Button type="text" shape="circle" aria-label={themeLabel} icon={dark ? <Sun size={18} /> : <Moon size={18} />} onClick={toggleTheme} />
        </Tooltip>,
      ]}
      avatarProps={data ? {
        icon: <Avatar style={{ background: "#2563eb" }}>{(data.user.fullName || data.user.email).trim().charAt(0).toUpperCase()}</Avatar>,
        title: data.user.fullName || data.user.email,
        render: (_props, dom) => (
          <Dropdown trigger={["click"]} placement="topLeft" menu={{ items: [
            { key: "me", disabled: true, style: { cursor: "default" }, label: <div style={{ lineHeight: 1.4 }}><div>{data.user.email}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{ROLE_LABEL[data.user.role]}</div></div> },
            { type: "divider" },
            { key: "logout", icon: <LogOut size={14} />, label: "Đăng xuất", onClick: logout },
          ] }}>{dom}</Dropdown>
        ),
      } : undefined}
      token={{ pageContainer: { paddingBlockPageContainerContent: 16, paddingInlinePageContainerContent: 16 } }}
    >
      <PageContainer title={current.label} style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        {loadError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không tải được dữ liệu" description={loadError}
          action={!data && <Button size="small" onClick={() => location.reload()}>Tải lại trang</Button>} />}
        {!data ? (
          <div style={{ padding: 80, textAlign: "center" }}><Spin size="large" /><div style={{ marginTop: 12, opacity: 0.6 }}>Đang tải dữ liệu…</div></div>
        ) : children}
      </PageContainer>
    </ProLayout>
  );
}

export function LiveApp({ children }: { children: ReactNode }) {
  return <AppProvider><Shell>{children}</Shell></AppProvider>;
}
