import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Copy, Check, ArrowLeft, Loader2, FileText,
  Trash2, RefreshCcw, BookOpen, AlertCircle, ChevronDown, ChevronUp,
  ChevronsDown, Pencil, X, Save
} from "lucide-react";
import { useOrganizeText } from "@workspace/api-client-react";
import { CustomButton } from "@/components/ui/custom-button";

type Section = { title: string; content: string };
type ExplainState = "idle" | "loading" | "done" | "error";

interface MCQState {
  content: string;
  explanation: string | null;
  state: ExplainState;
  error: string | null;
  isEditing: boolean;
  editDraft: string;
}

interface SectionState {
  section: Section;
  mcqs: MCQState[];
  collapsed: boolean;
}

// ── MCQ parser ────────────────────────────────────────────────────────────────
// Splits section content into individual MCQ blocks.
// A new MCQ starts when a line begins with a Bengali or Arabic numeral followed by . ) or ।
function parseMCQs(content: string): string[] {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  const startsNewMCQ = (line: string): boolean =>
    /^[\s]*[০-৯0-9]{1,3}[.)।]/.test(line.trim()) && line.trim().length > 3;

  for (const line of lines) {
    if (startsNewMCQ(line) && current.some((l) => l.trim())) {
      blocks.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim())) {
    blocks.push(current.join("\n").trim());
  }

  const result = blocks.filter((b) => b.trim());
  // If only one block (couldn't split), return as-is
  return result.length > 0 ? result : [content.trim()];
}

