"use client";
import { useRouter } from "next/navigation";
import { OverviewTab } from "@/features/dashboard/ui/OverviewTab";

export default function DashboardPage() {
  const router = useRouter();
  return <OverviewTab onGo={(path) => router.push(path)} />;
}
