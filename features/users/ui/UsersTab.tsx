"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Card, Field, Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { ROLE_LABEL, type Role, type UserRow } from "../types";

export function UsersTab() {
  const { run, busy, data } = useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [f, setF] = useState({ email: "", fullName: "", role: "operator" as Role, password: "" });
  const load = () => api<{ users: UserRow[] }>("/api/users").then((r) => setUsers(r.users)).catch(() => undefined);
  useEffect(() => { void load(); }, []);
  const save = async (body: Record<string, unknown>, ok: string) => { if (await run(() => api("/api/users", { body }), ok)) void load(); };

  return (
    <>
      <Card title="➕ Thêm / cập nhật người dùng">
        <div className="form-grid">
          <Field label="Email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Họ tên"><input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="Vai trò">
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="Mật khẩu (≥ 8 ký tự)" hint="Để trống khi chỉ đổi vai trò."><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <button className="btn-primary" disabled={busy || !f.email} onClick={async () => { await save({ ...f, password: f.password || undefined }, "Đã lưu người dùng."); setF({ ...f, password: "" }); }}>Lưu</button>
      </Card>
      <Card title={`👥 Người dùng (${users.length})`}>
        <table>
          <thead><tr><th>Email</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td>{u.email}</td>
                <td>{u.fullName}</td>
                <td>
                  <select value={u.role} disabled={busy || u.email === data?.user.email} onChange={(e) => save({ email: u.email, role: e.target.value, active: u.status === "active" }, "Đã đổi vai trò.")}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.status === "active" ? <Pill tone="green">hoạt động</Pill> : <Pill tone="gray">đã khoá</Pill>} {!u.hasPassword && <span className="muted small">chưa có mật khẩu</span>}</td>
                <td className="row-actions">
                  {u.email !== data?.user.email && <button disabled={busy} onClick={() => save({ email: u.email, role: u.role, active: u.status !== "active" }, u.status === "active" ? "Đã khoá." : "Đã mở khoá.")}>{u.status === "active" ? "Khoá" : "Mở khoá"}</button>}
                  {u.email !== data?.user.email && <button className="btn-ghost danger" disabled={busy} onClick={async () => { if (confirm(`Xoá ${u.email}?`) && await run(() => api(`/api/users/${encodeURIComponent(u.email)}`, { method: "DELETE" }), "Đã xoá.")) void load(); }}>Xoá</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
