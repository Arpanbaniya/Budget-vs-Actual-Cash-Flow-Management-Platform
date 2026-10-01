import { ImportWorkspace } from "../../../components/import-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function ImportsPage() {
  const user = await requireWorkspaceUser();
  return <ImportWorkspace key={user.id} userId={user.id} />;
}
