const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// read bearer token from local storage for authenticated requests
function getAuthHeaders() {
  const accessToken = localStorage.getItem("access_token");
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// start search or poll newer search results
export async function searchRecipes(payload = {}) {
  // prepare payload for search endpoint with fallback values
  const requestBody = {
    query: payload.query ?? "", // search text, fallback to empty string
    allergens: payload.allergens ?? null, // null means backend can use user saved allergens
    cursor_created_at: payload.cursor_created_at ?? null, // cursor timestamp used for polling newer items
  };

  // authenticated search request
  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) throw new Error((await response.text()) || "Search failed");
  return response.json();
}

// fetch full recipe details by recipe id
export async function fetchRecipeDetails(id) {
  // auth header is optional here but included when token exists
  const response = await fetch(`${API_BASE_URL}/api/recipes/${id}`, {
    headers: { ...getAuthHeaders() },
  });

  // return backend error text if request fails
  if (!response.ok) throw new Error((await response.text()) || "Details fetch failed");
  return response.json();
}

// increment recipe view count without blocking ui on failure
export async function incrementRecipeView(id) {
  // skip when id is missing
  if (!id) return;

  try {
    await fetch(`${API_BASE_URL}/api/recipes/${id}/view`, { method: "POST" });
  } catch {
  }
}

// load popular recipes with optional filters
export async function fetchPopularRecipes(payload = {}) {
  // build request body for popular endpoint
  const requestBody = {
    query: "",
    allergens: payload.allergens ?? [],
    meat_type: payload.meat_type ?? null,
    dish_type: payload.dish_type ?? null,
    cursor_created_at: null, // popular results start from fresh response
  };

  // authenticated popular request
  const response = await fetch(`${API_BASE_URL}/api/popular`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) throw new Error((await response.text()) || "Popular fetch failed");
  return response.json();
}

// create new account
export async function signup(payload) {
  // signup does not require auth header
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error((await response.text()) || "Signup failed");
  return response.json();
}

// login and receive auth token
export async function login(payload) {
  // login request uses public endpoint
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error((await response.text()) || "Login failed");
  return response.json();
}

// get current logged-in user profile
export async function fetchCurrentUser() {
  // uses bearer token when available
  const response = await fetch(`${API_BASE_URL}/api/auth/current-user`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error((await response.text()) || "Current user fetch failed");
  return response.json();
}

// update current user allergen preferences
export async function updateMyAllergens(allergens = []) {
  // send selected allergens array to profile endpoint
  const response = await fetch(`${API_BASE_URL}/api/me/allergens`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ allergens }),
  });

  if (!response.ok) throw new Error((await response.text()) || "Update allergens failed");
  return response.json();
}

// update user account password with old and new password
export async function updatePassword(payload) {
  // expected payload keys: old_password, new_password
  const response = await fetch(`${API_BASE_URL}/api/current-user/update-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error((await response.text()) || "Password update failed");
  return response.json();
}

// check if a recipe is already saved
export async function isRecipeSaved(recipeId) {
  // used by details page to set saved state
  const response = await fetch(`${API_BASE_URL}/api/me/saved/${recipeId}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error((await response.text()) || "IsSaved failed");
  return response.json();
}

// save a recipe to current user account
export async function saveRecipe(recipeId) {
  // create saved relation for current recipe id
  const response = await fetch(`${API_BASE_URL}/api/me/saved/${recipeId}`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error((await response.text()) || "Save failed");
  return response.json();
}

// remove a recipe from saved list
export async function unsaveRecipe(recipeId) {
  // delete saved relation for current recipe id
  const response = await fetch(`${API_BASE_URL}/api/me/saved/${recipeId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error((await response.text()) || "Unsave failed");
  return response.json();
}

// fetch all saved recipes for current user
export async function fetchSaved() {
  // load saved list for profile page
  const response = await fetch(`${API_BASE_URL}/api/me/saved`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error((await response.text()) || "Saved list failed");
  return response.json();
}

// fetch recent searched recipes for current user
export async function fetchRecent() {
  // load recent searches history list
  const response = await fetch(`${API_BASE_URL}/api/me/recent`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) throw new Error((await response.text()) || "Recent failed");
  return response.json();
}
