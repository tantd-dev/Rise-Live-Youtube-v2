"use client";
// Khung ứng dụng (ProLayout): menu trên + các tab. Mỗi tab là 1 thành phần của đúng miền nghiệp vụ.
import { useEffect, useState, type ReactNode } from "react";
import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { Alert, Avatar, Badge, Button, Dropdown, Spin, Tooltip } from "antd";
import { Film, LayoutDashboard, LogOut, Radio, ScrollText, Server, Users } from "lucide-react";
import { AppProvider, useApp } from "./AppContext";
import { OverviewTab } from "@/features/dashboard/ui/OverviewTab";
import { StreamsTab } from "@/features/streams/ui/StreamsTab";
import { AssetsTab } from "@/features/assets/ui/AssetsTab";
import { MachinesTab } from "@/features/machines/ui/MachinesTab";
import { IncidentsTab } from "@/features/incidents/ui/IncidentsTab";
import { UsersTab } from "@/features/users/ui/UsersTab";
import { ROLE_LABEL, type Permission } from "@/features/users/types";

const TABS: { id: string; label: string; icon: ReactNode; perm: Permission }[] = [
  { id: "overview", label: "Tổng quan", icon: <LayoutDashboard size={16} />, perm: "view" },
  { id: "streams", label: "Luồng phát", icon: <Radio size={16} />, perm: "view" },
  { id: "assets", label: "Kho video", icon: <Film size={16} />, perm: "view" },
  { id: "machines", label: "Máy phát", icon: <Server size={16} />, perm: "view" },
  { id: "incidents", label: "Nhật ký sự cố", icon: <ScrollText size={16} />, perm: "view" },
  { id: "users", label: "Người dùng", icon: <Users size={16} />, perm: "users.manage" },
];

function logout() {
  const f = document.createElement("form");
  f.method = "post"; f.action = "/api/auth/logout";
  document.body.appendChild(f); f.submit();
}

function Shell() {
  const { data, loadError, can } = useApp();
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    try { const t = localStorage.getItem("rl.tab"); if (t) setTab(t); } catch { /* không có localStorage */ }
  }, []);
  const go = (t: string) => { setTab(t); try { localStorage.setItem("rl.tab", t); } catch { /* bỏ qua */ } };
  const tabs = TABS.filter((t) => can(t.perm));
  const current = tabs.find((t) => t.id === tab) ?? tabs[0] ?? TABS[0];
  const o = data?.overview;
  const badge: Record<string, { n: number; danger?: boolean }> = {
    overview: { n: (o?.alertsCritical ?? 0) + (o?.alertsWarn ?? 0), danger: !!o?.alertsCritical },
    streams: { n: data?.streams.length ?? 0 },
    assets: { n: data?.assets.length ?? 0 },
    machines: { n: data?.machines.length ?? 0 },
  };

  return (
    <ProLayout
      title="AB Live"
      logo={<Radio size={22} color="#dc2626" />}
      layout="top"
      fixedHeader
      contentWidth="Fluid"
      location={{ pathname: `/${current.id}` }}
      route={{ path: "/", routes: tabs.map((t) => ({ path: `/${t.id}`, name: t.label, icon: t.icon })) }}
      menuItemRender={(item, dom) => {
        const id = String(item.path ?? "").slice(1);
        const b = badge[id];
        return (
          <a onClick={() => go(id)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {dom}
            {b?.n ? <Badge count={b.n} size="small" overflowCount={999} color={b.danger ? "#dc2626" : "rgba(127,127,127,.35)"} /> : null}
          </a>
        );
      }}
      onMenuHeaderClick={() => go("overview")}
      actionsRender={() => []}
      avatarProps={data ? {
        icon: <Avatar style={{ background: "#2563eb" }}>{(data.user.fullName || data.user.email).trim().charAt(0).toUpperCase()}</Avatar>,
        title: <Tooltip title={data.user.email}>{data.user.fullName || data.user.email} · {ROLE_LABEL[data.user.role]}</Tooltip>,
        render: (_props, dom) => (
          <Dropdown menu={{ items: [{ key: "logout", icon: <LogOut size={14} />, label: "Đăng xuất", onClick: logout }] }}>{dom}</Dropdown>
        ),
      } : undefined}
      token={{ pageContainer: { paddingBlockPageContainerContent: 16, paddingInlinePageContainerContent: 16 } }}
    >
      <PageContainer title={current.label} style={{ maxWidth: 1400, margin: "0 auto" }}>
        {loadError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không tải được dữ liệu" description={loadError} />}
        {!data ? (
          <div style={{ padding: 80, textAlign: "center" }}><Spin size="large" tip="Đang tải dữ liệu…"><div style={{ height: 40 }} /></Spin></div>
        ) : (
          <>
            {current.id === "overview" && <OverviewTab onGo={go} />}
            {current.id === "streams" && <StreamsTab />}
            {current.id === "assets" && <AssetsTab />}
            {current.id === "machines" && <MachinesTab />}
            {current.id === "incidents" && <IncidentsTab />}
            {current.id === "users" && can("users.manage") && <UsersTab />}
          </>
        )}
        {!data && loadError && <Button onClick={() => location.reload()}>Tải lại trang</Button>}
      </PageContainer>
    </ProLayout>
  );
}

export function LiveApp() {
  return <AppProvider><Shell /></AppProvider>;
}
