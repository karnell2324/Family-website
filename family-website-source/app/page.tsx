import { requireChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";
import FamilyPortal from "./family-portal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <FamilyPortal user={{ name: user.displayName, email: user.email }} signOutPath={chatGPTSignOutPath("/")} />;
}
