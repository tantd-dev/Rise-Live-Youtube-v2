"use client";
// Màn hình báo trạng thái toàn trang (app đang tắt, mất kết nối CSDL…).
import type { ReactNode } from "react";
import { Card, Result, Typography } from "antd";

export function StatusScreen({ status, title, detail, children }: { status: "info" | "error" | "warning"; title: string; detail?: string; children: ReactNode }) {
  return (
    <main className="center-screen">
      <Card style={{ maxWidth: 560, width: "100%" }}>
        <Result
          status={status}
          title={title}
          subTitle={<>
            {detail && <Typography.Paragraph type="danger" style={{ marginBottom: 8 }}>{detail}</Typography.Paragraph>}
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{children}</Typography.Paragraph>
          </>}
        />
      </Card>
    </main>
  );
}
