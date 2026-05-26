"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  LayoutList,
  Plus,
  Scale,
  Truck,
  User,
  X,
} from "lucide-react";
import type { Address, Gift, Person, GiftStatus } from "@niftygifty/types";

interface HolidayReportsProps {
  gifts: Gift[];
  people: Person[];
  statuses: GiftStatus[];
  showAddresses?: boolean;
  onExportGifts?: () => void;
}

interface StatusSummary {
  count: number;
  cost: number;
}

interface PersonStats {
  summaryByStatus: Map<number, StatusSummary>;
  totalCount: number;
  totalCost: number;
}

interface GiftException {
  gift: Gift;
  issues: string[];
}

interface FulfillmentRow {
  id: string;
  gift: Gift;
  recipientName: string;
  recipientEmail: string | null;
  shippingAddress: Address | null;
  issues: string[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function calculatePersonStats(
  person: Person,
  gifts: Gift[],
  statuses: GiftStatus[]
): PersonStats {
  const personGifts = gifts.filter((g) =>
    g.recipients.some((r) => r.id === person.id)
  );

  const summaryByStatus = new Map<number, StatusSummary>();
  statuses.forEach((s) => summaryByStatus.set(s.id, { count: 0, cost: 0 }));

  personGifts.forEach((gift) => {
    const summary = summaryByStatus.get(gift.gift_status_id);
    if (summary) {
      summary.count += 1;
      summary.cost += parseFloat(gift.cost || "0");
    }
  });

  const totalCount = personGifts.length;
  const totalCost = personGifts.reduce(
    (sum, g) => sum + parseFloat(g.cost || "0"),
    0
  );

  return { summaryByStatus, totalCount, totalCost };
}

function getGiftExceptions(gifts: Gift[], showAddresses: boolean): GiftException[] {
  return gifts
    .map((gift) => {
      const issues: string[] = [];

      if (gift.recipients.length === 0) {
        issues.push("No recipient");
      }
      if (!gift.cost) {
        issues.push("Missing cost");
      }
      if (!gift.link) {
        issues.push("Missing link");
      }
      if (
        showAddresses &&
        gift.gift_recipients.length > 0 &&
        gift.gift_recipients.some((recipient) => !recipient.shipping_address_id)
      ) {
        issues.push("Missing shipping address");
      }

      return { gift, issues };
    })
    .filter((exception) => exception.issues.length > 0);
}

function getFulfillmentRows(gifts: Gift[], showAddresses: boolean): FulfillmentRow[] {
  return gifts.flatMap((gift) => {
    const baseIssues: string[] = [];

    if (!gift.cost) {
      baseIssues.push("Missing cost");
    }
    if (!gift.link) {
      baseIssues.push("Missing link");
    }

    if (gift.gift_recipients.length === 0) {
      return [
        {
          id: `${gift.id}:unassigned`,
          gift,
          recipientName: "Unassigned",
          recipientEmail: null,
          shippingAddress: null,
          issues: ["No recipient", ...baseIssues],
        },
      ];
    }

    return gift.gift_recipients.map((giftRecipient) => {
      const issues = [...baseIssues];

      if (showAddresses && !giftRecipient.shipping_address_id) {
        issues.push("Missing shipping address");
      }

      return {
        id: `${gift.id}:${giftRecipient.person_id}`,
        gift,
        recipientName: giftRecipient.person.name,
        recipientEmail: giftRecipient.person.email,
        shippingAddress: giftRecipient.shipping_address,
        issues,
      };
    });
  });
}

function getAddressLabel(address: Address | null, showAddresses: boolean): string {
  if (!showAddresses) {
    return "Hidden";
  }

  if (!address) {
    return "Missing";
  }

  return address.formatted_address_single_line;
}

function PersonSummaryTable({
  person,
  stats,
  statuses,
}: {
  person: Person;
  stats: PersonStats;
  statuses: GiftStatus[];
}) {
  if (stats.totalCount === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden h-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[180px] font-semibold text-white">
              {person.name}
            </TableHead>
            <TableHead className="w-[140px] font-semibold">Status</TableHead>
            <TableHead className="w-[100px] text-center font-semibold">
              Count
            </TableHead>
            <TableHead className="w-[120px] text-right font-semibold">
              Cost
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.map((status, idx) => {
            const summary = stats.summaryByStatus.get(status.id) || {
              count: 0,
              cost: 0,
            };
            return (
              <TableRow key={status.id}>
                {idx === 0 ? (
                  <TableCell
                    rowSpan={statuses.length + 1}
                    className="align-top border-r border-border/30"
                  />
                ) : null}
                <TableCell className="border-l border-border/30">
                  {status.name}
                </TableCell>
                <TableCell className="text-center">{summary.count}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(summary.cost)}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/20 font-semibold">
            <TableCell className="border-l border-border/30">Total</TableCell>
            <TableCell className="text-center">{stats.totalCount}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(stats.totalCost)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryView({
  people,
  gifts,
  statuses,
}: {
  people: Person[];
  gifts: Gift[];
  statuses: GiftStatus[];
}) {
  const recipientsWithGifts = people.filter((person) =>
    gifts.some((g) => g.recipients.some((r) => r.id === person.id))
  );

  if (recipientsWithGifts.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
        <p className="text-muted-foreground">
          No gifts assigned to recipients yet. Add gifts and assign recipients to
          see the report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {recipientsWithGifts.map((person) => (
        <PersonSummaryTable
          key={person.id}
          person={person}
          statuses={statuses}
          stats={calculatePersonStats(person, gifts, statuses)}
        />
      ))}
    </div>
  );
}

function PersonView({
  people,
  gifts,
  statuses,
}: {
  people: Person[];
  gifts: Gift[];
  statuses: GiftStatus[];
}) {
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");

  const selectedPerson = people.find(
    (p) => p.id.toString() === selectedPersonId
  );

  const stats = selectedPerson
    ? calculatePersonStats(selectedPerson, gifts, statuses)
    : null;

  const renderContent = () => {
    if (!selectedPerson) {
      return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
          <User className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <p className="text-muted-foreground">
            Select a person to view their gift report.
          </p>
        </div>
      );
    }

    if (stats && stats.totalCount === 0) {
      return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 mb-4">
            <User className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">{selectedPerson.name}</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            No gifts assigned yet. Add gifts to this gift list and assign {selectedPerson.name} as a recipient to see their report.
          </p>
        </div>
      );
    }

    return (
      <PersonSummaryTable
        person={selectedPerson}
        statuses={statuses}
        stats={stats!}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="w-[300px]">
        <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a person" />
          </SelectTrigger>
          <SelectContent>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id.toString()}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderContent()}
    </div>
  );
}

function ComparisonTable({
  selectedPeople,
  statuses,
  statsMap,
}: {
  selectedPeople: Person[];
  statuses: GiftStatus[];
  statsMap: Map<number, PersonStats>;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[140px] font-semibold">Status</TableHead>
            {selectedPeople.map((person) => (
              <TableHead
                key={person.id}
                className="text-center font-semibold text-white min-w-[120px]"
              >
                {person.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.map((status) => (
            <TableRow key={status.id}>
              <TableCell className="font-medium">{status.name}</TableCell>
              {selectedPeople.map((person) => {
                const stats = statsMap.get(person.id);
                const summary = stats?.summaryByStatus.get(status.id) || {
                  count: 0,
                  cost: 0,
                };
                return (
                  <TableCell key={person.id} className="text-center">
                    <span className="font-medium">{summary.count}</span>
                    <span className="text-muted-foreground ml-1">
                      ({formatCurrency(summary.cost)})
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow className="bg-muted/20 font-semibold">
            <TableCell>Total</TableCell>
            {selectedPeople.map((person) => {
              const stats = statsMap.get(person.id);
              return (
                <TableCell key={person.id} className="text-center">
                  <span className="font-medium">{stats?.totalCount || 0}</span>
                  <span className="text-muted-foreground ml-1">
                    ({formatCurrency(stats?.totalCost || 0)})
                  </span>
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function CompareView({
  people,
  gifts,
  statuses,
}: {
  people: Person[];
  gifts: Gift[];
  statuses: GiftStatus[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(["", ""]);

  const selectedPeople = selectedIds
    .map((id) => people.find((p) => p.id.toString() === id))
    .filter((p): p is Person => p !== undefined);

  const statsMap = useMemo(() => {
    const map = new Map<number, PersonStats>();
    selectedPeople.forEach((person) => {
      map.set(person.id, calculatePersonStats(person, gifts, statuses));
    });
    return map;
  }, [selectedPeople, gifts, statuses]);

  const canAddMore = selectedIds.length < 4;
  const canRemove = selectedIds.length > 2;

  const updatePerson = (index: number, value: string) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addSlot = () => {
    if (canAddMore) {
      setSelectedIds((prev) => [...prev, ""]);
    }
  };

  const removeSlot = (index: number) => {
    if (canRemove) {
      setSelectedIds((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const hasAnySelection = selectedPeople.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        {selectedIds.map((id, index) => (
          <div key={index} className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Person {index + 1}
            </label>
            <div className="flex items-center gap-2">
              <Select value={id} onValueChange={(v) => updatePerson(index, v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id.toString()}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-red-400"
                  onClick={() => removeSlot(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {canAddMore && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 mb-0.5"
            onClick={addSlot}
          >
            <Plus className="h-4 w-4" />
            Add Person
          </Button>
        )}
      </div>

      {hasAnySelection ? (
        <ComparisonTable
          selectedPeople={selectedPeople}
          statuses={statuses}
          statsMap={statsMap}
        />
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
          <Scale className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <p className="text-muted-foreground">
            Select people above to compare their gift totals.
          </p>
        </div>
      )}
    </div>
  );
}

function FulfillmentView({
  gifts,
  showAddresses,
  onExportGifts,
}: {
  gifts: Gift[];
  showAddresses: boolean;
  onExportGifts?: () => void;
}) {
  const rows = useMemo(
    () => getFulfillmentRows(gifts, showAddresses),
    [gifts, showAddresses]
  );
  const rowCountWithIssues = rows.filter((row) => row.issues.length > 0).length;

  if (gifts.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
        <Truck className="h-12 w-12 mx-auto text-slate-600 mb-4" />
        <p className="text-muted-foreground">
          No gifts are ready for fulfillment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Fulfillment handoff</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} recipient row{rows.length === 1 ? "" : "s"} - {rowCountWithIssues} exception{rowCountWithIssues === 1 ? "" : "s"}
          </p>
        </div>
        {onExportGifts ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 self-start sm:self-center"
            onClick={onExportGifts}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold">Gift</TableHead>
              <TableHead className="font-semibold">Recipient</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Cost</TableHead>
              <TableHead className="font-semibold">Shipping Address</TableHead>
              <TableHead className="font-semibold">Issues</TableHead>
              <TableHead className="w-[80px] text-right font-semibold">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.gift.name}</TableCell>
                <TableCell>{row.recipientName}</TableCell>
                <TableCell>{row.recipientEmail || "Missing"}</TableCell>
                <TableCell>{row.gift.gift_status.name}</TableCell>
                <TableCell>
                  {row.gift.cost ? formatCurrency(parseFloat(row.gift.cost)) : "Missing"}
                </TableCell>
                <TableCell>
                  {getAddressLabel(row.shippingAddress, showAddresses)}
                </TableCell>
                <TableCell>{row.issues.join(", ") || "Ready"}</TableCell>
                <TableCell className="text-right">
                  {row.gift.link ? (
                    <a
                      href={row.gift.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-violet-500 hover:text-violet-400"
                      aria-label={`Open ${row.gift.name} link`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ExceptionsView({
  gifts,
  showAddresses,
}: {
  gifts: Gift[];
  showAddresses: boolean;
}) {
  const exceptions = useMemo(
    () => getGiftExceptions(gifts, showAddresses),
    [gifts, showAddresses]
  );

  if (exceptions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
        <p className="text-muted-foreground">
          No fulfillment exceptions found for this gift list.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold">Gift</TableHead>
            <TableHead className="font-semibold">Recipients</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Issues</TableHead>
            <TableHead className="w-[80px] text-right font-semibold">Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exceptions.map(({ gift, issues }) => (
            <TableRow key={gift.id}>
              <TableCell className="font-medium">{gift.name}</TableCell>
              <TableCell>
                {gift.recipients.map((recipient) => recipient.name).join(", ") || "None"}
              </TableCell>
              <TableCell>{gift.gift_status.name}</TableCell>
              <TableCell>{issues.join(", ")}</TableCell>
              <TableCell className="text-right">
                {gift.link ? (
                  <a
                    href={gift.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-violet-500 hover:text-violet-400"
                    aria-label={`Open ${gift.name} link`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type ViewType = "summary" | "person" | "compare" | "fulfillment" | "exceptions";

export function HolidayReports({
  gifts,
  people,
  statuses,
  showAddresses = false,
  onExportGifts,
}: HolidayReportsProps) {
  const [currentView, setCurrentView] = useState<ViewType>("summary");

  // Sort statuses by position
  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses]
  );

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 flex-shrink-0 space-y-2">
        <Button
          variant={currentView === "summary" ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView("summary")}
        >
          <LayoutList className="h-4 w-4" />
          Summary
        </Button>
        <Button
          variant={currentView === "person" ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView("person")}
        >
          <User className="h-4 w-4" />
          By Person
        </Button>
        <Button
          variant={currentView === "compare" ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView("compare")}
        >
          <Scale className="h-4 w-4" />
          Compare
        </Button>
        <Button
          variant={currentView === "fulfillment" ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView("fulfillment")}
        >
          <Truck className="h-4 w-4" />
          Fulfillment
        </Button>
        <Button
          variant={currentView === "exceptions" ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView("exceptions")}
        >
          <AlertTriangle className="h-4 w-4" />
          Exceptions
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {currentView === "summary" && (
          <SummaryView
            people={people}
            gifts={gifts}
            statuses={sortedStatuses}
          />
        )}
        {currentView === "person" && (
          <PersonView
            people={people}
            gifts={gifts}
            statuses={sortedStatuses}
          />
        )}
        {currentView === "compare" && (
          <CompareView
            people={people}
            gifts={gifts}
            statuses={sortedStatuses}
          />
        )}
        {currentView === "fulfillment" && (
          <FulfillmentView
            gifts={gifts}
            showAddresses={showAddresses}
            onExportGifts={onExportGifts}
          />
        )}
        {currentView === "exceptions" && (
          <ExceptionsView gifts={gifts} showAddresses={showAddresses} />
        )}
      </div>
    </div>
  );
}
