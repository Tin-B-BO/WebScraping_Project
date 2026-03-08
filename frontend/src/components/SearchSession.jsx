import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchRecipes } from "../api/api";
import SearchResultCard from "./SearchResultCard";
import { useSearchStore } from "../context/SearchContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/SearchSession.css";

/* ============================================================
    CONFIGURATION & CONSTANTS
   ============================================================ */
const ALLERGEN_OPTIONS = [
  "celery", "cereals containing gluten", "crustaceans", "eggs", "fish", "lupin",
  "milk", "molluscs", "mustard", "peanuts", "sesame", "soybeans",
  "sulphur dioxide and sulphites", "tree nuts"
];

const TARGET_TOTAL = 180;        // Max recipes to collect per search
const PAGE_SIZE = 60;           // Recipes per frontend page
const MAX_PAGES = 3;            // Capped at 3 pages total
const POLL_MS = 200;            // Check for new data every 200ms
const MAX_TOTAL_POLL_MS = 20000; // Hard stop after 20s safety timeout
const EMPTY_POLLS_TO_STOP = 40; // Stop if 40 consecutive polls return no data

function SearchSession({ variant = "search", autoRun = false }) {
  const navigate = useNavigate();
  // Current authenticated user; used to prefill allergen filters and pass user allergen context to recipe cards
  const { user } = useAuth();
  // Shared search state from the global store: query text, allergen filters, and result list
  const { query, setQuery, selectedAllergens, setSelectedAllergens, results, setResults } = useSearchStore();

  /* ============================================================
      LOCAL UI STATE
     ============================================================ */
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [scrapeStarted, setScrapeStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrapeBlocked, setScrapeBlocked] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false); // Guard to ensure scrolling only happens on intentional actions

/* ============================================================
      REFS, Component Memory
     ============================================================ */
  const resultsRef = useRef(null);      // Scroll anchor for results
  const cursorRef = useRef(null);        // Timestamp for new data, to prevent loading same recipes twice
  const pollingRef = useRef(false);     // Prevents overlapping network calls, set true and waits till 200ms
  const stopRef = useRef(false);        // Master stop switch for the loop, if TTL runs out or hit 180 recipes
  const didAutoRunRef = useRef(false);  // Prevents double-search on page load
  const prefilledAllergensUserIdRef = useRef(null); // Tracks the user ID whose defaults were already applied
  const pollStartAtRef = useRef(0);     // Used for 20s safety timeout
  const emptyPollsRef = useRef(0);      // Counter to stop if too many polls are empty
  const latestStateRef = useRef({ results, query, selectedAllergens }); // Keep latest results/query/allergens in a ref so the polling interval always uses current values
  
  // Keep ref synced to avoid stale closures in polling callbacks
  useEffect(() => {
    latestStateRef.current = { results, query, selectedAllergens };
  }, [results, query, selectedAllergens]);

  /* ============================================================
      UTILITY EFFECTS for Auto-select user allergens and scroll behavior
     ============================================================ */
  // Auto-fill saved allergens once per logged-in user, without overriding manual unchecks.
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (!currentUserId) {
      prefilledAllergensUserIdRef.current = null;
      return;
    }

    if (prefilledAllergensUserIdRef.current !== currentUserId && !selectedAllergens.length) {
      setSelectedAllergens(user.allergens || []);
    }
    prefilledAllergensUserIdRef.current = currentUserId;
  }, [user, selectedAllergens.length, setSelectedAllergens]);

  // scroll to results heading after search or page change
  useEffect(() => {
    if (!shouldScroll || !resultsRef.current) return;

    const timer = setTimeout(() => {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setShouldScroll(false);
    }, 120);

    return () => clearTimeout(timer);
  }, [page, shouldScroll, results.length]);

  /* ============================================================
    DERIVED CALCULATIONS
   ============================================================ */
  // memoized slice to get only recipes for the current active page
  const pagedResults = useMemo(() => 
    results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), 
  [results, page]);

  // calculates total pages needed, capped at 3
  const totalPages = Math.min(MAX_PAGES, Math.ceil(results.length / PAGE_SIZE));

  // check to allow background polling to continue
  const shouldPoll = variant === "search" && pending && scrapeStarted && !scrapeBlocked && !stopRef.current;

  // shows loading skeleton if we expect more results for the current page
  const showLoadingSkeleton = shouldPoll && pagedResults.length < PAGE_SIZE;

  /* ============================================================
      SEARCH ACTIONS
     ============================================================ */
  const startSearch = async () => {
    // reset logic refs to baseline
    stopRef.current = false; 
    pollingRef.current = false; 
    emptyPollsRef.current = 0;
    pollStartAtRef.current = Date.now(); 
    cursorRef.current = null;

    // clear UI state for a fresh search
    setPage(1); 
    setResults([]); 
    setPending(false); 
    setScrapeStarted(false); 
    setScrapeBlocked(false);

    // initial API call for existing recipes from database
    const initialResponse = await searchRecipes({ 
      query: latestStateRef.current.query, 
      allergens: latestStateRef.current.selectedAllergens, 
      cursor_created_at: null // // first search call, no cursor yet
    });

    // sync results and update scraper status
    setResults(initialResponse.items || []); // Show initial recipes
    // Backend started scraping
    setScrapeStarted(!!initialResponse.scrape_started); 
    // Scrape blocked: TTL is still active, no new scrape is allowed
    setScrapeBlocked(!!initialResponse.scrape_blocked); 
    // Save poll cursor timestamp for the next polling request
    cursorRef.current = initialResponse.cursor_created_at || null; 

    // only enable background polling if not blocked by TTL
    const isActuallyPending = !!initialResponse.pending && !initialResponse.scrape_blocked;
    setPending(isActuallyPending);
    setShouldScroll(true);

    // Kill polling loop if target reached or scraper inactive
    if (!isActuallyPending || (initialResponse.items?.length >= TARGET_TOTAL)) {
      stopRef.current = true;
      setPending(false);
    }
  };

