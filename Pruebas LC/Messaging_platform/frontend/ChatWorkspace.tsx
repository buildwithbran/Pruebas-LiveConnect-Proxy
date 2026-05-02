import React, { memo, useEffect, useId, useRef, useState } from "react";

export type Conversation = {
  id: string;
  title: string;
  meta: string;
  unread?: number;
};

export type Message = {
  id: string;
  sender: "client" | "agent" | "system";
  body: string;
  timestamp: string;
  isNew?: boolean;
};

type DropdownAction = {
  id: string;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

type SidebarProps = {
  statusLabel?: string;
};

type ConversationItemProps = {
  conversation: Conversation;
  active: boolean;
  onSelect?: (conversationId: string) => void;
};

type HeaderProps = {
  title: string;
  meta: string;
  canAct: boolean;
  onOpenSettings?: () => void;
  onTransfer?: () => void;
  actions: DropdownAction[];
  onToggleMobileNav: () => void;
};

export type ChatWorkspaceProps = {
  conversations: Conversation[];
  activeConversationId?: string;
  messages: Message[];
  onSelectConversation?: (conversationId: string) => void;
  onSendMessage?: (value: string) => void;
  onOpenSettings?: () => void;
  onTransfer?: () => void;
  onArchive?: () => void;
  onMarkRead?: () => void;
  onOpenQuickAnswer?: () => void;
  onOpenFileComposer?: () => void;
  onCheckBalance?: () => void;
  rightPanel?: React.ReactNode;
};

const inboxTokens = {
  "--inbox-bg": "#0b1220",
  "--inbox-surface": "rgba(255,255,255,0.04)",
  "--inbox-border": "rgba(255,255,255,0.08)",
  "--inbox-hover": "rgba(255,255,255,0.08)",
  "--inbox-active": "rgba(59,130,246,0.15)",
  "--inbox-text-primary": "#ffffff",
  "--inbox-text-secondary": "rgba(255,255,255,0.6)",
  "--inbox-space-2": "8px",
  "--inbox-space-3": "12px",
  "--inbox-space-4": "16px",
  "--inbox-space-6": "24px",
} as React.CSSProperties;

const dayFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
});

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getDayKey(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toDateString();
}

function formatDay(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : dayFormatter.format(date);
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
}

export const Sidebar = memo(function Sidebar({ statusLabel = "Conectado" }: SidebarProps) {
  return (
    <section className="flex h-full flex-col gap-[var(--inbox-space-4)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)]">
      <div className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)] shadow-[0_12px_30px_rgba(2,6,23,0.24)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">LiveConnect</p>
        <h1 className="mt-[var(--inbox-space-3)] text-3xl font-semibold leading-none tracking-tight text-[color:var(--inbox-text-primary)]">
          Proxy Inbox
        </h1>
        <p className="mt-[var(--inbox-space-4)] text-sm leading-6 text-[color:var(--inbox-text-secondary)]">
          Centro operativo con layout estable, scroll interno y acciones agrupadas para conversaciones en tiempo real.
        </p>
      </div>

      <div className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)] shadow-[0_12px_30px_rgba(2,6,23,0.24)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Conexión SSE</p>
        <div className="mt-[var(--inbox-space-3)] flex items-center gap-[var(--inbox-space-2)]">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-[color:var(--inbox-text-primary)]">{statusLabel}</span>
        </div>
        <p className="mt-[var(--inbox-space-3)] text-sm text-[color:var(--inbox-text-secondary)]">
          Sidebar y conversaciones comparten el mismo surface para que el inbox se sienta como un sistema, no como paneles sueltos.
        </p>
      </div>
    </section>
  );
});

export const ConversationItem = memo(function ConversationItem({
  conversation,
  active,
  onSelect,
}: ConversationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(conversation.id)}
      className={cx(
        "group relative grid gap-[var(--inbox-space-2)] rounded-lg border border-transparent px-[var(--inbox-space-4)] py-[var(--inbox-space-4)] text-left transition duration-200",
        "hover:bg-[var(--inbox-hover)] hover:shadow-[0_12px_30px_rgba(2,6,23,0.24)]",
        active && "border-blue-500/30 bg-[var(--inbox-active)] shadow-[0_12px_30px_rgba(2,6,23,0.24)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-y-3 left-0 w-0.5 rounded-full bg-transparent transition-colors",
          active && "bg-blue-500",
        )}
      />
      <div className="flex items-start justify-between gap-[var(--inbox-space-3)]">
        <span className={cx("truncate text-sm font-semibold", active ? "text-white" : "text-[color:var(--inbox-text-primary)]")}>
          {conversation.title}
        </span>
        {!!conversation.unread && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-bold text-blue-200">
            {conversation.unread}
          </span>
        )}
      </div>
      <p className={cx("truncate text-xs leading-5", active ? "text-white/85" : "text-[color:var(--inbox-text-secondary)]")}>
        {conversation.meta}
      </p>
    </button>
  );
});

