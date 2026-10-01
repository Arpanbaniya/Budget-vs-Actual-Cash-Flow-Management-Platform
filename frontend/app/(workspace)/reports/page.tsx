import { ReportWorkspace } from "../../../components/report-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function ReportsPage() {
  const user = await requireWorkspaceUser();
  return <ReportWorkspace key={user.id} userId={user.id} />;
}
