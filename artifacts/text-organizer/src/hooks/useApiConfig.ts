import { useState, useCallback } from "react";

export interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  createdAt: number;
}

const STORAGE_KEY = "text_organizer_apis";
const ACTIVE_KEY = "text_organizer_active_api";

function loadApis(): ApiConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveApis(apis: ApiConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apis));
}

function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function useApiConfig() {
  const [apis, setApis] = useState<ApiConfig[]>(() => loadApis());
  const [activeId, setActiveIdState] = useState<string | null>(() => loadActiveId());

  const activeApi = apis.find((a) => a.id === activeId) ?? null;

  const addApi = useCallback((data: Omit<ApiConfig, "id" | "createdAt">) => {
    const newApi: ApiConfig = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const updated = [...loadApis(), newApi];
    saveApis(updated);
    saveActiveId(newApi.id);
    setApis(updated);
    setActiveIdState(newApi.id);
    return newApi;
  }, []);

  const removeApi = useCallback((id: string) => {
    const current = loadApis();
    const updated = current.filter((a) => a.id !== id);
    saveApis(updated);
    setApis(updated);
    const currentActive = loadActiveId();
    if (currentActive === id) {
      const nextActive = updated.length > 0 ? updated[updated.length - 1].id : null;
      saveActiveId(nextActive);
      setActiveIdState(nextActive);
    }
  }, []);

  const setActiveId = useCallback((id: string) => {
    saveActiveId(id);
    setActiveIdState(id);
  }, []);

  const clearActive = useCallback(() => {
    saveActiveId(null);
    setActiveIdState(null);
  }, []);

  return { apis, activeApi, activeId, addApi, removeApi, setActiveId, clearActive };
}
