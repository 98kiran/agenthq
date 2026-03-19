"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, RefreshCw, Loader2, Zap } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  agent: string;
  timestamp: number; // ms
  title: string;
  description?: string;
  type: string;
  status?: string;
}

interface RawTimelineEvent {
  id: string;
  agent?: string | null;
  timestamp: number;
  title: string;
  description?: string;
  type: string;
  status?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// No hardcoded agents -- loaded dynamically from /api/timeline response
const SYSTEM_AGENT = { id: "system", label: "System", emoji: "🤖", color: "#8c8c9a" };

type AgentInfo = { id: string; label: string; emoji: string; color: string };
type AgentId = string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeAgentId(agent?: string | null, knownAgents?: AgentInfo[]): string {
  const value = (agent ?? "").trim().toLowerCase();
  if (!value || value === "unknown" || value === "dispatcher") return "system";
  if (knownAgents && knownAgents.some((a) => a.id === value)) return value;
  // If we don't know the agent, keep it as-is (dynamic agents may not be in our list yet)
  if (value && value !== "system") return value;
  return "system";
}

function getAgent(id: string, agents: AgentInfo[]) {
  return agents.find((a) => a.id === id) ?? { id, label: id, emoji: "🤖", color: "#8c8c9a" };
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = new Date(d);
  dayMs.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - dayMs.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function groupByDate(events: TimelineEvent[]) {
  const groups = new Map<string, { events: TimelineEvent[]; sortTs: number; label: string }>();
  const earlier: TimelineEvent[] = [];

  for (const ev of events) {
    if (!Number.isFinite(ev.timestamp)) {
      earlier.push(ev);
      continue;
    }

    const d = new Date(ev.timestamp);
    const key = d.toDateString();
    if (key === "Invalid Date") {
      earlier.push(ev);
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        events: [],
        sortTs: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        label: formatDateLabel(ev.timestamp),
      });
    }
    groups.get(key)!.events.push(ev);
  }

  const ordered = Array.from(groups.values()).sort((a, b) => b.sortTs - a.sortTs);
  if (earlier.length > 0) {
    ordered.push({
      label: "Earlier",
      sortTs: Number.NEGATIVE_INFINITY,
      events: earlier.sort((a, b) => (Number.isFinite(b.timestamp) ? b.timestamp : 0) - (Number.isFinite(a.timestamp) ? a.timestamp : 0)),
    });
  }

  return ordered;
}

function sameAgents(a: AgentInfo[], b: AgentInfo[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].label !== b[i].label || a[i].emoji !== b[i].emoji || a[i].color !== b[i].color) {
      return false;
    }
  }
  return true;
}

function ago(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Event type badge ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    task_complete: { bg: "rgba(34,197,94,0.15)",   color: "var(--badge-green)",  label: "complete" },
    task:          { bg: "rgba(124,58,237,0.12)",  color: "var(--badge-purple)", label: "task" },
    fix:           { bg: "rgba(245,158,11,0.15)",  color: "var(--badge-amber)",  label: "fix" },
    cron:          { bg: "rgba(59,130,246,0.12)",  color: "var(--badge-blue)",   label: "cron" },
    session:       { bg: "rgba(16,185,129,0.12)",  color: "var(--badge-teal)",   label: "session" },
    system:        { bg: "rgba(100,116,139,0.12)", color: "var(--badge-slate)",  label: "system" },
    heartbeat:       { bg: "rgba(245,158,11,0.12)",  color: "var(--badge-amber)",  label: "heartbeat" },
    trade_executed:  { bg: "rgba(217,119,6,0.15)",   color: "#d97706",             label: "trade" },
    bridge:          { bg: "rgba(217,119,6,0.15)",   color: "#d97706",             label: "bridge" },
    deposit:         { bg: "rgba(217,119,6,0.15)",   color: "#d97706",             label: "deposit" },
    withdrawal:      { bg: "rgba(217,119,6,0.15)",   color: "#d97706",             label: "withdrawal" },
  };
  const s = styles[type] ?? styles.system;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide flex-shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ── Agent filter pill ─────────────────────────────────────────────────────────

