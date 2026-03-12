import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Copy, Check, ArrowLeft, Loader2, FileText,
  Trash2, RefreshCcw, BookOpen, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import { useOrganizeText } from "@workspace/api-client-react";
import { CustomButton } from "@/components/ui/custom-button";

type Section = { title: string; content: string };

type ExplainState = "idle" | "loading" | "done" | "error";

interface SectionState {
  section: Section;
  explanation: string | null;
  explainState: ExplainState;
  errorMsg: string | null;
}

function ExplainedContent({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-0.5">
      {text.split("\n").map((line, i) => {
        const isExplanation = line.trimStart().startsWith("✒️");
        return (
          <div
            key={i}
            className={
              isExplanation
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

async function fetchExplanation(sections: Section[]): Promise<{ title: string; content: string; explanation: string }[]> {
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

export default function Home() {
  const [text, setText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const { mutate: organize, isPending: isOrganizing, data: organizeData, reset: resetOrganize, error: organizeError } = useOrganizeText();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          explanation: null,
          explainState: "idle",
          errorMsg: null,
        }))
      );
      // Expand all by default
      setExpandedSections(new Set(organizeData.sections.map((_, i) => i)));
    }
  }, [organizeData]);

  const handleAnalyze = () => {
    if (!text.trim()) return;
    organize({ data: { text } });
  };

  const explainSingleSection = useCallback(async (index: number) => {
    setSectionStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], explainState: "loading", errorMsg: null };
      return next;
    });
    try {
      const results = await fetchExplanation([sectionStates[index].section]);
      const explanation = results[0]?.explanation ?? sectionStates[index].section.content;
      setSectionStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], explanation, explainState: "done", errorMsg: null };
        return next;
      });
    } catch (e: any) {
      setSectionStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], explainState: "error", errorMsg: e.message };
        return next;
      });
    }
  }, [sectionStates]);

  const explainAllSections = useCallback(async () => {
    const pendingIndices = sectionStates
      .map((s, i) => (s.explainState !== "done" ? i : null))
      .filter((i): i is number => i !== null);

    if (pendingIndices.length === 0) return;

    // Mark all pending as loading
    setSectionStates((prev) => {
      const next = [...prev];
      pendingIndices.forEach((i) => {
        next[i] = { ...next[i], explainState: "loading", errorMsg: null };
      });
      return next;
    });

    // Process in batches of 3 for better UX (show results as they come in)
    const BATCH = 3;
    for (let b = 0; b < pendingIndices.length; b += BATCH) {
      const batch = pendingIndices.slice(b, b + BATCH);
      const sections = batch.map((i) => sectionStates[i].section);

      try {
        const results = await fetchExplanation(sections);
        setSectionStates((prev) => {
          const next = [...prev];
          batch.forEach((sectionIndex, batchIdx) => {
            const explanation = results[batchIdx]?.explanation ?? sectionStates[sectionIndex].section.content;
            next[sectionIndex] = { ...next[sectionIndex], explanation, explainState: "done", errorMsg: null };
          });
          return next;
        });
      } catch (e: any) {
        setSectionStates((prev) => {
          const next = [...prev];
          batch.forEach((sectionIndex) => {
            if (next[sectionIndex].explainState === "loading") {
              next[sectionIndex] = { ...next[sectionIndex], explainState: "error", errorMsg: e.message };
            }
          });
          return next;
        });
      }
    }
  }, [sectionStates]);

  const handleCopyAll = async () => {
    if (!sectionStates.length) return;
    const formattedText = sectionStates
      .map((s) => {
        const body = s.explanation ?? s.section.content;
        return `${s.section.title}\n\n${body}`;
      })
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(formattedText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
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

  const toggleExpand = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const doneCount = sectionStates.filter((s) => s.explainState === "done").length;
  const loadingCount = sectionStates.filter((s) => s.explainState === "loading").length;
  const errorCount = sectionStates.filter((s) => s.explainState === "error").length;
  const pendingCount = sectionStates.filter((s) => s.explainState === "idle" || s.explainState === "error").length;
  const allDone = sectionStates.length > 0 && doneCount === sectionStates.length;

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
            Paste your notes, MCQs, or any text. We'll organize it by topic — then explain every MCQ with ✒️ detail.
          </p>
        </header>

        <AnimatePresence mode="wait">

          {/* STATE 1: INPUT */}
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
                <div className="absolute -inset-1 bg-gradient-to-r from-border/50 to-border/10 rounded-3xl blur-sm opacity-50 group-hover:opacity-100 transition duration-500"></div>
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
                  onClick={handleAnalyze}
                  disabled={!text.trim() || isOrganizing}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Analyze & Organize
                </CustomButton>
              </div>
            </motion.div>
          )}

          {/* STATE 2: LOADING (organize) */}
          {isOrganizing && (
            <motion.div
              key="loading-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-24 flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-foreground">Analyzing your text...</h3>
                <p className="text-muted-foreground">Identifying topics and categorizing content without losing a single word.</p>
              </div>
              <div className="w-full max-w-2xl mt-12 space-y-6 opacity-40">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-6 bg-border/50 rounded-md w-1/3 animate-pulse"></div>
                    <div className="h-4 bg-border/30 rounded-md w-full animate-pulse"></div>
                    <div className="h-4 bg-border/30 rounded-md w-5/6 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STATE 3: RESULTS */}
          {organizeData && !isOrganizing && (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${allDone ? "bg-amber-500" : "bg-green-500"}`}></div>
                  <span className="text-sm font-medium text-foreground">
                    {sectionStates.length} topic{sectionStates.length !== 1 ? "s" : ""}
                  </span>
                  {doneCount > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      ✒️ {doneCount}/{sectionStates.length} explained
                    </span>
                  )}
                  {loadingCount > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {loadingCount} loading...
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errorCount} failed
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
                      onClick={explainAllSections}
                      disabled={loadingCount > 0}
                      className="min-w-[180px]"
                    >
                      {loadingCount > 0 ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating ({doneCount}/{sectionStates.length})...
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4 mr-2" />
                          {errorCount > 0 ? "Retry Failed + Explain Rest" : "Explain All / সব ব্যাখ্যা"}
                        </>
                      )}
                    </CustomButton>
                  )}

                  <CustomButton size="sm" onClick={handleCopyAll} className="min-w-[120px]">
                    {isCopied ? (
                      <><Check className="w-4 h-4 mr-2" />Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" />Copy All</>
                    )}
                  </CustomButton>
                </div>
              </div>

              {/* Section cards */}
              <div className="space-y-4">
                {sectionStates.map((state, index) => {
                  const isExpanded = expandedSections.has(index);
                  const bodyText = state.explanation ?? state.section.content;
                  const isLoading = state.explainState === "loading";
                  const isDone = state.explainState === "done";
                  const isError = state.explainState === "error";

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.04 }}
                      className={`group bg-card rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden ${
                        isDone
                          ? "border-amber-200"
                          : isError
                          ? "border-red-200"
                          : isLoading
                          ? "border-blue-200"
                          : "border-border"
                      }`}
                    >
                      {/* Left accent bar */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 transition-opacity duration-300 ${
                          isDone
                            ? "bg-gradient-to-b from-amber-400 to-amber-200 opacity-100"
                            : isLoading
                            ? "bg-gradient-to-b from-blue-400 to-blue-200 opacity-100"
                            : isError
                            ? "bg-gradient-to-b from-red-400 to-red-200 opacity-100"
                            : "bg-gradient-to-b from-primary/40 to-primary/5 opacity-0 group-hover:opacity-100"
                        }`}
                      ></div>

                      <div className="p-5 md:p-6">
                        {/* Section header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {index + 1}
                            </span>
                            <h3 className="text-lg font-bold text-foreground leading-snug">
                              {state.section.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Status badge */}
                            {isDone && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                ✒️ Explained
                              </span>
                            )}
                            {isLoading && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generating...
                              </span>
                            )}
                            {isError && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                                <AlertCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}

                            {/* Per-section Explain button */}
                            {!isLoading && (
                              <button
                                onClick={() => explainSingleSection(index)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                                  isDone
                                    ? "bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-700"
                                    : isError
                                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                                    : "bg-primary/5 text-primary hover:bg-primary/10 border border-primary/20"
                                }`}
                                title={isDone ? "Re-explain this section" : "Explain this section"}
                              >
                                {isDone ? "Re-explain" : isError ? "Retry" : "✒️ Explain"}
                              </button>
                            )}

                            {/* Copy button */}
                            <button
                              onClick={() => navigator.clipboard.writeText(`${state.section.title}\n\n${bodyText}`)}
                              className="p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-muted rounded-lg transition-all duration-200"
                              title="Copy section"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Expand/collapse */}
                            <button
                              onClick={() => toggleExpand(index)}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-all duration-200"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Error message */}
                        {isError && state.errorMsg && (
                          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {state.errorMsg}
                          </div>
                        )}

                        {/* Content */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              {isLoading ? (
                                <div className="space-y-2 pt-2">
                                  <div className="h-4 bg-blue-100 rounded-md w-full animate-pulse"></div>
                                  <div className="h-4 bg-blue-100 rounded-md w-5/6 animate-pulse"></div>
                                  <div className="h-4 bg-blue-100 rounded-md w-4/6 animate-pulse"></div>
                                  <div className="h-4 bg-amber-50 rounded-md w-full animate-pulse mt-3"></div>
                                  <div className="h-4 bg-amber-50 rounded-md w-3/4 animate-pulse"></div>
                                </div>
                              ) : isDone ? (
                                <ExplainedContent text={bodyText} />
                              ) : (
                                <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                                  {state.section.content}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Summary bar at bottom */}
              {sectionStates.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/40 rounded-2xl border border-border">
                  <div className="text-sm text-muted-foreground">
                    {allDone ? (
                      <span className="text-amber-700 font-semibold">✒️ All {sectionStates.length} sections have explanations</span>
                    ) : (
                      <span>
                        <span className="font-semibold text-foreground">{pendingCount}</span> section{pendingCount !== 1 ? "s" : ""} still need{pendingCount === 1 ? "s" : ""} explanation
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!allDone && loadingCount === 0 && (
                      <CustomButton size="sm" onClick={explainAllSections}>
                        <BookOpen className="w-4 h-4 mr-2" />
                        {errorCount > 0 ? "Retry All Failed" : "Explain Remaining"}
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
