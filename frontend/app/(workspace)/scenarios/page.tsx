import { ScenarioWorkspace } from "../../../components/scenario-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";
export default async function ScenariosPage() {
  const user = await requireWorkspaceUser();
  return <ScenarioWorkspace key={user.id} userId={user.id} />;
}
