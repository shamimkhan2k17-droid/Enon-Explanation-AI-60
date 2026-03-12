import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Copy, Check, ArrowLeft, Loader2, FileText,
  Trash2, RefreshCcw, BookOpen
} from "lucide-react";
import { useOrganizeText, useExplainMcq } from "@workspace/api-client-react";
import { CustomButton } from "@/components/ui/custom-button";

type Section = { title: string; content: string };
type SectionWithExplanation = Section & { explanation: string };

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

export default function Home() {
  const [text, setText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [sectionsWithExplanations, setSectionsWithExplanations] = useState<SectionWithExplanation[] | null>(null);

  const { mutate: organize, isPending: isOrganizing, data: organizeData, reset: resetOrganize, error: organizeError } = useOrganizeText();
  const { mutate: explain, isPending: isExplaining } = useExplainMcq();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!organizeData && !isOrganizing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [organizeData, isOrganizing]);

  useEffect(() => {
    setSectionsWithExplanations(null);
  }, [organizeData]);

  const handleAnalyze = () => {
    if (!text.trim()) return;
    organize({ data: { text } });
  };

  const handleAddExplanations = () => {
    if (!organizeData?.sections) return;
    explain(
      { data: { sections: organizeData.sections } },
      {
        onSuccess: (data) => {
          setSectionsWithExplanations(data.sections as SectionWithExplanation[]);
        },
      }
    );
  };

  const handleCopyAll = async () => {
    const sections: (Section | SectionWithExplanation)[] = sectionsWithExplanations ?? organizeData?.sections ?? [];
    if (!sections.length) return;

    const formattedText = sections
      .map((section) => {
        const body = ('explanation' in section && section.explanation)
          ? section.explanation
          : section.content;
        return `${section.title}\n\n${body}`;
      })
      .join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(formattedText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleReset = () => {
    resetOrganize();
    setSectionsWithExplanations(null);
    setText("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = () => {
    resetOrganize();
    setSectionsWithExplanations(null);
  };

  const displaySections: (Section | SectionWithExplanation)[] =
    sectionsWithExplanations ?? organizeData?.sections ?? [];

  const hasExplanations = !!sectionsWithExplanations;

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
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${hasExplanations ? "bg-amber-500" : "bg-green-500"}`}></div>
                  <span className="text-sm font-medium text-foreground">
                    {organizeData.sections.length} topic{organizeData.sections.length !== 1 ? "s" : ""}
                    {hasExplanations && <span className="ml-2 text-amber-700 font-semibold">· ✒️ Explanations added</span>}
                  </span>
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

                  {!hasExplanations && (
                    <CustomButton
                      variant="secondary"
                      size="sm"
                      onClick={handleAddExplanations}
                      disabled={isExplaining}
                      className="min-w-[170px]"
                    >
                      {isExplaining ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating ✒️...
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4 mr-2" />
                          Add Explanation / ব্যাখ্যা
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

              {/* Generating explanations banner */}
              <AnimatePresence>
                {isExplaining && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium"
                  >
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>AI is generating ✒️ explanations for each MCQ — ব্যাখ্যা তৈরি হচ্ছে... This may take a moment.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Section cards */}
              <div className="space-y-6">
                {displaySections.map((section, index) => {
                  const withExp = 'explanation' in section && section.explanation;
                  const bodyText = withExp ? (section as SectionWithExplanation).explanation : section.content;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      className="group bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/40 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      <div className="p-6 md:p-8">
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <h3 className="text-xl font-bold text-foreground">
                            {section.title}
                          </h3>
                          <button
                            onClick={() => {
                              const copyText = `${section.title}\n\n${bodyText}`;
                              navigator.clipboard.writeText(copyText);
                            }}
                            className="p-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-muted rounded-lg transition-all duration-200 shrink-0"
                            title="Copy section"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>

                        {withExp ? (
                          <ExplainedContent text={bodyText} />
                        ) : (
                          <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                            {bodyText}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex justify-center pt-8">
                <CustomButton size="lg" onClick={handleReset} variant="secondary">
                  <RefreshCcw className="w-5 h-5 mr-2" />
                  Analyze Another Text
                </CustomButton>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
