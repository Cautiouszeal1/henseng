import { getDb } from "@henseng/db";
import { requireAdminPage } from "@/lib/admin";

export default async function AuditLog() {
  await requireAdminPage("audit.view");
  const rows = await getDb().adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { include: { user: { include: { wallets: true } } } } },
  });
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Every admin change, newest first. The database blocks edits and deletions, so entries cannot be altered.
      </p>
      <div className="mt-8 overflow-x-auto rounded-[var(--radius-panel)] border border-rule">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-deep text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Time (UTC)</th>
              <th scope="col" className="px-4 py-3 font-medium">Admin</th>
              <th scope="col" className="px-4 py-3 font-medium">Action</th>
              <th scope="col" className="px-4 py-3 font-medium">Entity</th>
              <th scope="col" className="px-4 py-3 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">No admin actions recorded yet.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tabular whitespace-nowrap px-4 py-3 text-ink-muted">{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="tabular px-4 py-3 text-xs text-ink-muted">{r.actor?.user.wallets[0]?.address.slice(0, 10) ?? "system"}…</td>
                <td className="px-4 py-3">{r.action}</td>
                <td className="px-4 py-3 text-ink-muted">{r.entityType} {r.entityId.slice(0, 12)}</td>
                <td className="px-4 py-3 text-xs text-ink-faint">
                  <code className="break-all">{r.before ? JSON.stringify(r.before) : "–"} → {r.after ? JSON.stringify(r.after) : "–"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
