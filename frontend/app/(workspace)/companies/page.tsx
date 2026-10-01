import { CompanyWorkspace } from "../../../components/company-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function CompaniesPage() {
  const user = await requireWorkspaceUser();
  return <CompanyWorkspace key={user.id} mode="manage" userId={user.id} />;
}
