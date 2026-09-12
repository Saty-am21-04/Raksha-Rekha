"use client";

import { useEffect, useMemo, useRef } from "react";

import type { ScoredHabitation } from "@/lib/scoring";
import { priorityColor } from "@/lib/theme";

const nf = new Intl.NumberFormat("en-IN");

export type SortKey = "rank" | "name" | "population" | "hazard";

const SORTS: { key: SortKey; label: string; title: string }[] = [
  { key: "rank", label: "Rank", title: "Sort by priority rank, most urgent first" },
  { key: "name", label: "Name", title: "Sort alphabetically" },
  { key: "population", label: "Pop.", title: "Sort by population, largest first" },
  { key: "hazard", label: "Hazard", title: "Sort by hazard score, highest first" },
];

interface PriorityListProps {
  ranked: ScoredHabitation[];
  selectedId: string | null;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  onSelect: (id: string | null) => void;
}

/** Ranked, sortable roster of every habitation, synced with map selection. */
export function PriorityList({
  ranked,
  selectedId,
  sortKey,
  onSortChange,
  onSelect,
}: PriorityListProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  const sorted = useMemo(() => {
    const rows = [...ranked];
    switch (sortKey) {
      case "name":
        return rows.sort((a, b) => a.name.localeCompare(b.name));
      case "population":
        return rows.sort((a, b) => b.population - a.population);
      case "hazard":
        return rows.sort((a, b) => b.score.hazard_score - a.score.hazard_score);
      case "rank":
      default:
        return rows.sort(
          (a, b) =>
            (a.score.priority_rank ?? Number.MAX_SAFE_INTEGER) -
            (b.score.priority_rank ?? Number.MAX_SAFE_INTEGER),
        );
    }
  }, [ranked, sortKey]);

  // When selection originates on the map, bring the row into view.
  useEffect(() => {
    if (!selectedId) return;
    const node = itemRefs.current.get(selectedId);
    const container = listRef.current;
    if (!node || !container) return;

    const nodeBox = node.getBoundingClientRect();
    const boxBox = container.getBoundingClientRect();
    const outside = nodeBox.top < boxBox.top || nodeBox.bottom > boxBox.bottom;
    if (outside) node.scrollIntoView({ block: "nearest" });
  }, [selectedId, sorted]);

  const total = ranked.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-subtle bg-panel shrink-0 border-b px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Relocation priority
          </h2>
          <span className="text-muted font-mono text-[11px]">{total}</span>
        </div>

        <div
          role="group"
          aria-label="Sort habitations"
          className="mt-2 flex gap-1"
        >
          {SORTS.map((s) => {
            const active = s.key === sortKey;
            return (
              <button
                key={s.key}
                type="button"
                title={s.title}
                aria-pressed={active}
                onClick={() => onSortChange(s.key)}
                className={`rounded px-2 py-1 text-[11px] transition-colors ${
                  active
                    ? "bg-amber/15 text-amber"
                    : "text-muted hover:bg-panel-hover hover:text-fg"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <p className="text-muted p-3 text-xs">No habitations loaded.</p>
      ) : (
        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {sorted.map((row) => {
            const rank = row.score.priority_rank;
            const active = row.id === selectedId;
            return (
              <li
                key={row.id}
                ref={(node) => {
                  if (node) itemRefs.current.set(row.id, node);
                  else itemRefs.current.delete(row.id);
                }}
              >
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(active ? null : row.id)}
                  className={`border-subtle flex w-full items-center gap-2.5 border-b px-3 py-2 text-left transition-colors ${
                    active
                      ? "bg-amber/10"
                      : "hover:bg-panel-hover"
                  }`}
                >
                  {/* rank chip carries the same colour as the map dot */}
                  <span
                    className="w-7 shrink-0 rounded px-1 py-0.5 text-center font-mono text-[11px] font-semibold"
                    style={{
                      color: priorityColor(rank, total),
                      backgroundColor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    {rank ?? "—"}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{row.name}</span>
                    <span className="text-muted block truncate text-[10px]">
                      pop {nf.format(row.population)}
                      {row.detail.containingZones.length > 0 && (
                        <span className="text-amber"> · in hazard zone</span>
                      )}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[11px]">
                      {row.score.hazard_score.toFixed(0)}
                    </span>
                    <span className="text-muted block text-[9px] uppercase">
                      hazard
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
