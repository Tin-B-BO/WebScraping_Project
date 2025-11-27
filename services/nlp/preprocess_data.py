import json
import re
import spacy
from pathlib import Path

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

def clean_text(text: str) -> str:
    """Basic cleaning: remove punctuation, extra spaces, lowercase."""
    text = text.lower()
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text)  # keep letters/numbers only
    text = re.sub(r"\s+", " ", text).strip()
    return text

def preprocess_list(text_list):
    """Clean list fields such as ingredients or instructions."""
    cleaned = []
    for item in text_list:
        if item and item.strip():
            cleaned.append(clean_text(item))
    return cleaned

def tokenise_text(text: str):
    """Tokenises text into lemmas using spaCy."""
    doc = nlp(text)
    return [token.lemma_ for token in doc if not token.is_stop and token.is_alpha]

# Main Preprocessing
def preprocess_dataset(input_path: str, output_path: str):
    # Load scraped test data
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    processed = []
    for recipe in data:
        title = clean_text(recipe.get("title", ""))

        ingredients = preprocess_list(recipe.get("ingredients_raw", []))
        instructions = preprocess_list(recipe.get("instructions_raw", []))
        # Join ingredients into single string for NLP
        combined_text = " ".join(ingredients + instructions)
        tokens = tokenise_text(combined_text)
        processed.append({
            "url": recipe.get("url"),
            "source": recipe.get("source"),
            "title": title,
            "ingredients_clean": ingredients,
            "instructions_clean": instructions,
            "tokens": tokens
        })
    # Save processed dataset
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(processed, f, indent=4)

# Run when executed directly
if __name__ == "__main__":
    preprocess_dataset("test_data.json", "processed_data.json")
