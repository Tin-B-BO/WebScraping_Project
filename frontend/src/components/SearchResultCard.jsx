import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { incrementRecipeView } from "../api/api";
import { useAuth } from "../context/AuthContext";
import "../styles/SearchResultCard.css";
import FALLBACK_IMAGE from "../assets/replace.jpg";

function SearchResultCard({
  recipe,
  loading = false,
  countView = true,
  userAllergens = [],
}) {
  const navigate = useNavigate();
  const { user } = useAuth()
  const title = recipe?.title || "Untitled recipe";
  const imageUrl = recipe?.image_url || FALLBACK_IMAGE;
  const allergens = recipe?.detected_allergens || [];

  // compute overlap between user allergens and recipe allergens
  const conflicts = useMemo(() => {
    const avoidSet = new Set((userAllergens || []).map((x) => String(x).toLowerCase()));
    const detectedAllergens = (allergens || []).map((x) => String(x).toLowerCase());
    return detectedAllergens.filter((a) => avoidSet.has(a));
  }, [userAllergens, allergens]);

  // swap to fallback image when source fails
  const handleImageError = (e) => {
    if (e.target.src !== FALLBACK_IMAGE) {
      e.target.src = FALLBACK_IMAGE;
    }
  };

  // open recipe details and optionally count a view
  const goToRecipe = (e) => {
    if (e) e.preventDefault();
    if (!recipe?.id) return;
    if (countView) incrementRecipeView(recipe.id);
    navigate(`/recipe/${recipe.id}`, { state: { from: "search" } });
  };

  const handleContextMenu = (e) => e.preventDefault();

  if (loading) {
    return (
      <div className="search-result-card search-result-card--skeleton" aria-busy="true">
        <div className="search-result-card__image-container search-result-card__skeleton search-result-card__skeleton-block" />
        <div className="search-result-card__skeleton search-result-card__skeleton-line search-result-card__skeleton-line--title" />
        <div className="search-result-card__skeleton search-result-card__skeleton-line" />
        <div className="search-result-card__skeleton search-result-card__skeleton-line search-result-card__skeleton-line--short" />
      </div>
    );
  }

  if (!recipe) return null;

  return (
    <div
      className="search-result-card"
      role="button"
      tabIndex={0}
      onClick={goToRecipe}
      onContextMenu={handleContextMenu}
      onKeyDown={(e) => e.key === "Enter" && goToRecipe(e)}
    >
      <div className="search-result-card__image-container">
        <img
          src={imageUrl}
          alt=""
          onError={handleImageError}
          draggable="false"
          loading="lazy"
        />
        <div className="search-result-card__image-shield" />
      </div>

      <h3 className="search-result-card__title">{title}</h3>

      {user && conflicts.length > 0 && (
        <div className="search-result-card__warning">
          ⚠ Contains your allergens: <strong>{conflicts.join(", ")}</strong>
        </div>
      )}

      <p className="search-result-card__allergens">
        <strong>Detected allergens:</strong>{" "}
        {allergens.length ? allergens.join(", ") : "None"}
      </p>
    </div>
  );
}

export default SearchResultCard;
