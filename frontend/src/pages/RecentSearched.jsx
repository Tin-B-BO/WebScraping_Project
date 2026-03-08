import React, { useEffect, useMemo, useState } from "react";
import { fetchRecent } from "../api/api";
import RecentCard from "../components/RecentCard";
import { useAuth } from "../context/AuthContext";
import "../styles/RecentSearched.css";

function RecentSearched() {
  const { user } = useAuth();
  const [recentItems, setRecentItems] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // normalize user allergens for card warning checks
  const normalizedUserAllergens = useMemo(
    () => (user?.allergens || []).map((x) => String(x).toLowerCase()),
    [user]
  );

  // load recent searched items for authenticated user
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const response = await fetchRecent();
        if (!alive) return;

        const fetchedRecentItems = (response.items || []).slice(0, 8);
        setRecentItems(fetchedRecentItems);
        if (!fetchedRecentItems.length) setStatusMessage("No recent searches");
      } catch {
        if (!alive) return;
        setStatusMessage("Failed to load");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) return null;

  // render skeleton cards while loading then switch to fetched items
  const cardsToRender = isLoading
    ? Array.from({ length: 8 }).map((_, index) => ({ _skeleton: true, id: `skeleton-${index}` }))
    : recentItems;

  return (
    <section className="recent-search">
      <img
        className="recent-search__bg"
        src="/home-search-bg.webp"
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />

      <div className="recent-search__overlay" aria-hidden="true" />

      <div className="recent-search__inner">
        <h2 className="recent-search__title">Recent Searched Recipes...</h2>

        {statusMessage && !isLoading && <p className="recent-search__message">{statusMessage}</p>}

        <div className="recent-search__grid">
          {cardsToRender.map((item, index) => (
            <div key={item.id || index} className={`recent-search__slot recent-search__slot--${index}`}>
              <RecentCard
                recipe={item}
                userAllergens={normalizedUserAllergens}
                className={index >= 5 ? "recent-card--landscape" : ""}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RecentSearched;
