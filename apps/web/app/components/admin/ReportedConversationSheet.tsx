import { useEffect, useRef } from "react";
import { useReportedConversation } from "~/lib/queries/useAdmin";
import { Sheet } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

// The messages around one reported message, so a moderator can judge it in
// context. Opening this is recorded in the audit log, and it is only possible
// while the report is open — hence the note at the top.
export function ReportedConversationSheet({
  reportId,
  onOpenChange,
}: {
  reportId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useReportedConversation(reportId);
  const reportedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (data) reportedRef.current?.scrollIntoView({ block: "center" });
  }, [data]);

  return (
    <Sheet
      open={reportId !== null}
      onOpenChange={onOpenChange}
      title="Conversation signalée"
      description="Un extrait autour du message signalé. Cette consultation est enregistrée dans le journal d’audit."
    >
      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="ml-auto h-10 w-2/3" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{(error as Error).message}</p>}

      {data && (
        <ul className="flex flex-col gap-3">
          {data.messages.map((message) => {
            const isReported = message.id === data.reportedMessageId;
            return (
              <li
                key={message.id}
                ref={isReported ? reportedRef : undefined}
                className={cn(
                  "rounded-xl border p-3",
                  isReported ? "border-warning bg-warning-soft" : "border-line bg-raised"
                )}
              >
                <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
                  <span className="font-medium text-ink">{data.participants[message.sender_profile_id] ?? "Membre"}</span>
                  <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("fr-FR")}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{message.content}</p>
                {isReported && <p className="mt-2 text-xs font-medium text-warning">Message signalé</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
