import { requireChatGPTUser } from "../chatgpt-auth";
import WebWorkspace from "./web-workspace";
import "./web.css";

export const dynamic = "force-dynamic";

export default async function WebPage() {
  const user = await requireChatGPTUser("/web");
  return <WebWorkspace displayName={user.displayName} />;
}