// ── API helper ────────────────────────────────────────────────────────────────
async function fetchExplanations(
  sections: { title: string; content: string }[]
): Promise<{ explanation: string }[]> {
  const res = await fetch("/api/text/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  const data = await res.json();
  return data.sections;
}

// ── Explained content renderer ────────────────────────────────────────────────
function ExplainedContent({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-0.5">
      {text.split("\n").map((line, i) => {
        const isExp = line.trimStart().startsWith("✒️");
        return (
          <div
            key={i}
            className={
              isExp
                ? "text-amber-800 bg-amber-50 rounded px-2 py-0.5 border-l-2 border-amber-300 my-1"
                : "text-foreground"
            }
          >
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [text, setText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);

  const {
    mutate: organize,
    isPending: isOrganizing,
    data: organizeData,
    reset: resetOrganize,
    error: organizeError,
  } = useOrganizeText();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mcqRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoScrollActive = useRef(false);

  useEffect(() => {
    if (!organizeData && !isOrganizing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [organizeData, isOrganizing]);

  useEffect(() => {
    if (organizeData?.sections) {
      setSectionStates(
        organizeData.sections.map((s) => ({
          section: s,
          mcqs: parseMCQs(s.content).map((mcqContent) => ({
            content: mcqContent,
            explanation: null,
            state: "idle" as ExplainState,
            error: null,
            isEditing: false,
            editDraft: "",
          })),
          collapsed: false,
        }))
      );
    }
  }, [organizeData]);

  // ── auto-scroll to first loading MCQ ─────────────────────────────────────
  useEffect(() => {
    if (!autoScrollActive.current) return;
    for (let si = 0; si < sectionStates.length; si++) {
      for (let mi = 0; mi < sectionStates[si].mcqs.length; mi++) {
        if (sectionStates[si].mcqs[mi].state === "loading") {
          const el = mcqRefs.current[`${si}-${mi}`];
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
      }
    }
    // All done — stop auto-scroll
    const anyPending = sectionStates.some((s) =>
      s.mcqs.some((m) => m.state === "idle" || m.state === "loading")
    );
    if (!anyPending) autoScrollActive.current = false;
  }, [sectionStates]);

  // ── explain a single MCQ ──────────────────────────────────────────────────
  const explainMCQ = useCallback(
    async (sectionIdx: number, mcqIdx: number) => {
      const section = sectionStates[sectionIdx];
      const mcq = section.mcqs[mcqIdx];

      setSectionStates((prev) => {
        const next = prev.map((s, si) =>
          si !== sectionIdx
            ? s
            : {
                ...s,
                mcqs: s.mcqs.map((m, mi) =>
                  mi !== mcqIdx ? m : { ...m, state: "loading" as ExplainState, error: null }
                ),
              }
        );
        return next;
      });

      try {
        const results = await fetchExplanations([
          { title: section.section.title, content: mcq.content },
        ]);
        const explanation = results[0]?.explanation ?? mcq.content;
        setSectionStates((prev) =>
          prev.map((s, si) =>
            si !== sectionIdx
              ? s
              : {
                  ...s,
                  mcqs: s.mcqs.map((m, mi) =>
                    mi !== mcqIdx
                      ? m
                      : { ...m, explanation, state: "done" as ExplainState, error: null }
                  ),
                }
          )
        );
      } catch (e: any) {
        setSectionStates((prev) =>
          prev.map((s, si) =>
            si !== sectionIdx
              ? s
              : {
                  ...s,
                  mcqs: s.mcqs.map((m, mi) =>
                    mi !== mcqIdx
                      ? m
                      : { ...m, state: "error" as ExplainState, error: e.message }
                  ),
                }
          )
        );
      }
    },
    [sectionStates]
  );

  // ── explain all pending MCQs in a section ──────────────────────────────────
  const explainSection = useCallback(
    async (sectionIdx: number) => {
      const section = sectionStates[sectionIdx];
      const pending = section.mcqs
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.state !== "done");

      if (!pending.length) return;

      // Mark all pending as loading
      setSectionStates((prev) =>
        prev.map((s, si) =>
          si !== sectionIdx
            ? s
            : {
                ...s,
                mcqs: s.mcqs.map((m, mi) =>
                  pending.some(({ i }) => i === mi)
                    ? { ...m, state: "loading" as ExplainState, error: null }
                    : m
                ),
              }
        )
      );

      // Process in batches of 3
      const BATCH = 3;
      for (let b = 0; b < pending.length; b += BATCH) {
        const batch = pending.slice(b, b + BATCH);
        try {
          const results = await fetchExplanations(
            batch.map(({ m }) => ({
              title: section.section.title,
              content: m.content,
            }))
          );
          setSectionStates((prev) =>
            prev.map((s, si) => {
              if (si !== sectionIdx) return s;
              const newMCQs = [...s.mcqs];
              batch.forEach(({ i }, bi) => {
                const explanation = results[bi]?.explanation ?? s.mcqs[i].content;
                newMCQs[i] = { ...newMCQs[i], explanation, state: "done", error: null };
              });
              return { ...s, mcqs: newMCQs };
            })
          );
        } catch (e: any) {
          setSectionStates((prev) =>
            prev.map((s, si) => {
              if (si !== sectionIdx) return s;
              const newMCQs = [...s.mcqs];
              batch.forEach(({ i }) => {
                if (newMCQs[i].state === "loading") {
                  newMCQs[i] = { ...newMCQs[i], state: "error", error: e.message };
                }
              });
              return { ...s, mcqs: newMCQs };
            })
          );
        }
      }
    },
    [sectionStates]
  );

  // ── explain ALL pending MCQs across all sections ───────────────────────────
  const explainAll = useCallback(async () => {
    for (let si = 0; si < sectionStates.length; si++) {
      const section = sectionStates[si];
      const hasPending = section.mcqs.some((m) => m.state !== "done");
      if (hasPending) await explainSection(si);
    }
  }, [sectionStates, explainSection]);

  // ── auto-scroll + explain all ─────────────────────────────────────────────
  const explainAllWithScroll = useCallback(() => {
    autoScrollActive.current = true;
    explainAll();
  }, [explainAll]);

  // ── copy all ──────────────────────────────────────────────────────────────
  const handleCopyAll = async () => {
    if (!sectionStates.length) return;
    const out = sectionStates
      .map((s) => {
        const body = s.mcqs
          .map((m) => m.explanation ?? m.content)
          .join("\n\n");
        return `${s.section.title}\n\n${body}`;
      })
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(out);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = () => {
    resetOrganize();
    setSectionStates([]);
    setText("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = () => {
    resetOrganize();
    setSectionStates([]);
  };

  const startEditing = (si: number, mi: number) => {
    setSectionStates((prev) =>
      prev.map((s, sIdx) =>
        sIdx !== si
          ? s
          : {
              ...s,
              mcqs: s.mcqs.map((m, mIdx) =>
                mIdx !== mi
                  ? m
                  : { ...m, isEditing: true, editDraft: m.explanation ?? m.content }
              ),
            }
      )
    );
  };

  const cancelEditing = (si: number, mi: number) => {
    setSectionStates((prev) =>
      prev.map((s, sIdx) =>
        sIdx !== si
          ? s
          : {
              ...s,
              mcqs: s.mcqs.map((m, mIdx) =>
                mIdx !== mi ? m : { ...m, isEditing: false, editDraft: "" }
              ),
            }
      )
    );
  };

  const saveEditing = (si: number, mi: number) => {
    setSectionStates((prev) =>
      prev.map((s, sIdx) =>
        sIdx !== si
          ? s
          : {
              ...s,
              mcqs: s.mcqs.map((m, mIdx) =>
                mIdx !== mi
                  ? m
                  : {
                      ...m,
                      explanation: m.editDraft,
                      state: "done" as ExplainState,
                      isEditing: false,
                      editDraft: "",
                    }
              ),
            }
      )
    );
  };

  const updateEditDraft = (si: number, mi: number, value: string) => {
    setSectionStates((prev) =>
      prev.map((s, sIdx) =>
        sIdx !== si
          ? s
          : {
              ...s,
              mcqs: s.mcqs.map((m, mIdx) =>
                mIdx !== mi ? m : { ...m, editDraft: value }
              ),
            }
      )
    );
  };

  const deleteMCQ = (si: number, mi: number) => {
    setSectionStates((prev) =>
      prev.map((s, sIdx) =>
        sIdx !== si
          ? s
          : { ...s, mcqs: s.mcqs.filter((_, mIdx) => mIdx !== mi) }
      )
    );
  };

  const toggleCollapse = (si: number) => {
    setSectionStates((prev) =>
      prev.map((s, i) => (i === si ? { ...s, collapsed: !s.collapsed } : s))
    );
  };

  // ── derived counts ─────────────────────────────────────────────────────────
  const totalMCQs = sectionStates.reduce((n, s) => n + s.mcqs.length, 0);
  const doneMCQs = sectionStates.reduce(
    (n, s) => n + s.mcqs.filter((m) => m.state === "done").length,
    0
  );
  const loadingMCQs = sectionStates.reduce(
    (n, s) => n + s.mcqs.filter((m) => m.state === "loading").length,
    0
  );
  const errorMCQs = sectionStates.reduce(
    (n, s) => n + s.mcqs.filter((m) => m.state === "error").length,
    0
  );
  const allDone = totalMCQs > 0 && doneMCQs === totalMCQs;

  return (
    <div className="min-h-screen pb-24 pt-12 px-4 sm:px-6 lg:px-8 selection:bg-primary/10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <header className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-primary/5 rounded-2xl mb-2 ring-1 ring-primary/10">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Intelligent Text Organizer
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Paste your MCQs or notes. We'll organize by topic — then explain every MCQ with ✒️ detail.
          </p>
        </header>

        <AnimatePresence mode="wait">

          {/* ── STATE 1: INPUT ── */}
          {!organizeData && !isOrganizing && (
            <motion.div
              key="input-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-4"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-border/50 to-border/10 rounded-3xl blur-sm opacity-50 group-hover:opacity-100 transition duration-500" />
                <div className="relative bg-card rounded-2xl border border-border shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
                  <div className="bg-muted/30 border-b border-border px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>Raw Input</span>
                    </div>
                    {text.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {text.length.toLocaleString()} characters
                      </span>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your long text here..."
                    className="w-full h-[400px] p-6 bg-transparent text-foreground placeholder:text-muted-foreground/60 resize-none outline-none text-base leading-relaxed"
                  />
                </div>
              </div>

              {organizeError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                  {organizeError.message || "An error occurred. Please try again."}
                </div>
              )}

              <div className="flex items-center justify-end space-x-4 pt-2">
                {text.length > 0 && (
                  <CustomButton variant="ghost-muted" onClick={() => setText("")}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </CustomButton>
                )}
                <CustomButton
                  size="lg"
                  onClick={() => { if (text.trim()) organize({ data: { text } }); }}
                  disabled={!text.trim()}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Analyze & Organize
                </CustomButton>
              </div>
            </motion.div>
          )}

          {/* ── STATE 2: LOADING ── */}
          {isOrganizing && (
            <motion.div
              key="loading-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-24 flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-foreground">Analyzing your text...</h3>
                <p className="text-muted-foreground">Identifying topics and categorizing content.</p>
              </div>
              <div className="w-full max-w-2xl mt-12 space-y-6 opacity-40">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-6 bg-border/50 rounded-md w-1/3 animate-pulse" />
                    <div className="h-4 bg-border/30 rounded-md w-full animate-pulse" />
                    <div className="h-4 bg-border/30 rounded-md w-5/6 animate-pulse" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STATE 3: RESULTS ── */}
          {organizeData && !isOrganizing && (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Global toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${allDone ? "bg-amber-500" : "bg-green-500"}`} />
                  <span className="text-sm font-medium text-foreground">
                    {sectionStates.length} topic{sectionStates.length !== 1 ? "s" : ""} · {totalMCQs} MCQ{totalMCQs !== 1 ? "s" : ""}
                  </span>
                  {doneMCQs > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      ✒️ {doneMCQs}/{totalMCQs} explained
                    </span>
                  )}
                  {loadingMCQs > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {loadingMCQs} loading
                    </span>
                  )}
                  {errorMCQs > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      {errorMCQs} failed
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <CustomButton variant="outline" size="sm" onClick={handleEdit}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Edit
                  </CustomButton>
                  <CustomButton variant="outline" size="sm" onClick={handleReset}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Start Over
                  </CustomButton>
                  {!allDone && (
                    <CustomButton
                      variant="secondary"
                      size="sm"
                      onClick={explainAll}
                      disabled={loadingMCQs > 0}
                      className="min-w-[190px]"
                    >
                      {loadingMCQs > 0 ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Explaining ({doneMCQs}/{totalMCQs})...</>
                      ) : (
                        <><BookOpen className="w-4 h-4 mr-2" />{errorMCQs > 0 ? "Retry Failed + Explain Rest" : "Explain All MCQs"}</>
                      )}
                    </CustomButton>
                  )}
                  <CustomButton size="sm" onClick={handleCopyAll} className="min-w-[120px]">
                    {isCopied ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Copy className="w-4 h-4 mr-2" />Copy All</>}
                  </CustomButton>
                </div>
              </div>

              {/* Sections */}
              {sectionStates.map((sectionState, si) => {
                const sectionDone = sectionState.mcqs.filter((m) => m.state === "done").length;
                const sectionTotal = sectionState.mcqs.length;
                const sectionLoading = sectionState.mcqs.filter((m) => m.state === "loading").length;
                const sectionAllDone = sectionDone === sectionTotal;

                return (
                  <motion.div
                    key={si}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: si * 0.04 }}
                    className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
                  >
                    {/* Section header */}
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {si + 1}
                        </span>
                        <h3 className="text-base font-bold text-foreground truncate">
                          {sectionState.section.title}
                        </h3>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {sectionTotal} MCQ{sectionTotal !== 1 ? "s" : ""}
                        </span>
                        {sectionDone > 0 && (
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${sectionAllDone ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                            ✒️ {sectionDone}/{sectionTotal}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!sectionAllDone && (
                          <button
                            onClick={() => explainSection(si)}
                            disabled={sectionLoading > 0}
                            className="text-xs px-2.5 py-1 rounded-lg font-medium bg-primary/5 text-primary hover:bg-primary/10 border border-primary/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {sectionLoading > 0 ? (
                              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Explaining...</span>
                            ) : (
                              "✒️ Explain Section"
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => toggleCollapse(si)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                        >
                          {sectionState.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* MCQ list */}
                    <AnimatePresence initial={false}>
                      {!sectionState.collapsed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="divide-y divide-border/60"
                        >
                          {sectionState.mcqs.map((mcq, mi) => {
                            const isLoading = mcq.state === "loading";
                            const isDone = mcq.state === "done";
                            const isError = mcq.state === "error";

                            const isEditingMCQ = mcq.isEditing;

                            return (
                              <div
                                key={mi}
                                className={`relative p-5 transition-colors ${
                                  isEditingMCQ
                                    ? "bg-violet-50/40"
                                    : isDone
                                    ? "bg-amber-50/40"
                                    : isLoading
                                    ? "bg-blue-50/40"
                                    : isError
                                    ? "bg-red-50/30"
                                    : ""
                                }`}
                              >
                                {/* Left accent */}
                                <div
                                  className={`absolute left-0 top-0 bottom-0 w-0.5 ${
                                    isEditingMCQ ? "bg-violet-400" : isDone ? "bg-amber-400" : isLoading ? "bg-blue-400" : isError ? "bg-red-400" : "bg-transparent"
                                  }`}
                                />

                                {/* MCQ header row */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">
                                    MCQ {mi + 1}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isEditingMCQ ? (
                                      <>
                                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                                          Editing
                                        </span>
                                        <button
                                          onClick={() => saveEditing(si, mi)}
                                          className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1"
                                        >
                                          <Save className="w-3 h-3" />
                                          Save
                                        </button>
                                        <button
                                          onClick={() => cancelEditing(si, mi)}
                                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors"
                                          title="Cancel"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {isDone && (
                                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                            ✒️ Explained
                                          </span>
                                        )}
                                        {isLoading && (
                                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Generating...
                                          </span>
                                        )}
                                        {isError && (
                                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Failed
                                          </span>
                                        )}
                                        {/* Edit button — available whenever there's content to edit */}
                                        {!isLoading && (isDone || !isDone) && (
                                          <button
                                            onClick={() => startEditing(si, mi)}
                                            className="p-1.5 text-muted-foreground hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                            title="Edit explanation"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {/* Explain / Re-explain / Retry button */}
                                        {!isLoading && (
                                          <button
                                            onClick={() => explainMCQ(si, mi)}
                                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                                              isDone
                                                ? "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
                                                : isError
                                                ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                                                : "bg-primary/5 text-primary hover:bg-primary/10 border border-primary/20"
                                            }`}
                                          >
                                            {isDone ? "Re-explain" : isError ? "Retry" : "✒️ Explain"}
                                          </button>
                                        )}
                                        {/* Copy MCQ */}
                                        <button
                                          onClick={() =>
                                            navigator.clipboard.writeText(mcq.explanation ?? mcq.content)
                                          }
                                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                                          title="Copy"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        {/* Delete MCQ */}
                                        <button
                                          onClick={() => deleteMCQ(si, mi)}
                                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete MCQ"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Content */}
                                {isEditingMCQ ? (
                                  <textarea
                                    value={mcq.editDraft}
                                    onChange={(e) => updateEditDraft(si, mi, e.target.value)}
                                    className="w-full min-h-[160px] p-3 text-sm leading-relaxed bg-white border border-violet-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-300 resize-y font-mono text-foreground"
                                    autoFocus
                                  />
                                ) : isLoading ? (
                                  <div className="space-y-2 mt-2">
                                    <div className="h-4 bg-blue-100 rounded-md w-full animate-pulse" />
                                    <div className="h-4 bg-blue-100 rounded-md w-5/6 animate-pulse" />
                                    <div className="h-4 bg-amber-50 rounded-md w-full animate-pulse mt-3" />
                                    <div className="h-4 bg-amber-50 rounded-md w-3/4 animate-pulse" />
                                  </div>
                                ) : isDone ? (
                                  <ExplainedContent text={mcq.explanation!} />
                                ) : (
                                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {mcq.content}
                                  </div>
                                )}

                                {isError && mcq.error && (
                                  <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                                    {mcq.error}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {/* Bottom bar */}
              {sectionStates.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/40 rounded-2xl border border-border">
                  <p className="text-sm text-muted-foreground">
                    {allDone ? (
                      <span className="text-amber-700 font-semibold">✒️ All {totalMCQs} MCQs have explanations</span>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">{totalMCQs - doneMCQs}</span> MCQ{totalMCQs - doneMCQs !== 1 ? "s" : ""} still need explanation
                      </>
                    )}
                  </p>
                  <div className="flex gap-2">
                    {!allDone && loadingMCQs === 0 && (
                      <CustomButton size="sm" onClick={explainAll}>
                        <BookOpen className="w-4 h-4 mr-2" />
                        {errorMCQs > 0 ? "Retry Failed" : "Explain Remaining"}
                      </CustomButton>
                    )}
                    <CustomButton size="lg" onClick={handleReset} variant="secondary">
                      <RefreshCcw className="w-5 h-5 mr-2" />
                      Analyze Another Text
                    </CustomButton>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
