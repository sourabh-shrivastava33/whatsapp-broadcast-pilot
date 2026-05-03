import React, { useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import Users from "lucide-react/dist/esm/icons/users";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Send from "lucide-react/dist/esm/icons/send";
import Search from "lucide-react/dist/esm/icons/search";
import Filter from "lucide-react/dist/esm/icons/filter";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Zap from "lucide-react/dist/esm/icons/zap";
import Radio from "lucide-react/dist/esm/icons/radio";
import FileText from "lucide-react/dist/esm/icons/file-text";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import Tag from "lucide-react/dist/esm/icons/tag";
import Layers from "lucide-react/dist/esm/icons/layers";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Clock from "lucide-react/dist/esm/icons/clock";
import X from "lucide-react/dist/esm/icons/x";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useBroadcasts } from "../store/BroadcastsContext";
import { useAccounts } from "../store/AccountsContext";
import { useTemplates } from "../store/TemplatesContext";
import { useContacts } from "../store/ContactsContext";
import { useToast } from "../store/ToastContext";
import { TIER_LIMITS_MAP } from "../utils/tierLimits";
import { BroadcastSkeleton } from "./broadcast/BroadcastSkeleton";
import "./Broadcast.css";

// ─── Constants ────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Campaign" },
  { id: 2, label: "Template" },
  { id: 3, label: "Variables" },
  { id: 4, label: "Recipients" },
  { id: 5, label: "Review" },
];

const LEAD_STAGES = ["NEW", "HOT", "COLD", "CLOSED"];

const RECIPIENT_MODES = [
  { key: "all", label: "All Contacts", icon: Users },
  { key: "stage", label: "By Lead Stage", icon: Layers },
  { key: "tag", label: "By Tag", icon: Tag },
];