function AgentPill({
  agent,
  active,
  onClick,
}: {
  agent: AgentInfo;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150"
      style={
        active
          ? { background: `${agent.color}18`, borderColor: `${agent.color}55`, color: agent.color }
          : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
      }
    >
      <span>{agent.emoji}</span>
      <span>{agent.label}</span>
    </button>
  );
}

// ── Single timeline entry ─────────────────────────────────────────────────────

function ThreadEntry({ event, isLast, agents }: { event: TimelineEvent; isLast: boolean; agents: AgentInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  const agent = getAgent(event.agent, agents);
  const hasDetails = event.description && event.description.length > 0;
  const preview = event.description ? event.description.slice(0, 80) + (event.description.length > 80 ? "…" : "") : null;

  return (
    <div className="flex items-stretch" style={{ minHeight: "72px" }}>
      {/* Left: time column */}
      <div
        className="flex-shrink-0 text-right pr-2 sm:pr-4 pt-1"
        style={{ width: "72px", color: "var(--text-muted)", fontSize: "11px", fontFamily: "monospace" }}
        suppressHydrationWarning
      >
        {formatTime(event.timestamp)}
      </div>

      {/* Center: vertical line + dot */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: "20px" }}>
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 z-10"
          style={{ background: agent.color, boxShadow: `0 0 0 2px var(--bg)` }}
        />
        {!isLast && (
          <div
            className="flex-1 mt-1"
            style={{ width: "1px", background: "var(--border)", minHeight: "24px" }}
          />
        )}
      </div>

      {/* Right: content — clickable to expand */}
      <div
        className="flex-1 pl-5 pb-8 pt-0.5"
        onClick={() => hasDetails && setExpanded(!expanded)}
        style={{ cursor: hasDetails ? "pointer" : "default" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: agent.color }}>
            {agent.emoji} {agent.label}
          </span>
          <TypeBadge type={event.type} />
          <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }} suppressHydrationWarning>
            {ago(event.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {event.title}
        </p>

        {/* Collapsed preview */}
        {!expanded && preview && (
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {preview}
          </p>
        )}

        {/* Expanded detail card */}
        <AnimatePresence>
          {expanded && event.description && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 p-3 rounded-lg text-xs leading-relaxed overflow-hidden"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {event.description}
              <div className="mt-2 pt-2 flex items-center gap-3 text-[10px]" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <span>🤖 {agent.label}</span>
                <span>📋 {event.type}</span>
                <span suppressHydrationWarning>🕐 {new Date(event.timestamp).toLocaleString()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click hint */}
        {hasDetails && !expanded && (
          <span className="text-[10px] mt-1 inline-block" style={{ color: "var(--text-muted)" }}>
            ▸ click to expand
          </span>
        )}
      </div>
    </div>
  );
}

// ── Date group ────────────────────────────────────────────────────────────────

function DateGroup({ label, events, isLastGroup, agents }: { label: string; events: TimelineEvent[]; isLastGroup: boolean; agents: AgentInfo[] }) {
  return (
    <section className="mb-2" aria-label={`Timeline group ${label}`}>
      <div className="flex items-center gap-3 mb-2">
        <div style={{ width: "72px" }} />
        <div style={{ width: "20px" }} />
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ color: "var(--accent)", background: "var(--accent-light)" }}
          >
            {label}
          </span>
        </div>
      </div>

      {events.map((ev, i) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: i * 0.03 }}
        >
          <ThreadEntry event={ev} isLast={isLastGroup && i === events.length - 1} agents={agents} />
        </motion.div>
      ))}
    </section>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center py-20 gap-3"
    >
      <Zap className="w-8 h-8" style={{ color: "var(--border-strong)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {filtered ? "No events match this filter" : "No events yet"}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {filtered
          ? "Try selecting a different agent or clearing filters"
          : "Agent activity will appear here as it happens"}
      </p>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([SYSTEM_AGENT]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<AgentId>>(new Set(["system"]));
  const [refreshLabel, setRefreshLabel] = useState<string>("");
  const [justRefreshed, setJustRefreshed] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  const agentsRef = useRef(agents);
  const eventsRef = useRef(events);
  const didInitFilterFetch = useRef(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const fetchEvents = useCallback(async (opts?: { manual?: boolean }) => {
    const hasExistingData = eventsRef.current.length > 0;
    if (!hasExistingData) setLoading(true);
    setIsRefreshing(true);

    try {
      const selectedNow = selectedRef.current;
      const agentsNow = agentsRef.current;
      const selectedAgents = Array.from(selectedNow);
      const shouldFilter = selectedNow.size > 0 && selectedNow.size < agentsNow.length;

      const qs = new URLSearchParams();
      if (shouldFilter) qs.set("agents", selectedAgents.join(","));
      qs.set("_", Date.now().toString());

      const query = qs.toString();
      const res = await fetch(`/api/timeline${query ? `?${query}` : ""}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const data = await res.json();

      if (Array.isArray(data.agents) && data.agents.length > 0) {
        const nextAgents = data.agents as AgentInfo[];
        setAgents((prev) => (sameAgents(prev, nextAgents) ? prev : nextAgents));
        setSelected((prev) => {
          if (prev.size === 0) return prev;
          const validIds = new Set<string>(nextAgents.map((a: AgentInfo) => a.id));
          const next = new Set<string>(Array.from(prev).filter((id) => validIds.has(id)));
          if (next.size === 0) return new Set<string>(validIds);
          if (next.size === prev.size && Array.from(next).every((id) => prev.has(id))) return prev;
          return next;
        });
      }

      const currentAgents = agentsRef.current;
      const normalized = (data.events ?? [])
        .map((event: RawTimelineEvent) => ({
          ...event,
          agent: normalizeAgentId(event.agent, currentAgents),
        }));

      const sorted = normalized.slice().sort((a: TimelineEvent, b: TimelineEvent) => b.timestamp - a.timestamp);
      setEvents(sorted);

      if (opts?.manual ?? true) {
        setRefreshLabel("Updated just now");
        setJustRefreshed(true);
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => setJustRefreshed(false), 3000);
      }
    } catch {
      /* keep stale data on errors */
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents({ manual: false });
    const t = setInterval(() => fetchEvents({ manual: false }), 30000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  useEffect(() => {
    if (!didInitFilterFetch.current) {
      didInitFilterFetch.current = true;
      return;
    }
    fetchEvents({ manual: false });
  }, [selected, fetchEvents]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  const allSelected = selected.size === agents.length;

  const toggleAgent = (id: AgentId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const grouped = groupByDate(events);
  const isFiltered = selected.size < agents.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="max-w-[960px] mx-auto"
    >
      {/* Sticky header: title + agent filter pills */}
      <div
        className="sticky top-0 z-20 px-8 pt-8 pb-6"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Timeline
            </h1>
          </div>
          {/* Auto-refresh indicator */}
          <AnimatePresence>
            {justRefreshed && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="text-[11px] font-medium"
                style={{ color: "var(--accent)" }}
              >
                {refreshLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Agent activity and events
        </p>

        {/* Agent filter pills + refresh */}
        <div className="flex flex-nowrap sm:flex-wrap items-center gap-2.5 overflow-x-auto pb-1">
        <button
          onClick={() =>
            setSelected(allSelected ? new Set() : new Set(agents.map((a) => a.id)))
          }
          className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
          style={
            allSelected
              ? { background: "var(--accent-light)", borderColor: "var(--accent-border)", color: "var(--accent-text)" }
              : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
          }
        >
          All
        </button>
        {agents.map((a) => (
          <AgentPill key={a.id} agent={a} active={selected.has(a.id)} onClick={() => toggleAgent(a.id)} />
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => fetchEvents({ manual: true })}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-violet-500" : ""}`} />
          </button>
        </div>
        </div>{/* end filter pills */}
      </div>{/* end sticky header */}

      {/* Thread */}
      <div className="px-8 pt-8 pb-8">
      {loading && events.length === 0 && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      )}

      {!loading && events.length === 0 && (
        <EmptyState filtered={isFiltered} />
      )}

      <AnimatePresence>
        {grouped.map((group, gi) => (
          <DateGroup
            key={`${group.label}-${group.sortTs}`}
            label={group.label}
            events={group.events}
            isLastGroup={gi === grouped.length - 1}
            agents={agents}
          />
        ))}
      </AnimatePresence>
      </div>{/* end content */}
    </motion.div>
  );
}
