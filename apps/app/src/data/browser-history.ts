import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * Bookmarks and recently visited dApps. Stored only on this device — browsing
 * history is never sent to HENSENG. Incognito mode records nothing.
 */
const KEY = "henseng.browser.v1";

interface BrowserState {
  bookmarks: string[];
  recent: string[];
  incognito: boolean;
}

const EMPTY: BrowserState = { bookmarks: [], recent: [], incognito: false };

export function useBrowserState() {
  const [state, setState] = useState<BrowserState>(EMPTY);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => raw && setState({ ...EMPTY, ...(JSON.parse(raw) as Partial<BrowserState>) }));
  }, []);

  const save = useCallback((fn: (s: BrowserState) => BrowserState) => {
    setState((prev) => {
      const next = fn(prev);
      void AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    ...state,
    toggleBookmark: (id: string) =>
      save((s) => ({ ...s, bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [id, ...s.bookmarks] })),
    recordVisit: (id: string) => save((s) => (s.incognito ? s : { ...s, recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 8) })),
    setIncognito: (incognito: boolean) => save((s) => ({ ...s, incognito })),
    clearHistory: () => save((s) => ({ ...s, recent: [] })),
  };
}