// ─── WhatsApp Message Preview ─────────────────────────────────────
const WaPreview = React.memo(({ template, vars }) => {
  if (!template) return null;
  const body = (template.body || "").replace(
    /\{\{(\d+)\}\}/g,
    (_, n) => vars[n] || `{{${n}}}`,
  );
  return (
    <div className="wa-preview-wrap">
      <div className="wa-preview-phone">
        <div className="wa-preview-header">
          <div className="wa-preview-avatar" />
          <div>
            <div className="wa-preview-name">{template.name}</div>
            <div className="wa-preview-status">WhatsApp Business</div>
          </div>
        </div>
        <div className="wa-preview-body">
          <div className="wa-bubble">
            {template.headerType === "IMAGE" && template.mediaUrl && (
              <img
                src={template.mediaUrl}
                alt="header"
                className="wa-bubble-img"
              />
            )}
            {template.headerType === "TEXT" && template.headerText && (
              <p className="wa-bubble-header">{template.headerText}</p>
            )}
            <p className="wa-bubble-text">{body}</p>
            {template.footer && (
              <p className="wa-bubble-footer">{template.footer}</p>
            )}
            <span className="wa-bubble-time">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ✓✓
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Step 1: Campaign Setup ────────────────────────────────────────
const StepCampaign = memo(({ draft, onChange }) => {
  return (
    <div className="wiz-step">
      <div className="wiz-step-intro">
        <h3 className="wiz-step-title">Name your campaign</h3>
        <p className="wiz-step-desc">
          Give this broadcast a name so you can identify it in your history.
        </p>
      </div>
      <div className="wiz-field">
        <label className="wiz-label">
          Campaign Name <span className="required">*</span>
        </label>
        <input
          className="wiz-input"
          placeholder="e.g. July Property Launch – Buyers"
          value={draft.campaignName}
          onChange={(e) => onChange({ campaignName: e.target.value })}
          maxLength={80}
          autoFocus
        />
        <span className="wiz-hint">{draft.campaignName.length}/80</span>
      </div>
      <div className="wiz-field">
        <label className="wiz-label">
          Description <span className="optional">(optional)</span>
        </label>
        <textarea
          className="wiz-input wiz-textarea"
          placeholder="Internal note about this campaign…"
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
});

// ─── Step 2: Template ─────────────────────────────────────────────
const StepTemplate = memo(({ draft, onChange, templates }) => {
  const [search, setSearch] = useState("");
  const approved = useMemo(
    () => templates.filter((t) => t.status === "approved"),
    [templates],
  );
  const filtered = useMemo(
    () =>
      approved.filter(
        (t) =>
          !search ||
          (t.name || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [approved, search],
  );
  const selected = useMemo(
    () => templates.find((t) => t.id === draft.templateId),
    [templates, draft.templateId],
  );

  return (
    <div className="wiz-step wiz-split">
      <div className="wiz-split-left">
        <div className="wiz-step-intro">
          <h3 className="wiz-step-title">Choose a template</h3>
          <p className="wiz-step-desc">
            Only approved templates can be used for broadcasts.
          </p>
        </div>
        <div className="wiz-search-wrap">
          <Search size={14} className="wiz-search-icon" />
          <input
            className="wiz-input wiz-search"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="wiz-empty">No approved templates found.</p>
        ) : (
          <div className="wiz-list">
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`wiz-list-item ${draft.templateId === t.id ? "selected" : ""}`}
                onClick={() =>
                  onChange({ templateId: t.id, variableValues: {} })
                }
              >
                <div className="wiz-list-item-body">
                  <span className="wiz-list-title">{t.name}</span>
                  <div className="wiz-list-meta">
                    <span className="chip-xs">{t.category}</span>
                    <span className="chip-xs">{t.language}</span>
                  </div>
                </div>
                {draft.templateId === t.id && (
                  <CheckCircle size={16} className="check-icon" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="wiz-split-right">
        <p className="wiz-preview-label">Live Preview</p>
        {selected ? (
          <WaPreview template={selected} vars={draft.variableValues} />
        ) : (
          <div className="wiz-preview-empty">
            <MessageSquare size={32} />
            <span>Select a template to preview</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Step 3: Variables ────────────────────────────────────────────
const StepVariables = memo(({ draft, onChange, templates }) => {
  const tpl = useMemo(
    () => templates.find((t) => t.id === draft.templateId),
    [templates, draft.templateId],
  );
  const vars = useMemo(
    () => (Array.isArray(tpl?.variables) ? tpl.variables : []),
    [tpl],
  );

  if (vars.length === 0)
    return (
      <div className="wiz-step wiz-center">
        <CheckCircle size={40} className="step-ok-icon" />
        <h3 className="wiz-step-title">No variables needed</h3>
        <p className="wiz-step-desc">
          This template has no dynamic variables. Continue to select recipients.
        </p>
      </div>
    );

  return (
    <div className="wiz-step wiz-split">
      <div className="wiz-split-left">
        <div className="wiz-step-intro">
          <h3 className="wiz-step-title">Fill in template variables</h3>
          <p className="wiz-step-desc">
            These values will be sent to all recipients. Use placeholders like{" "}
            <code>{"{{name}}"}</code> for personalisation in the future.
          </p>
        </div>
        <div className="wiz-vars-list">
          {vars
            .sort((a, b) => Number(a.num) - Number(b.num))
            .map((v) => (
              <div className="wiz-field" key={v.num}>
                <label className="wiz-label">
                  Variable {`{{${v.num}}}`}{" "}
                  <span className="optional">— sample: {v.sample}</span>
                </label>
                <input
                  className="wiz-input"
                  placeholder={v.sample || `Value for {{${v.num}}}`}
                  value={draft.variableValues[String(v.num)] || ""}
                  onChange={(e) =>
                    onChange({
                      variableValues: {
                        ...draft.variableValues,
                        [String(v.num)]: e.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
        </div>
      </div>
      <div className="wiz-split-right">
        <p className="wiz-preview-label">Live Preview</p>
        <WaPreview template={tpl} vars={draft.variableValues} />
      </div>
    </div>
  );
});

// ─── Step 4: Recipients ───────────────────────────────────────────
const StepRecipients = memo(({ draft, onChange, contacts, activeAccounts }) => {
  const [mode, setMode] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedStages, setSelectedStages] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  const allTags = useMemo(() => {
    const s = new Set();
    contacts.forEach((c) => (c.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = contacts.filter((c) => c.optInStatus !== "opted_out");
    if (mode === "stage" && selectedStages.length > 0)
      list = list.filter((c) => selectedStages.includes(c.leadStage));
    if (mode === "tag" && selectedTags.length > 0)
      list = list.filter((c) =>
        (c.tags || []).some((t) => selectedTags.includes(t)),
      );
    if (search)
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search),
      );
    return list;
  }, [contacts, mode, selectedStages, selectedTags, search]);

  const combinedLimit = useMemo(
    () =>
      activeAccounts.reduce((s, a) => {
        const lim = TIER_LIMITS_MAP[a.messagingLimitTier] ?? 1000;
        return lim === Infinity ? Infinity : s + lim;
      }, 0),
    [activeAccounts],
  );

  const exceedsLimit =
    combinedLimit !== Infinity && draft.contactIds.length > combinedLimit;

  const toggle = useCallback(
    (id) => {
      const has = draft.contactIds.includes(id);
      onChange({
        contactIds: has
          ? draft.contactIds.filter((x) => x !== id)
          : [...draft.contactIds, id],
      });
    },
    [draft.contactIds, onChange],
  );

  const selectAll = useCallback(
    () => onChange({ contactIds: filtered.map((c) => c.id) }),
    [filtered, onChange],
  );
  const clearAll = useCallback(() => onChange({ contactIds: [] }), [onChange]);

  return (
    <div className="wiz-step">
      <div className="wiz-step-intro">
        <h3 className="wiz-step-title">Select recipients</h3>
        <p className="wiz-step-desc">
          Opted-out contacts are automatically excluded.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mode-tabs">
        {RECIPIENT_MODES.map((m) => (
          <button
            key={m.key}
            className={`mode-tab ${mode === m.key ? "active" : ""}`}
            onClick={() => {
              setMode(m.key);
              onChange({ contactIds: [] });
            }}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Stage filters */}
      {mode === "stage" && (
        <div className="filter-chips">
          {LEAD_STAGES.map((s) => (
            <button
              key={s}
              className={`filter-chip chip-lead-${s} ${selectedStages.includes(s) ? "chip-active" : ""}`}
              onClick={() =>
                setSelectedStages((p) =>
                  p.includes(s) ? p.filter((x) => x !== s) : [...p, s],
                )
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Tag filters */}
      {mode === "tag" && (
        <div className="filter-chips">
          {allTags.length === 0 ? (
            <span className="wiz-empty-sm">No tags found on contacts.</span>
          ) : (
            allTags.map((t) => (
              <button
                key={t}
                className={`filter-chip ${selectedTags.includes(t) ? "chip-active" : ""}`}
                onClick={() =>
                  setSelectedTags((p) =>
                    p.includes(t) ? p.filter((x) => x !== t) : [...p, t],
                  )
                }
              >
                <Tag size={11} />
                {t}
              </button>
            ))
          )}
        </div>
      )}

      {/* Search + select all */}
      <div className="wiz-contacts-toolbar">
        <div className="wiz-search-wrap">
          <Search size={14} className="wiz-search-icon" />
          <input
            className="wiz-input wiz-search"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-text" onClick={selectAll}>
          Select All ({filtered.length})
        </button>
        <button className="btn-text" onClick={clearAll}>
          Clear
        </button>
      </div>

      {/* Count + limit warning */}
      <div className={`recipient-count-bar ${exceedsLimit ? "danger" : ""}`}>
        <span>
          <strong>{draft.contactIds.length}</strong> selected ·{" "}
          {filtered.length} available
        </span>
        {exceedsLimit && (
          <span className="limit-warn">
            <AlertCircle size={13} /> Exceeds combined tier limit (
            {combinedLimit.toLocaleString()})
          </span>
        )}
      </div>

      {/* Contact list */}
      <div className="wiz-contact-list">
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`wiz-contact-row ${draft.contactIds.includes(c.id) ? "selected" : ""}`}
            onClick={() => toggle(c.id)}
          >
            <div
              className={`wiz-checkbox ${draft.contactIds.includes(c.id) ? "checked" : ""}`}
            >
              {draft.contactIds.includes(c.id) && (
                <CheckCircle size={12} strokeWidth={3} />
              )}
            </div>
            <div className="wiz-contact-avatar">
              {(c.name?.[0] || "?").toUpperCase()}
            </div>
            <div className="wiz-contact-info">
              <span className="wiz-contact-name">{c.name || "Unknown"}</span>
              <span className="wiz-contact-phone">{c.phone}</span>
            </div>
            {c.leadStage && (
              <span className={`chip-xs chip-lead-${c.leadStage}`}>
                {c.leadStage}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Step 5: Review ───────────────────────────────────────────────
const StepReview = memo(
  ({
    draft,
    templates,
    contacts,
    activeAccounts,
    sending,
    onSend,
    TIER_MAP,
  }) => {
    const tpl = useMemo(
      () => templates.find((t) => t.id === draft.templateId),
      [templates, draft.templateId],
    );
    const [confirm, setConfirm] = useState("");
    const needsConfirm = draft.contactIds.length >= 1000;
    const canSend = !needsConfirm || confirm === draft.campaignName;

    const partitions = useMemo(() => {
      const total = activeAccounts.reduce((s, a) => {
        const lim = TIER_MAP[a.messagingLimitTier] ?? 1000;
        return lim === Infinity ? Infinity : s + lim;
      }, 0);
      let rem = draft.contactIds.length;
      return activeAccounts.map((acc, i) => {
        const lim = TIER_MAP[acc.messagingLimitTier] ?? 1000;
        const isLast = i === activeAccounts.length - 1;
        const count = isLast
          ? rem
          : Math.min(Math.round(draft.contactIds.length * (lim / total)), rem);
        rem -= count;
        return { acc, count };
      });
    }, [activeAccounts, draft.contactIds.length, TIER_MAP]);

    const estimatedMinutes = Math.ceil(draft.contactIds.length / 80 / 60);

    if (sending === "success")
      return (
        <div className="wiz-step wiz-center fade-in">
          <div className="success-ring">
            <CheckCircle size={44} />
          </div>
          <h3 className="wiz-step-title">Broadcast Queued!</h3>
          <p className="wiz-step-desc">
            {draft.contactIds.length} messages are being sent via{" "}
            {activeAccounts.length} account
            {activeAccounts.length !== 1 ? "s" : ""}.
          </p>
        </div>
      );

    return (
      <div className="wiz-step">
        <div className="wiz-step-intro">
          <h3 className="wiz-step-title">Review & Send</h3>
          <p className="wiz-step-desc">
            Double-check everything before firing.
          </p>
        </div>

        <div className="review-grid">
          <div className="review-card">
            <span className="review-label">Campaign</span>
            <span className="review-value">{draft.campaignName}</span>
          </div>
          <div className="review-card">
            <span className="review-label">Template</span>
            <span className="review-value">{tpl?.name}</span>
          </div>
          <div className="review-card">
            <span className="review-label">Recipients</span>
            <span className="review-value">
              {draft.contactIds.length} contacts
            </span>
          </div>
          <div className="review-card">
            <span className="review-label">Est. Send Time</span>
            <span className="review-value">~{estimatedMinutes} min</span>
          </div>
        </div>

        {/* Account distribution */}
        <div className="distribution-block">
          <p className="distribution-title">Account Distribution</p>
          {partitions.map(({ acc, count }) => (
            <div key={acc.id} className="distribution-row">
              <div className="dist-info">
                <Smartphone size={13} />
                <span>{acc.displayPhoneNumber || acc.phoneNumberId}</span>
                <span className="dist-tier">
                  {acc.messagingLimitTier?.replace("TIER_", "") || "?"}
                </span>
              </div>
              <span className="dist-count">
                {count.toLocaleString()} messages
              </span>
            </div>
          ))}
        </div>

        {/* Compliance checklist */}
        <div className="compliance-check">
          <div className="comp-row">
            <ShieldCheck size={14} className="comp-ok" />
            <span>Template is approved by Meta</span>
          </div>
          <div className="comp-row">
            <ShieldCheck size={14} className="comp-ok" />
            <span>Opted-out contacts excluded</span>
          </div>
          <div className="comp-row">
            <ShieldCheck size={14} className="comp-ok" />
            <span>Within combined tier limit</span>
          </div>
        </div>

        {/* Large send confirmation */}
        {needsConfirm && (
          <div className="confirm-block">
            <p className="confirm-label">
              Type <strong>{draft.campaignName}</strong> to confirm this large
              send:
            </p>
            <input
              className="wiz-input"
              placeholder="Type campaign name…"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}

        <Button
          variant="primary"
          icon={Send}
          onClick={onSend}
          disabled={!canSend || sending === "sending"}
          style={{
            width: "100%",
            marginTop: "var(--space-md)",
            justifyContent: "center",
            height: 48,
          }}
        >
          {sending === "sending"
            ? "Sending…"
            : `Send to ${draft.contactIds.length} Contacts`}
        </Button>
      </div>
    );
  },
);

// ─── Main Page ────────────────────────────────────────────────────
const INITIAL_DRAFT = {
  campaignName: "",
  description: "",
  templateId: null,
  variableValues: {},
  contactIds: [],
};

export default function Broadcast() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState("idle");
  const [draft, setDraft] = useState(INITIAL_DRAFT);

  const { broadcasts, loading, addBroadcast } = useBroadcasts();
  const { activeAccounts } = useAccounts();
  const { templates } = useTemplates();
  const { contacts } = useContacts();
  const { toast } = useToast();

  const TIER_MAP = useMemo(
    () => ({
      TIER_NOT_SET: 250,
      TIER_100: 100,
      TIER_1K: 1000,
      TIER_10K: 10000,
      TIER_100K: 100000,
      TIER_UNLIMITED: Infinity,
    }),
    [],
  );

  const tpl = useMemo(
    () => templates.find((t) => t.id === draft.templateId),
    [templates, draft.templateId],
  );
  const hasVars = useMemo(
    () => Array.isArray(tpl?.variables) && tpl.variables.length > 0,
    [tpl],
  );

  const merge = useCallback(
    (patch) => setDraft((p) => ({ ...p, ...patch })),
    [],
  );

  const reset = useCallback(() => {
    setShowModal(false);
    setStep(1);
    setSending("idle");
    setDraft(INITIAL_DRAFT);
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) return draft.campaignName.trim().length >= 2;
    if (step === 2) return !!draft.templateId;
    if (step === 3) return true; // variables optional
    if (step === 4) return draft.contactIds.length > 0;
    return false;
  }, [step, draft]);

  // Skip variables step if template has none
  const nextStep = useCallback(() => {
    if (step === 2 && !hasVars) {
      setStep(4);
      return;
    }
    if (step < STEPS.length) setStep((s) => s + 1);
  }, [step, hasVars]);

  const prevStep = useCallback(() => {
    if (step === 4 && !hasVars) {
      setStep(2);
      return;
    }
    if (step > 1) setStep((s) => s - 1);
  }, [step, hasVars]);

  const handleSend = async () => {
    if (sending !== "idle") return;
    setSending("sending");
    try {
      await addBroadcast({
        templateId: draft.templateId,
        contactIds: draft.contactIds,
        variableValues: draft.variableValues,
        campaignName: draft.campaignName,
      });
      setSending("success");
      toast({
        type: "success",
        title: "Broadcast queued!",
        message: `${draft.contactIds.length} messages queued.`,
      });
    } catch {
      setSending("idle");
      toast({
        type: "error",
        title: "Failed",
        message: "Could not start broadcast.",
      });
    }
  };

  const visibleSteps = useMemo(
    () => (hasVars ? STEPS : STEPS.filter((s) => s.id !== 3)),
    [hasVars],
  );

  if (loading) {
    return <BroadcastSkeleton />;
  }

  return (
    <div className="page fade-in broadcast-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Broadcast</h1>
          <p className="page-subtitle">
            {broadcasts.length > 0
              ? `${broadcasts.length} campaign${broadcasts.length !== 1 ? "s" : ""} sent`
              : "Send approved templates to segmented contacts at scale"}
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={Zap}
            onClick={() => setShowModal(true)}
          >
            New Broadcast
          </Button>
        </div>
      </div>

      {broadcasts.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No broadcasts yet"
          description="Create a broadcast campaign to reach your leads at scale. Uses Meta-approved templates with smart account distribution."
          actionLabel="New Broadcast"
          actionIcon={Zap}
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="broadcasts-list">
          {broadcasts.map((b) => (
            <div
              key={b.id}
              className="broadcast-row clickable"
              onClick={() => navigate(`/broadcast/${b.id}`)}
            >
              <div className="broadcast-row-icon">
                <Radio size={18} />
              </div>
              <div className="broadcast-row-info">
                <div className="broadcast-row-title">
                  {b.results?.campaignName ||
                    (b.contactIds
                      ? `Broadcast · ${b.contactIds.length} recipients`
                      : "Broadcast · recipients unknown")}
                </div>
                <div className="broadcast-row-date">
                  <Clock size={12} />{" "}
                  {b.createdAt || b.sentAt
                    ? new Date(b.createdAt || b.sentAt).toLocaleString()
                    : "No date available"}
                </div>
              </div>
              <div className="broadcast-row-status-group">
                <div className="broadcast-stats-mini">
                  <span title="Sent">
                    <Send size={10} />
                    {b.results?.success || 0}
                  </span>
                  <span
                    title="Failed"
                    style={{ color: "var(--status-rejected)" }}
                  >
                    <AlertCircle size={10} />
                    {b.results?.failed || 0}
                  </span>
                </div>
                <span className={`chip chip-${b.status}`}>
                  <span className="chip-dot" />
                  {b.status}
                </span>
                <ExternalLink size={14} className="row-hover-icon" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Broadcast Wizard Modal ────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={reset}>
          <div
            className="modal broadcast-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <div>
                <h2 className="modal-title">New Broadcast</h2>
                {draft.campaignName && (
                  <p className="modal-subtitle">{draft.campaignName}</p>
                )}
              </div>
              <button
                className="modal-close"
                onClick={reset}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step progress bar */}
            <div className="wiz-progress-bar">
              {visibleSteps.map((s, idx) => {
                const actualStep = s.id;
                const isDone =
                  step > actualStep ||
                  (step === 4 && !hasVars && actualStep === 4);
                const isCurrent = step === actualStep;
                return (
                  <React.Fragment key={s.id}>
                    <div
                      className={`wiz-progress-step ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}
                    >
                      <div className="wiz-progress-dot">
                        {isDone ? (
                          <CheckCircle size={12} />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span className="wiz-progress-label">{s.label}</span>
                    </div>
                    {idx < visibleSteps.length - 1 && (
                      <div
                        className={`wiz-progress-line ${isDone ? "done" : ""}`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step content */}
            <div className="modal-body wiz-body">
              {step === 1 && <StepCampaign draft={draft} onChange={merge} />}
              {step === 2 && (
                <StepTemplate
                  draft={draft}
                  onChange={merge}
                  templates={templates}
                />
              )}
              {step === 3 && hasVars && (
                <StepVariables
                  draft={draft}
                  onChange={merge}
                  templates={templates}
                />
              )}
              {step === 4 && (
                <StepRecipients
                  draft={draft}
                  onChange={merge}
                  contacts={contacts}
                  activeAccounts={activeAccounts}
                />
              )}
              {step === 5 && (
                <StepReview
                  draft={draft}
                  templates={templates}
                  contacts={contacts}
                  activeAccounts={activeAccounts}
                  sending={sending}
                  onSend={handleSend}
                  TIER_MAP={TIER_MAP}
                />
              )}
            </div>

            {/* Footer */}
            {sending !== "success" && step < 5 && (
              <div className="modal-footer">
                <div>
                  {step > 1 && (
                    <Button variant="ghost" icon={ArrowLeft} onClick={prevStep}>
                      Back
                    </Button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  <Button variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    icon={ArrowRight}
                    onClick={nextStep}
                    disabled={!canNext}
                    iconPosition="right"
                  >
                    {step === 4 ? "Review" : "Continue"}
                  </Button>
                </div>
              </div>
            )}
            {sending === "success" && (
              <div
                className="modal-footer"
                style={{ justifyContent: "center" }}
              >
                <Button variant="primary" onClick={reset}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
