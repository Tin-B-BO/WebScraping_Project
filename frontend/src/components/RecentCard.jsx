import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/RecentCard.css";
import FALLBACK_IMAGE from "../assets/replace.jpg";

function RecentCard({ recipe, userAllergens = [], className = "" }) {
  const navigate = useNavigate();
  const title = recipe?.title || "Untitled";
  const image = recipe?.image_url || FALLBACK_IMAGE;
  const allergens = recipe?.detected_allergens || [];

  // check whether this recipe includes any allergen selected by the user
  const showWarning = useMemo(() => {
    const detectedAllergens = (allergens || []).map((a) => String(a).toLowerCase());
    const userAllergenSet = new Set((userAllergens || []).map((a) => String(a).toLowerCase()));
    return detectedAllergens.some((a) => userAllergenSet.has(a));
  }, [allergens, userAllergens]);

  // open recipe details from recent section
  const goToRecipe = (e) => {
    if (e) e.preventDefault();
    navigate(`/recipe/${recipe.id}`, { state: { from: "recent" } });
  };

  const handleContextMenu = (e) => e.preventDefault();

  return (
    <div
      className={`recent-card ${className}`}
      onClick={goToRecipe}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
    >
      <div className="recent-card__image-wrap">
        <div className="recent-card__image-frame">
          <img
            src={image}
            alt=""
            draggable="false"
            onError={(e) => {
              e.target.src = FALLBACK_IMAGE;
            }}
          />
          <div className="recent-card__image-shield" />
        </div>
      </div>

      <div className="recent-card__body">
        <div className="recent-card__title">{title}</div>

        {showWarning && (
          <div className="recent-card__warning">
            <span className="recent-card__warning-icon">!</span>
            <span>Warning! Contains your allergens.</span>
          </div>
        )}

        <div className="recent-card__allergens">
          <strong>Detected allergens:</strong> {allergens.length ? allergens.join(", ") : "None"}
        </div>
      </div>
    </div>
  );
}

export default RecentCard;