export function DropdownActions({ actions }: { actions: DropdownAction[] }) {
  const [open, setOpen] = useState(false);
  const dropdownId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={dropdownId}
        className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] text-sm font-medium text-[color:var(--inbox-text-primary)] transition hover:bg-[var(--inbox-hover)]"
      >
        ⋯ Acciones
      </button>

      <div
        id={dropdownId}
        role="menu"
        aria-hidden={!open}
        className={cx(
          "absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-[#111827] p-2 shadow-lg transition duration-150",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            onClick={() => {
              if (action.disabled) return;
              action.onSelect?.();
              setOpen(false);
            }}
            className={cx(
              "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
              action.tone === "danger"
                ? "text-rose-200 hover:bg-rose-500/10"
                : "text-white hover:bg-white/5",
              action.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Header({
  title,
  meta,
  canAct,
  onOpenSettings,
  onTransfer,
  actions,
  onToggleMobileNav,
}: HeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-[var(--inbox-space-4)] border-b border-[color:var(--inbox-border)] bg-[rgba(11,18,32,0.92)] px-[var(--inbox-space-4)] py-[var(--inbox-space-4)] backdrop-blur md:flex-row md:items-start md:justify-between md:px-[var(--inbox-space-6)]">
      <div className="flex min-w-0 items-start gap-[var(--inbox-space-3)]">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] text-white md:hidden"
        >
          ☰
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Inbox operativo</p>
          <h2 className="mt-[var(--inbox-space-2)] text-2xl font-semibold leading-none tracking-tight text-white md:text-[2rem]">
            {title}
          </h2>
          <p className="mt-[var(--inbox-space-2)] text-sm text-[color:var(--inbox-text-secondary)]">{meta}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--inbox-space-3)]">
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] text-sm font-medium text-white transition hover:bg-[var(--inbox-hover)]"
        >
          Configuración
        </button>
        <button
          type="button"
          disabled={!canAct}
          onClick={onTransfer}
          className="rounded-lg bg-blue-500 px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Transferir
        </button>
        <DropdownActions actions={actions} />
      </div>
    </header>
  );
}

const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  if (message.sender === "system") {
    return (
      <article className="mx-auto grid max-w-xl gap-[var(--inbox-space-2)] rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] text-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--inbox-text-secondary)]">Sistema</span>
        <p className="text-sm leading-6 text-white">{message.body}</p>
        <span className="text-xs text-[color:var(--inbox-text-secondary)]">{formatTime(message.timestamp)}</span>
      </article>
    );
  }

  const isClient = message.sender === "client";

  return (
    <article
      className={cx(
        "flex max-w-[70%] flex-col gap-[var(--inbox-space-2)] rounded-2xl border px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] shadow-[0_12px_30px_rgba(2,6,23,0.24)] transition",
        isClient
          ? "mr-auto rounded-tl-md border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] text-white"
          : "ml-auto rounded-tr-md border-blue-400/20 bg-blue-500/10 text-white",
        message.isNew && "ring-1 ring-blue-400/40",
      )}
    >
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
      <span className="text-right text-xs text-[color:var(--inbox-text-secondary)]">{formatTime(message.timestamp)}</span>
    </article>
  );
});

