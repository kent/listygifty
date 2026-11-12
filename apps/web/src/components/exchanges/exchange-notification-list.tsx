import Link from "next/link";
import { Check, X } from "lucide-react";
import { isPendingWishlistRequest, type ExchangeNotification } from "@niftygifty/types";
import { Button } from "@/components/ui/button";

interface ExchangeNotificationListProps {
  notifications: ExchangeNotification[];
  exchangeSlug: string;
  answeringId: number | null;
  onMarkRead: (notification: ExchangeNotification) => void;
  onAnswer: (notification: ExchangeNotification, approve: boolean) => void;
}

const ACTION_CLASS = "h-11 sm:h-8";

// Wishlist requests are answered right here. Everything else can be marked read.
export function ExchangeNotificationList({
  notifications,
  exchangeSlug,
  answeringId,
  onMarkRead,
  onAnswer,
}: ExchangeNotificationListProps) {
  return (
    <ul className="space-y-2">
      {notifications.map((notification) => {
        const request = notification.wishlist_access_request;
        const answering = answeringId === notification.id;

        return (
          <li
            key={notification.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
          >
            <span
              className={`min-w-0 grow basis-48 break-words ${notification.read_at ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}
            >
              {notification.message}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {isPendingWishlistRequest(notification) && request ? (
                <>
                  <Button
                    size="sm"
                    className={ACTION_CLASS}
                    disabled={answering}
                    onClick={() => onAnswer(notification, true)}
                    aria-label={`Let ${request.requester_name} see your wishlist`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Say yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={ACTION_CLASS}
                    disabled={answering}
                    onClick={() => onAnswer(notification, false)}
                    aria-label={`Keep your wishlist private from ${request.requester_name}`}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Say no
                  </Button>
                </>
              ) : notification.kind === "wishlist_access_requested" && request ? (
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {request.status === "approved" ? "You said yes" : "You said no"}
                </span>
              ) : notification.kind === "wishlist_access_approved" && request ? (
                <Button asChild size="sm" variant="outline" className={ACTION_CLASS}>
                  <Link
                    href={`/exchanges/${exchangeSlug}/participants/${request.requested_participant_id}`}
                    onClick={() => !notification.read_at && onMarkRead(notification)}
                  >
                    See their wishlist
                  </Link>
                </Button>
              ) : !notification.read_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`${ACTION_CLASS} text-violet-700 dark:text-violet-300`}
                  onClick={() => onMarkRead(notification)}
                >
                  Mark read
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
