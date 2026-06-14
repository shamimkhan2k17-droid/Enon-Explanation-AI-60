import { useState } from "react";
import { X, Plus, Trash2, Check, Key, Zap, Globe, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiConfig } from "@/hooks/useApiConfig";

interface Props {
  open: boolean;
  onClose: () => void;
  apis: ApiConfig[];
  activeId: string | null;
  onAdd: (data: Omit<ApiConfig, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onSetActive: (id: string) => void;
}

const PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o", color: "bg-green-100 text-green-800 border-green-200" },
  { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Together AI", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3-70b-chat-hf", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { label: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-large-latest", color: "bg-red-100 text-red-800 border-red-200" },
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { label: "Custom", baseUrl: "", model: "", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

export function ApiManagerModal({
  open,
  onClose,
  apis,
  activeId,
  onAdd,
  onRemove,
  onSetActive,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    apiKey: "",
    baseUrl: "",
    model: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset.label);
    setForm((p) => ({
      ...p,
      name: preset.label === "Custom" ? p.name : preset.label,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "নাম দিন";
    if (!form.apiKey.trim()) e.apiKey = "API Key দিন";
    if (!form.baseUrl.trim()) e.baseUrl = "Base URL দিন";
    if (!form.model.trim()) e.model = "Model দিন";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    onAdd({
      name: form.name.trim(),
      apiKey: form.apiKey.trim(),
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
    });
    setForm({ name: "", apiKey: "", baseUrl: "", model: "" });
    setSelectedPreset(null);
    setErrors({});
    setShowForm(false);
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedPreset(null);
    setErrors({});
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      />

      <motion.div
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">API Manager</h2>
              <p className="text-xs text-muted-foreground">
                যেকোনো OpenAI-compatible API কাজ করবে
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Saved APIs */}
          {apis.length > 0 && (
            <div className="space-y-2">
              {apis.map((api) => {
                const isActive = api.id === activeId;
                return (
                  <motion.div
                    key={api.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
                      isActive
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-primary/30 hover:bg-primary/3"
                    }`}
                    onClick={() => onSetActive(api.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isActive ? "border-primary bg-primary" : "border-border bg-white"
                          }`}
                        >
                          {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{api.name}</span>
                            {isActive && (
                              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate">{api.baseUrl}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Zap className="w-3 h-3 shrink-0" />
                              <span>{api.model}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Key className="w-3 h-3 shrink-0" />
                              <span className="font-mono">{api.apiKey.slice(0, 8)}••••••••</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(api.id); }}
                        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {apis.length === 0 && !showForm && (
            <div className="text-center py-6 text-muted-foreground">
              <Key className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">কোনো API যুক্ত করা হয়নি</p>
              <p className="text-xs mt-1">নিচ থেকে একটি provider বেছে API যুক্ত করুন</p>
            </div>
          )}

          {/* Add Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">নতুন API যুক্ত করুন</h3>

                  {/* Provider presets */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Provider বেছে নিন:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => applyPreset(p)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                            selectedPreset === p.label
                              ? p.color + " ring-2 ring-offset-1 ring-current"
                              : "bg-white border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">নাম *</label>
                      <input
                        type="text"
                        placeholder="যেমন: My Groq Key"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                          errors.name ? "border-destructive" : "border-border"
                        }`}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">API Key *</label>
                      <input
                        type="password"
                        placeholder="sk-... / gsk-... / AIza..."
                        value={form.apiKey}
                        onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono ${
                          errors.apiKey ? "border-destructive" : "border-border"
                        }`}
                      />
                      {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Base URL *</label>
                      <input
                        type="url"
                        placeholder="https://api.openai.com/v1"
                        value={form.baseUrl}
                        onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                          errors.baseUrl ? "border-destructive" : "border-border"
                        }`}
                      />
                      {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Model *</label>
                      <input
                        type="text"
                        placeholder="gpt-4o / llama-3.3-70b-versatile"
                        value={form.model}
                        onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                          errors.model ? "border-destructive" : "border-border"
                        }`}
                      />
                      {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleAdd}
                      className="flex-1 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      যুক্ত করুন ও Active করুন
                    </button>
                    <button
                      onClick={() => { setShowForm(false); setSelectedPreset(null); setErrors({}); }}
                      className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="px-5 py-4 border-t border-border shrink-0">
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              নতুন API যুক্ত করুন
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
