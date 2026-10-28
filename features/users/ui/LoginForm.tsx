"use client";
import { useState } from "react";
import { Alert, Button, Card, Divider, Form, Input, Space, Typography } from "antd";
import { FlaskConical, Lock, LogIn, Mail, Radio } from "lucide-react";
import { api } from "@/lib/client/api";

export function LoginForm({ devLogin }: { devLogin: boolean }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (v: { email: string; password: string }) => {
    setBusy(true); setErr("");
    try {
      await api("/api/auth/login", { body: v });
      location.href = "/";
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="center-screen">
      <Card style={{ width: "100%", maxWidth: 400 }}>
        <Space direction="vertical" align="center" style={{ width: "100%", marginBottom: 24 }}>
          <Radio size={36} color="#dc2626" />
          <Typography.Title level={3} style={{ margin: 0 }}>AB Live</Typography.Title>
          <Typography.Text type="secondary">Hệ thống phát trực tiếp 24/7 lên YouTube</Typography.Text>
        </Space>
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Nhập email" }]}>
            <Input prefix={<Mail size={14} />} autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
            <Input.Password prefix={<Lock size={14} />} autoComplete="current-password" size="large" />
          </Form.Item>
          {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 16 }} />}
          <Button type="primary" htmlType="submit" block size="large" loading={busy} icon={<LogIn size={16} />}>Đăng nhập</Button>
        </Form>
        {devLogin && (
          <>
            <Divider plain style={{ margin: "20px 0 12px" }}>Môi trường phát triển</Divider>
            <Button block href="/api/auth/dev-login" icon={<FlaskConical size={14} />}>Đăng nhập thử (tài khoản dev, quyền Quản trị viên)</Button>
          </>
        )}
      </Card>
    </main>
  );
}
