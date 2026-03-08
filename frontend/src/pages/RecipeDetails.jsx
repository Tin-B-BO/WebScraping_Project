import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchRecipeDetails, isRecipeSaved, saveRecipe, unsaveRecipe } from "../api/api";
import { useAuth } from "../context/AuthContext";
import "../styles/RecipeDetails.css";
import "../styles/Modal.css";
import FALLBACK_IMAGE from "../assets/replace.jpg";

const sourceNameMap = {
  bbc_food: "BBC Food",
  allrecipes: "AllRecipes",
  serious_eats: "Serious Eats",
};

function RecipeDetails() {
  // route and auth context dependencies
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // page state for details, save status, and modal flow
  const [recipeDetails, setRecipeDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [conflictingAllergens, setConflictingAllergens] = useState([]);

  // to ensure auto-save flow executes only once per page load
  const hasAutoSaveRunRef = useRef(false);

  const normalizedUserAllergens = (user?.allergens || []).map((item) => String(item).toLowerCase());
  const avoidedAllergensText = normalizedUserAllergens.length ? normalizedUserAllergens.join(", ") : "None";

  const pendingSaveIntent = location.state?.intent?.type === "save_recipe" ? location.state.intent : null;
  const shouldAutoSaveCurrentRecipe = !!pendingSaveIntent && String(pendingSaveIntent.recipeId) === String(id);

  // load recipe details and initial saved state
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetchRecipeDetails(id);
        if (!alive) return;
        setRecipeDetails(response);

        if (user) {
          try {
            // saved flag for current recipe
            const savedStatus = await isRecipeSaved(id);
            if (alive) setIsSaved(!!savedStatus.saved);
          } catch {
          }
        }
      } catch {
        if (!alive) return;
        setRecipeDetails({ error: "Could not load recipe details." });
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, user]);

  // compute allergen conflicts between user profile and recipe
  const allergenConflicts = useMemo(() => {
    const detectedAllergens = (recipeDetails?.detected_allergens || []).map((item) => String(item).toLowerCase());
    const avoidSet = new Set(normalizedUserAllergens);
    return detectedAllergens.filter((item) => avoidSet.has(item));
  }, [recipeDetails, normalizedUserAllergens]);

  // format source key into display label
  const displaySourceName = useMemo(() => {
    const rawSource = recipeDetails?.source || "Unknown";
    return sourceNameMap[rawSource.toLowerCase()] || rawSource;
  }, [recipeDetails]);

  // navigate back to previous page or search page
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/search");
  };

  // execute save or unsave action
  const saveToggle = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // unsave when already saved, otherwise save
      if (isSaved) {
        await unsaveRecipe(id);
        setIsSaved(false);
      } else {
        await saveRecipe(id);
        setIsSaved(true);
      }
    } catch {
      alert("Save action failed.");
    } finally {
      setIsSaving(false);
    }
  };

  // handle save button click
  const handleSaveClick = () => {
    if (!user) {
      // redirect unauthenticated user to login
      navigate("/login", {
        state: {
          returnTo: `/recipe/${id}`,
          intent: { type: "save_recipe", recipeId: id },
        },
      });
      return;
    }

    if (!isSaved && allergenConflicts.length > 0) {
      // confirm intent if recipe conflicts with user allergen profile
      setConflictingAllergens(allergenConflicts);
      setIsModalOpen(true);
      return;
    }
    saveToggle();
  };

  const handleImageError = (e) => {
    if (e.target.src !== FALLBACK_IMAGE) {
      e.target.src = FALLBACK_IMAGE;
    }
  };

  // auto-save flow after login redirect when intent is present
  useEffect(() => {
    // run only for login return save flow targeting current recipe
    if (!user || !shouldAutoSaveCurrentRecipe || hasAutoSaveRunRef.current) return;
    hasAutoSaveRunRef.current = true;

    (async () => {
      try {
        // skip auto-save flow when this recipe is already saved
        const savedStatus = await isRecipeSaved(id);
        if (savedStatus?.saved) {
          setIsSaved(true);
          navigate(location.pathname, { replace: true, state: {} });
          return;
        }
      } catch {
      }

      if (allergenConflicts.length > 0) {
        // require explicit confirmation when conflicts exist
        setConflictingAllergens(allergenConflicts);
        setIsModalOpen(true);
        return;
      }

      // auto-save immediately when no conflicts are detected
      setIsSaving(true);
      try {
        await saveRecipe(id);
        setIsSaved(true);
      } catch {
        // ignore and allow user to retry manually
      } finally {
        setIsSaving(false);
        navigate(location.pathname, { replace: true, state: {} });
      }
    })();
  }, [
    user,
    shouldAutoSaveCurrentRecipe,
    id,
    allergenConflicts.length,
    navigate,
    location.pathname,
  ]);

  if (isLoading) return <p className="recipe-details__loading">Loading...</p>;
  if (!recipeDetails) return <p className="recipe-details__loading">No data.</p>;
  if (recipeDetails.error) return <p className="recipe-details__loading">{recipeDetails.error}</p>;

  return (
    <div className="recipe-details">
      <div className="recipe-details__topbar">
        <div className="recipe-details__actions">
          <button
            type="button"
            className="recipe-details__back-btn"
            onClick={handleBack}
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 100 100"
              fill="none"
              stroke="#666"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="recipe-details__back-icon"
              aria-hidden="true"
            >
              <polyline points="60,20 30,50 60,80" />
            </svg>
            <span>Back</span>
          </button>

          <button
            className="recipe-details__save-btn"
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            title={!user ? "Login required" : ""}
          >
            {isSaving ? "..." : isSaved ? "Saved" : "Save"}
          </button>
        </div>

        {user && (
          <div className="recipe-details__allergen-stack">
            <div className="recipe-details__avoiding-bar">
              You're currently <strong>Avoiding</strong>: {avoidedAllergensText}
            </div>
            {allergenConflicts.length > 0 && (
              <div className="recipe-details__warning-banner">
                Warning: This recipe contains: <strong>{allergenConflicts.join(", ")}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="recipe-details__layout">
        <div className="recipe-details__left">
          <div className="recipe-details__title-row">
            <h2 className="recipe-details__title">{recipeDetails.title || "Recipe Title"}</h2>
          </div>

          <div className="recipe-details__image-wrap">
            <img
              className="recipe-details__image"
              src={recipeDetails.image_url || FALLBACK_IMAGE}
              alt={recipeDetails.title || "Recipe"}
              onError={handleImageError}
            />
          </div>

          <div className="recipe-details__meta-grid">
            {recipeDetails.prep_time && (
              <div className="recipe-details__meta-item">
                <div className="recipe-details__meta-label">Prep Time:</div>
                <div className="recipe-details__meta-value">{recipeDetails.prep_time}</div>
              </div>
            )}

            {recipeDetails.cook_time && (
              <div className="recipe-details__meta-item">
                <div className="recipe-details__meta-label">Cook Time:</div>
                <div className="recipe-details__meta-value">{recipeDetails.cook_time}</div>
              </div>
            )}

            {recipeDetails.servings && (
              <div className="recipe-details__meta-item">
                <div className="recipe-details__meta-label">Servings:</div>
                <div className="recipe-details__meta-value">{recipeDetails.servings}</div>
              </div>
            )}

            {recipeDetails.total_time && (
              <div className="recipe-details__meta-item">
                <div className="recipe-details__meta-label">Total Time:</div>
                <div className="recipe-details__meta-value">{recipeDetails.total_time}</div>
              </div>
            )}
          </div>

          <div className="recipe-details__separator" />

          <div className="recipe-details__allergens-card">
            <span className="recipe-details__allergy-label">Allergy Info:</span>
            <span className="recipe-details__allergy-value">
              {(recipeDetails.detected_allergens || []).length
                ? recipeDetails.detected_allergens.join(", ")
                : "None"}
            </span>
          </div>

          <p className="recipe-details__allergen-disclaimer">
            <strong>Note:</strong> Automated filtering may not be 100% accurate. Users are responsible for verifying all ingredients before consumption.
          </p>

          <div className="recipe-details__separator" />

          <div className="recipe-details__chip-row">
            <span className="recipe-details__chip">Ingredients</span>
          </div>

          <div className="recipe-details__ingredients-box">
            <ul className="recipe-details__list">
              {(recipeDetails.ingredients || []).map((ingredient, index) => (
                <li key={index} className="recipe-details__ingredient-item">
                  <input
                    type="checkbox"
                    id={`ingredient-${index}`}
                    className="recipe-details__ingredient-checkbox"
                  />
                  <label htmlFor={`ingredient-${index}`}>{String(ingredient).trim()}</label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="recipe-details__right">
          <div className="recipe-details__right-head">
            <h3 className="recipe-details__right-title">Instructions</h3>
          </div>

          <ol className="recipe-details__instructions">
            {(recipeDetails.instructions || []).map((step, index) => (
              <li key={index}>{String(step).trim()}</li>
            ))}
          </ol>

          <div className="recipe-details__source">
            <span className="recipe-details__source-label">Credited to:</span> {displaySourceName}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Allergen Warning</h3>
            <p>
              This recipe contains your allergens: <strong>{conflictingAllergens.join(", ")}</strong>
            </p>
            <p>Do you still want to save it?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  setIsModalOpen(false);
                  if (!user) return;
                  setIsSaving(true);
                  try {
                    await saveRecipe(id);
                    setIsSaved(true);
                  } catch {
                    // ignore and allow user retry
                  } finally {
                    setIsSaving(false);
                    navigate(location.pathname, { replace: true, state: {} });
                  }
                }}
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipeDetails;
