import { InsightWorkspace } from "../../../components/insight-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function InsightsPage() {
  const user = await requireWorkspaceUser();
  return <InsightWorkspace key={user.id} userId={user.id} />;
}
