import { ImageResponse } from "next/og";
import { formatExchangeBudget, formatExchangeDate } from "@/lib/exchange-invitation";
import { getExchangeJoinPreview } from "@/services/exchange-join-preview.server";

export const alt = "Listy Gifty exchange invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string; shareToken: string }>;
}) {
  const { shareToken } = await params;
  const details = await getExchangeJoinPreview(shareToken);
  const exchange = details?.exchange;
  const date = exchange ? formatExchangeDate(exchange.exchange_date, false) : null;
  const budget = exchange ? formatExchangeBudget(exchange) : null;
  const exchangeName = exchange
    ? exchange.name.length > 72
      ? `${exchange.name.slice(0, 69)}…`
      : exchange.name
    : "A thoughtful surprise is waiting";
  const exchangeNameSize = exchangeName.length > 52 ? 52 : exchangeName.length > 34 ? 60 : 68;
  const ownerName = exchange
    ? exchange.owner_name.length > 45
      ? `${exchange.owner_name.slice(0, 42)}…`
      : exchange.owner_name
    : null;
  const detailItems = exchange
    ? [
        date,
        budget,
        `${exchange.accepted_count} ${exchange.accepted_count === 1 ? "person" : "people"} already in`,
      ].filter((item): item is string => Boolean(item))
    : [];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "70px 76px",
        color: "#f8fafc",
        background: "linear-gradient(135deg, #0f172a 0%, #4c1d95 55%, #be185d 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}>
        <div style={{ display: "flex", width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 15, background: "rgba(255,255,255,0.16)" }}>LG</div>
        Listy Gifty
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
        <div style={{ fontSize: 25, letterSpacing: 4, textTransform: "uppercase", color: "#e9d5ff" }}>
          You&apos;re invited to a gift exchange
        </div>
        <div style={{ fontSize: exchangeNameSize, lineHeight: 1.05, fontWeight: 800, letterSpacing: -2 }}>
          {exchangeName}
        </div>
        {exchange && (
          <div style={{ display: "flex", fontSize: 31, color: "#f5d0fe" }}>
            Organized by {ownerName}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25 }}>
        {detailItems.map((item) => (
            <div key={item} style={{ display: "flex", padding: "13px 20px", borderRadius: 999, background: "rgba(15,23,42,0.35)", border: "1px solid rgba(255,255,255,0.2)" }}>
              {item}
            </div>
          ))}
      </div>
    </div>,
    size
  );
}