/* ============================================================
    THE POLLING LOOP
   ============================================================ */
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = setInterval(async () => {
      // skip this poll if a request is already in progress or polling has been stopped
      if (pollingRef.current || stopRef.current) return;

      // stop if 20s passed or max recipes reached
      const timeElapsed = Date.now() - pollStartAtRef.current;
      if (timeElapsed > MAX_TOTAL_POLL_MS || latestStateRef.current.results.length >= TARGET_TOTAL) {
        stopRef.current = true; setPending(false); return;
      }
      pollingRef.current = true; // lock the loop
      try {
        // fetch only recipes newer than the last cursor timestamp
        const pollResponse = await searchRecipes({ 
          query: latestStateRef.current.query, 
          allergens: latestStateRef.current.selectedAllergens, 
          cursor_created_at: cursorRef.current // cursor timestamp for newer recipes
        });

        // increase empty-poll count when no items arrive; stop polling after the empty-poll threshold.
        const newItems = pollResponse.items || []; // new recipes returned by this poll call
        emptyPollsRef.current = newItems.length === 0 ? emptyPollsRef.current + 1 : 0;
        if (emptyPollsRef.current >= EMPTY_POLLS_TO_STOP) {
          stopRef.current = true; setPending(false); return;
        }

        // if this poll returns recipes, append only new unique ones and cap at target totals
        if (newItems.length > 0) {
          setResults(prev => {
            const seenRecipeKeys = new Set(prev.map(r => r.id || r.url));
            const merged = [...prev, ...newItems.filter(r => !seenRecipeKeys.has(r.id || r.url))];
            return merged.slice(0, TARGET_TOTAL); // keep only up to 180
          });
        }

        // update cursor timestamp and check if backend is still scraping.
        cursorRef.current = pollResponse.cursor_created_at || cursorRef.current;
        if (!pollResponse.pending) { stopRef.current = true; setPending(false); }
        
      } catch { // stop polling on request error.
        stopRef.current = true; setPending(false); // mark stopped and hide loading state.
      } finally {
        pollingRef.current = false; // release polling lock
      }
    }, POLL_MS); // poll interval, every 200ms 

    return () => clearInterval(timer); // clear interval on effect cleanup
  }, [shouldPoll]); // recreate polling loop when polling state changes

  /* ============================================================
      FORM & NAVIGATION HANDLERS
     ============================================================ */
  const handleSubmit = async (e) => {
    e.preventDefault(); // prevent full page reload on form submit.
    if (!query.trim()) return; // ignore empty searches

    if (variant === "home") {
      setResults([]); // clear old results before moving to search page
      navigate("/search", { state: { autoSearch: true } }); // navigate to search page and auto-start the search
      return;
    }

    setLoading(true); // disable search input box and show loading state
    try {
      await startSearch(); // run initial search request and setup polling state
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false); // release loading state
    }
  };

  useEffect(() => {
    // auto-run once when landing on search page with autoRun enabled
    if (variant === "search" && autoRun && !didAutoRunRef.current) {
      didAutoRunRef.current = true; // mark auto-run as used so this effect runs only once
      if (results.length > 0) {
        stopRef.current = true; // stop polling if results already exist
        setPending(false); // stop pending state
        return;
      }
      if (query.trim()) {
        setLoading(true); // show loading while auto search starts
        startSearch().finally(() => setLoading(false)); // end loading state
      }
    }
  }, [variant, autoRun, results]); // re-run this effect when variant, autoRun flag, or results change

  /* ============================================================
      (I) RENDERING
     ============================================================ */
  return (
    <>
      <section className="search-session">
        <form onSubmit={handleSubmit} className="search-session__form">
          <div className="search-session__query-wrap">
            <input 
              type="text" 
              placeholder="Input Recipe Name..." 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              className="search-session__query-input" 
              disabled={loading || pending}
            />
            <div className="search-session__query-icon">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#666" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          <div className="search-session__allergen-panel">
            <p>Please Select Your Allergen/s</p>
            <div className="search-session__allergen-grid">
              {ALLERGEN_OPTIONS.map(name => (
                <label key={name} className="search-session__allergen-option">
                  <input 
                    type="checkbox" 
                    checked={selectedAllergens.includes(name)} 
                    onChange={() => {
                      setSelectedAllergens(prev => 
                        prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
                      );
                    }} 
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="search-session__submit" type="submit" disabled={loading || pending}>
            {loading ? "Searching..." : pending ? "Loading..." : "Search"}
          </button>
        </form>
      </section>

      {variant === "search" && (
        <section className="search-session__results">
          {(pagedResults.length > 0 || showLoadingSkeleton) && <h2 ref={resultsRef}>Results</h2>}
          
          <div className="search-session__results-list">
            {pagedResults.map((r, idx) => (
              <SearchResultCard 
                key={r.id || idx} 
                recipe={r} 
                currentQuery={query} 
                userAllergens={(user?.allergens || []).filter(Boolean)} 
              />
            ))}

            {showLoadingSkeleton && <SearchResultCard loading />}
          </div>

          {totalPages > 1 && (
            <div className="search-session__pagination">
              {[...Array(totalPages)].map((_, i) => (
                <button 
                  key={i} 
                  className={`search-session__page-btn ${i + 1 === page ? "search-session__page-btn--active" : ""}`} 
                  onClick={() => {
                    setPage(i + 1);
                    setShouldScroll(true);
                  }} 
                  disabled={loading}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default SearchSession;


