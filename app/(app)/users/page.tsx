import { redirect } from "next/navigation";
import { getSessionUser } from "@/features/users/server/session";
import { can } from "@/features/users/types";
import { UsersTab } from "@/features/users/ui/UsersTab";

export const metadata = { title: "Users · AB Live" };

export default async function Page() {
  if (!can(await getSessionUser(), "users.manage")) redirect("/");
  return <UsersTab />;
}
