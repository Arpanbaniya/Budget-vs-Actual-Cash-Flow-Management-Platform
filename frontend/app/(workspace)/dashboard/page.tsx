import { DashboardWorkspace } from "../../../components/dashboard-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function DashboardPage() {
  const user = await requireWorkspaceUser();
  return <DashboardWorkspace key={user.id} userId={user.id} />;
}
