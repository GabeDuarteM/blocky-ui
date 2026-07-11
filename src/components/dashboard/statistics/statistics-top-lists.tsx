"use client";

import { useState } from "react";
import { Globe, ListOrdered, Users, type LucideIcon } from "lucide-react";

import { api } from "~/trpc/react";
import {
  TopListCard,
  TopListEntry,
  type TopListFilter,
  type TopListFilterControls,
  TopListsSection,
} from "./top-list";

const DISPLAYED_ENTRIES = 5;

interface NameCount {
  name: string;
  count: number;
}

interface StatisticsTopListProps {
  title: string;
  description: string;
  icon: LucideIcon;
  entries: NameCount[];
  isLoading: boolean;
  filterControls?: TopListFilterControls;
}

function StatisticsTopList({
  title,
  description,
  icon,
  entries,
  isLoading,
  filterControls,
}: StatisticsTopListProps) {
  const displayedEntries = entries.slice(0, DISPLAYED_ENTRIES);
  const maxCount = displayedEntries[0]?.count ?? 0;

  return (
    <TopListCard
      title={title}
      description={description}
      icon={icon}
      filterControls={filterControls}
      isLoading={isLoading}
      isEmpty={displayedEntries.length === 0}
      skeletonRows={DISPLAYED_ENTRIES}
    >
      <div className="-my-1.5">
        {displayedEntries.map((entry) => {
          const width = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;

          return (
            <TopListEntry
              key={entry.name}
              name={entry.name}
              count={entry.count}
              details={
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-sm">{entry.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {entry.count.toLocaleString()}
                  </span>
                </div>
              }
            >
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-[var(--chart-1)]/75 transition-all duration-300"
                  style={{ width: `${width}%` }}
                />
              </div>
            </TopListEntry>
          );
        })}
      </div>
    </TopListCard>
  );
}

export function StatisticsTopLists() {
  const [domainFilter, setDomainFilter] = useState<TopListFilter>("all");
  const { data: snapshot, isLoading } = api.stats.snapshot.useQuery();

  if (!isLoading && !snapshot) {
    return null;
  }

  let domainEntries = snapshot?.topLists.domains ?? [];
  let domainDescription = "Most frequently queried domains";

  if (domainFilter === "blocked") {
    domainEntries = snapshot?.topLists.blockedDomains ?? [];
    domainDescription = "Most frequently blocked domains";
  }

  return (
    <TopListsSection
      description="Most active domains and clients in the last 24 hours"
      icon={ListOrdered}
    >
      <StatisticsTopList
        title="Top Domains"
        description={domainDescription}
        icon={Globe}
        entries={domainEntries}
        isLoading={isLoading}
        filterControls={{ value: domainFilter, onChange: setDomainFilter }}
      />
      <StatisticsTopList
        title="Top Clients"
        description="Devices with the most queries"
        icon={Users}
        entries={snapshot?.topLists.clients ?? []}
        isLoading={isLoading}
      />
    </TopListsSection>
  );
}
