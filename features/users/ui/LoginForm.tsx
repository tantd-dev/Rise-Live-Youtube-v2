"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";

export function LoginForm({ devLogin }: { devLogin: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/api/auth/login", { body: { email, password } });
      location.reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h2>AB Live</h2>
        <label className="field"><span className="field-label">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label className="field"><span className="field-label">Mật khẩu</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn-primary" disabled={busy}>Đăng nhập</button>
        {devLogin && <p><a href="/api/auth/dev-login">Đăng nhập thử (tài khoản dev, Quản trị)</a></p>}
      </form>
    </div>
  );
}
