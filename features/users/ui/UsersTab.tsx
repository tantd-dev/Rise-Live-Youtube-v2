"use client";
import { useEffect, useState } from "react";
import { ProCard, ProTable, type ProColumns } from "@ant-design/pro-components";
import { Button, Form, Input, Popconfirm, Select, Space, Tooltip, Typography } from "antd";
import { Lock, LockOpen, Save, Trash, UserPlus } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { ROLE_HINT, ROLE_LABEL, type Role, type UserRow } from "../types";

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r], title: ROLE_HINT[r] }));
interface Values { email: string; fullName: string; role: Role; password?: string }

export function UsersTab() {
  const { run, busy, data } = useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm<Values>();
  const role: Role = Form.useWatch("role", form) ?? "operator";
  const load = () => api<{ users: UserRow[] }>("/api/users").then((r) => setUsers(r.users)).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const save = async (body: Record<string, unknown>, ok: string) => { const r = await run(() => api("/api/users", { body }), ok); if (r) void load(); return r; };
  const me = data?.user.email;

  const columns: ProColumns<UserRow>[] = [
    { title: "Email", dataIndex: "email" },
    { title: "Họ tên", dataIndex: "fullName" },
    {
      title: "Vai trò", dataIndex: "role", width: 200, render: (_, u) => (
        <Select value={u.role} disabled={busy || u.email === me} style={{ width: 170 }} options={ROLE_OPTIONS}
          onChange={(v) => save({ email: u.email, role: v, active: u.status === "active" }, "Đã đổi vai trò.")} />
      ),
    },
    {
      title: "Trạng thái", dataIndex: "status", render: (_, u) => (
        <Space size={6} wrap>
          {u.status === "active" ? <Pill tone="green">Đang hoạt động</Pill> : <Pill tone="gray">Đã khóa</Pill>}
          {!u.hasPassword && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Chưa đặt mật khẩu</Typography.Text>}
        </Space>
      ),
    },
    {
      title: "Thao tác", key: "actions", width: 110, render: (_, u) => u.email === me ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>(bạn)</Typography.Text> : (
        <Space size={0}>
          <Tooltip title={u.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}>
            <Button type="text" size="small" disabled={busy} icon={u.status === "active" ? <Lock size={15} /> : <LockOpen size={15} />}
              onClick={() => save({ email: u.email, role: u.role, active: u.status !== "active" }, u.status === "active" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.")} />
          </Tooltip>
          <Popconfirm title={`Xóa tài khoản ${u.email}?`} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}
            onConfirm={async () => { if (await run(() => api(`/api/users/${encodeURIComponent(u.email)}`, { method: "DELETE" }), "Đã xóa tài khoản.")) void load(); }}>
            <Tooltip title="Xóa"><Button type="text" size="small" danger disabled={busy} icon={<Trash size={15} />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ProCard title={<Space><UserPlus size={18} />Thêm hoặc cập nhật người dùng</Space>} headerBordered style={{ marginBottom: 16 }}
        subTitle="Nhập email đã có để cập nhật họ tên, vai trò hoặc đặt lại mật khẩu">
        <Form form={form} layout="vertical" initialValues={{ role: "operator" }} requiredMark="optional"
          onFinish={async (v) => { if (await save({ ...v, password: v.password || undefined }, "Đã lưu người dùng.")) form.setFieldValue("password", ""); }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", columnGap: 16 }}>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email không hợp lệ" }]}><Input autoComplete="off" /></Form.Item>
            <Form.Item name="fullName" label="Họ tên"><Input /></Form.Item>
            <Form.Item name="role" label="Vai trò" extra={ROLE_HINT[role]}><Select options={ROLE_OPTIONS} /></Form.Item>
            <Form.Item name="password" label="Mật khẩu" extra="Tối thiểu 8 ký tự. Để trống nếu chỉ đổi vai trò."
              rules={[{ min: 8, message: "Mật khẩu tối thiểu 8 ký tự" }]}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={busy} icon={<Save size={14} />}>Lưu</Button>
        </Form>
      </ProCard>
      <ProTable<UserRow>
        rowKey="email"
        headerTitle={`Danh sách người dùng (${users.length})`}
        loading={loading}
        dataSource={users}
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: "Chưa có người dùng nào." }}
      />
    </>
  );
}
