"use client";
// Khung ứng dụng: thanh trên + các tab. Mỗi tab là 1 thành phần của đúng miền nghiệp vụ.
import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./AppContext";
import { OverviewTab } from "@/features/dashboard/ui/OverviewTab";
import { StreamsTab } from "@/features/streams/ui/StreamsTab";
import { AssetsTab } from "@/features/assets/ui/AssetsTab";
import { MachinesTab } from "@/features/machines/ui/MachinesTab";
import { IncidentsTab } from "@/features/incidents/ui/IncidentsTab";
import { UsersTab } from "@/features/users/ui/UsersTab";
import { ROLE_LABEL, type Permission } from "@/features/users/types";

const TABS: { id: string; label: string; perm: Permission }[] = [
  { id: "overview", label: "📊 Tổng quan", perm: "view" },
  { id: "streams", label: "🔴 Luồng phát", perm: "view" },
  { id: "assets", label: "🎞 Kho video", perm: "view" },
  { id: "machines", label: "🖥 Máy live", perm: "view" },
  { id: "incidents", label: "🛠 Nhật ký", perm: "view" },
  { id: "users", label: "👥 Người dùng", perm: "users.manage" },
];

function Shell() {
  const { data, loadError, can } = useApp();
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    try { const t = localStorage.getItem("rl.tab"); if (t) setTab(t); } catch { /* không có localStorage */ }
  }, []);
  const go = (t: string) => { setTab(t); try { localStorage.setItem("rl.tab", t); } catch { /* bỏ qua */ } };
  const tabs = TABS.filter((t) => can(t.perm));
  const o = data?.overview;
  const badge: Record<string, number> = {
    overview: (o?.alertsCritical ?? 0) + (o?.alertsWarn ?? 0),
    streams: data?.streams.length ?? 0,
    assets: data?.assets.length ?? 0,
    machines: data?.machines.length ?? 0,
  };

  return (
    <div className="app">
      <header className="topbar">
        <b className="brand">AB Live</b>
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => go(t.id)}>
              {t.label}{badge[t.id] ? <span className="tab-badge">{badge[t.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="who">
          {data && <span title={ROLE_LABEL[data.user.role]}>{data.user.fullName} · {data.user.role}</span>}
          <form action="/api/auth/logout" method="post"><button className="btn-ghost">Đăng xuất</button></form>
        </div>
      </header>
      <main className="main">
        {loadError && <div className="banner banner-red">Không tải được dữ liệu: {loadError}</div>}
        {!data ? <p className="empty">Đang tải…</p> : (
          <>
            {tab === "overview" && <OverviewTab onGo={go} />}
            {tab === "streams" && <StreamsTab />}
            {tab === "assets" && <AssetsTab />}
            {tab === "machines" && <MachinesTab />}
            {tab === "incidents" && <IncidentsTab />}
            {tab === "users" && can("users.manage") && <UsersTab />}
          </>
        )}
      </main>
    </div>
  );
}

export function LiveApp() {
  return <AppProvider><Shell /></AppProvider>;
}
