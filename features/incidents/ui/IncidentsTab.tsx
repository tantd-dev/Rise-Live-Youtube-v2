"use client";
import { useEffect, useState } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Alert, Button, Select, Typography } from "antd";
import { RefreshCw } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { fmtDuration, fmtTime } from "@/lib/client/format";
import type { IncidentRow } from "../types";

export function IncidentsTab() {
  const { data } = useApp();
  const [rows, setRows] = useState<IncidentRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [machine, setMachine] = useState<string>();
  const load = () => {
    setLoading(true);
    return api<{ rows: IncidentRow[] }>("/api/incidents")
      .then((r) => { setRows(r.rows); setErr(""); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);
  const mName = (id: string) => data?.machines.find((m) => m.id === id)?.name ?? id;
  const shown = (rows ?? []).filter((r) => !machine || r.machineId === machine);

  const columns: ProColumns<IncidentRow>[] = [
    { title: "Thời điểm", dataIndex: "at", width: 170, render: (_, r) => fmtTime(r.at) },
    { title: "Phiên live", dataIndex: "streamName" },
    { title: "VPS", dataIndex: "machineId", render: (_, r) => mName(r.machineId) },
    { title: "Loại sự cố", dataIndex: "kind" },
    { title: "Chi tiết", dataIndex: "detail", render: (_, r) => <Typography.Text style={{ fontSize: 13 }}>{r.detail}</Typography.Text> },
    { title: "Thời gian mất sóng", dataIndex: "downSec", width: 150, render: (_, r) => (r.downSec != null ? fmtDuration(r.downSec) : "—") },
  ];

  return (
    <>
      {err && <Alert type="error" showIcon message="Không tải được nhật ký" description={err} style={{ marginBottom: 16 }} />}
      <ProTable<IncidentRow>
        rowKey="key"
        headerTitle="Danh sách sự cố"
        loading={loading && !rows}
        dataSource={shown}
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: "Chưa có sự cố nào." }}
        toolBarRender={() => [
          <Select key="m" allowClear placeholder="Tất cả VPS" style={{ minWidth: 200 }} value={machine} onChange={setMachine}
            options={data?.machines.map((m) => ({ value: m.id, label: m.name }))} />,
          <Button key="r" icon={<RefreshCw size={14} />} loading={loading} onClick={load}>Làm mới</Button>,
        ]}
      />
    </>
  );
}
