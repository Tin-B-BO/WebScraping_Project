import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchPopularRecipes } from "../api/api";
import SearchResultCard from "../components/SearchResultCard";
import { useAuth } from "../context/AuthContext";
import "../styles/PopularPage.css";

function Popular() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // resolve allergen key and label from route state fallbacks
  const selectedAllergenKey = location.state?.allergenKey || slug || "";
  const selectedAllergenLabel = location.state?.allergenLabel || slug || "selected allergen";

  const [popularRecipes, setPopularRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  // normalize user allergens for warning matching in result cards
  const normalizedUserAllergens = (user?.allergens || []).map((x) => String(x).toLowerCase());

  // handle top back action with browser-history fallback
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  // load popular recipes for selected allergen
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedAllergenKey) {
        setIsLoading(false);
        setStatusMessage("Missing allergen");
        return;
      }

      setIsLoading(true);
      setStatusMessage("");

      try {
        const response = await fetchPopularRecipes({ allergens: [selectedAllergenKey] });
        const fetchedItems = response.items || [];
        if (!alive) return;

        setPopularRecipes(fetchedItems);
        if (!fetchedItems.length) setStatusMessage("No popular recipes yet.");
      } catch {
        if (!alive) return;
        setStatusMessage("Failed to load popular recipes.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedAllergenKey]);

  // build page title from selected allergen label
  const pageTitle = useMemo(
    () => `Popular recipes without: ${selectedAllergenLabel}`,
    [selectedAllergenLabel]
  );

  return (
    <div className="popular-page-view">
      <div className="popular-page-view__topbar">
        <button
          type="button"
          className="popular-page-view__back-btn"
          onClick={handleBack}
          aria-label="Go back to home page"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 100 100"
            fill="none"
            stroke="#666"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="popular-page-view__back-icon"
            aria-hidden="true"
          >
            <polyline points="60,20 30,50 60,80" />
          </svg>
          <span>Back</span>
        </button>

        <div className="popular-page-view__title-wrap">
          <h1 className="popular-page-view__title">{pageTitle}</h1>
        </div>
      </div>

      {statusMessage && !isLoading && <p className="popular-page-view__message">{statusMessage}</p>}

      <div className="popular-page-view__grid">
        {isLoading
          ? Array.from({ length: 10 }).map((_, index) => (
              <SearchResultCard key={index} loading countView={false} />
            ))
          : popularRecipes.map((recipe) => (
              <SearchResultCard
                key={recipe.id}
                recipe={recipe}
                countView={false}
                userAllergens={normalizedUserAllergens}
              />
            ))}
      </div>
    </div>
  );
}

export default Popular;
