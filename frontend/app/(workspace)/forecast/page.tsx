import { ForecastWorkspace } from "../../../components/forecast-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";
export default async function ForecastPage() {
  const user = await requireWorkspaceUser();
  return <ForecastWorkspace key={user.id} userId={user.id} />;
}
