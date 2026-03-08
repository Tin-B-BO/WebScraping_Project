import React, { createContext, useContext, useMemo, useState } from "react";

const SearchContext = createContext(null);

function SearchProvider({ children }) {
  const [query, setQuery] = useState("");
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [results, setResults] = useState([]);

  // memoize shared search state to reduce unnecessary rerenders
  const value = useMemo(
    () => ({
      query,
      setQuery,
      selectedAllergens,
      setSelectedAllergens,
      results,
      setResults,
    }),
    [query, selectedAllergens, results]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

// ensure hook usage only inside provider
function useSearchStore() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearchStore must be used inside <SearchProvider>");
  return ctx;
}

export { SearchProvider, useSearchStore };
