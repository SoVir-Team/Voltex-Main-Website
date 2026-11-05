import { Inbox } from "@/components/admin/Inbox";

export const metadata = { title: "Ideas" };

export default function AdminIdeasPage() {
  return <Inbox kind="ideas" />;
}
