import { CompanyWorkspace } from "../../../components/company-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function DashboardPage() {
  const user = await requireWorkspaceUser();
  return <CompanyWorkspace key={user.id} mode="dashboard" userId={user.id} />;
}
