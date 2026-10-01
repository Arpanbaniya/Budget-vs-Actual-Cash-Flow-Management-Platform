import { VarianceWorkspace } from "../../../components/variance-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function VariancePage() {
  const user = await requireWorkspaceUser();
  return <VarianceWorkspace key={user.id} userId={user.id} />;
}