export default function ChatWorkspace({
  conversations,
  activeConversationId,
  messages,
  onSelectConversation,
  onSendMessage,
  onOpenSettings,
  onTransfer,
  onArchive,
  onMarkRead,
  onOpenQuickAnswer,
  onOpenFileComposer,
  onCheckBalance,
  rightPanel,
}: ChatWorkspaceProps) {
  const [draft, setDraft] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesRef.current || !stickToBottom) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, stickToBottom]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) || null;

  const groupedTimeline: Array<{ type: "day"; id: string; label: string } | { type: "message"; message: Message }> = [];
  let previousDay = "";

  messages.forEach((message) => {
    const nextDay = getDayKey(message.timestamp);
    if (nextDay !== previousDay) {
      groupedTimeline.push({
        type: "day",
        id: `${message.id}-day`,
        label: formatDay(message.timestamp),
      });
      previousDay = nextDay;
    }
    groupedTimeline.push({ type: "message", message });
  });

  const dropdownActions: DropdownAction[] = [
    { id: "balance", label: "Saldo", onSelect: onCheckBalance },
    { id: "archive", label: "Archivar / Desarchivar", onSelect: onArchive, disabled: !activeConversation },
    { id: "mark-read", label: "Marcar como leído", onSelect: onMarkRead, disabled: !activeConversation },
    { id: "quick-answer", label: "QuickAnswer", onSelect: onOpenQuickAnswer, disabled: !activeConversation },
    { id: "file", label: "Enviar archivo", onSelect: onOpenFileComposer, disabled: !activeConversation },
  ];

  const conversationRail = (
    <aside className="flex min-h-0 flex-col border-r border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] md:w-80">
      <div className="border-b border-[color:var(--inbox-border)] px-[var(--inbox-space-4)] py-[var(--inbox-space-4)]">
        <div className="flex items-center justify-between gap-[var(--inbox-space-3)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Conversaciones</p>
            <p className="mt-[var(--inbox-space-2)] text-sm text-[color:var(--inbox-text-secondary)]">Tiempo real</p>
          </div>
          <span className="rounded-full border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-1 text-xs text-[color:var(--inbox-text-secondary)]">
            {conversations.length}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-[var(--inbox-space-3)]">
        <div className="grid gap-[var(--inbox-space-2)]">
          {conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeConversationId}
              onSelect={(conversationId) => {
                onSelectConversation?.(conversationId);
                setMobileNavOpen(false);
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div style={inboxTokens} className="h-screen overflow-hidden bg-[var(--inbox-bg)] text-[color:var(--inbox-text-primary)]">
      <div className="md:hidden">
        <div
          className={cx(
            "fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm transition",
            mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={cx(
            "fixed inset-y-0 left-0 z-40 flex w-80 max-w-[calc(100vw-32px)] -translate-x-full flex-col overflow-hidden border-r border-[color:var(--inbox-border)] bg-[var(--inbox-bg)] transition",
            mobileNavOpen && "translate-x-0",
          )}
        >
          <Sidebar />
          {conversationRail}
        </div>
      </div>

      <div className="grid h-full grid-cols-1 md:grid-cols-[20rem_20rem_minmax(0,1fr)] xl:grid-cols-[20rem_20rem_minmax(0,1fr)_18rem]">
        <aside className="hidden md:flex md:min-h-0 md:flex-col md:border-r md:border-[color:var(--inbox-border)]">
          <Sidebar />
        </aside>

        <div className="hidden md:block md:min-h-0">{conversationRail}</div>

        <main className="flex min-h-0 flex-col xl:border-r xl:border-[color:var(--inbox-border)]">
          <Header
            title={activeConversation?.title || "Selecciona una conversación"}
            meta={
              activeConversation?.meta ||
              "Mantén el input visible, agrupa acciones y usa el timeline como único scroll del chat."
            }
            canAct={Boolean(activeConversation)}
            onOpenSettings={onOpenSettings}
            onTransfer={onTransfer}
            actions={dropdownActions}
            onToggleMobileNav={() => setMobileNavOpen((current) => !current)}
          />

          <section className="flex min-h-0 flex-1 flex-col gap-[var(--inbox-space-3)] p-[var(--inbox-space-3)] md:p-[var(--inbox-space-4)]">
            <div
              ref={messagesRef}
              onScroll={(event) => {
                const node = event.currentTarget;
                const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 24;
                setStickToBottom(atBottom);
              }}
              className="flex-1 overflow-y-auto rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)]"
            >
              <div className="grid gap-[var(--inbox-space-4)]">
                {groupedTimeline.map((item) =>
                  item.type === "day" ? (
                    <div
                      key={item.id}
                      className="mx-auto rounded-full border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[color:var(--inbox-text-secondary)]"
                    >
                      {item.label}
                    </div>
                  ) : (
                    <MessageBubble key={item.message.id} message={item.message} />
                  ),
                )}
              </div>
            </div>

            <footer className="shrink-0 rounded-lg border border-[color:var(--inbox-border)] bg-[rgba(11,18,32,0.92)] p-[var(--inbox-space-3)]">
              <div className="mb-[var(--inbox-space-2)] text-xs text-[color:var(--inbox-text-secondary)]">
                Respuesta fija al fondo. El layout no depende del crecimiento del historial.
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-[var(--inbox-space-3)]">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || !draft.trim()) return;
                    onSendMessage?.(draft.trim());
                    setDraft("");
                  }}
                  placeholder="Escribe un mensaje..."
                  className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-bg)] px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] text-sm text-white outline-none placeholder:text-white/35 focus:border-blue-400/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!draft.trim()) return;
                    onSendMessage?.(draft.trim());
                    setDraft("");
                  }}
                  className="rounded-lg bg-blue-500 px-[var(--inbox-space-4)] py-[var(--inbox-space-3)] text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                  Enviar
                </button>
              </div>
            </footer>
          </section>
        </main>

        <aside className="hidden min-h-0 xl:flex xl:flex-col xl:bg-[var(--inbox-surface)] xl:p-[var(--inbox-space-4)]">
          {rightPanel || (
            <div className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)] shadow-[0_12px_30px_rgba(2,6,23,0.24)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Panel derecho</p>
              <h3 className="mt-[var(--inbox-space-3)] text-lg font-semibold text-white">Contexto</h3>
              <div className="mt-[var(--inbox-space-4)] grid gap-[var(--inbox-space-3)]">
                <div className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)] text-sm text-[color:var(--inbox-text-secondary)]">
                  Este panel queda aislado del timeline para que filtros, metadata o SLA no empujen el input.
                </div>
                <div className="rounded-lg border border-[color:var(--inbox-border)] bg-[var(--inbox-surface)] p-[var(--inbox-space-4)] text-sm text-[color:var(--inbox-text-secondary)]">
                  En desktop convive con el chat. En tablet se puede ocultar sin romper el flujo principal.
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
