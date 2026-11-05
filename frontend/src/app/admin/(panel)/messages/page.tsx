import { Inbox } from "@/components/admin/Inbox";

export const metadata = { title: "Messages" };

export default function AdminMessagesPage() {
  return <Inbox kind="messages" />;
}
