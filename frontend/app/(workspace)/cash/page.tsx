import { CashWorkspace } from "../../../components/cash-workspace";
import { requireWorkspaceUser } from "../../../lib/workspace-user";

export default async function CashPage() {
  const user = await requireWorkspaceUser();
  return <CashWorkspace key={user.id} userId={user.id} />;
}
