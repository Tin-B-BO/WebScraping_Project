import re
from typing import List, Tuple
from services.nlp.nlp import NLP

# Common mojibake variants seen for unicode fractions in scraped text.
UNICODE_FRACTIONS = {
    "¼": "1/4",
    "½": "1/2",
    "¾": "3/4",
    "⅓": "1/3",
    "⅔": "2/3",
    "⅕": "1/5",
    "⅛": "1/8",
}

def _normalize_fractions(text: str) -> str:
    """replace known unicode or mojibake fraction forms with ASCII fractions"""
    if not text:
        return ""
    for bad_token, replacement in UNICODE_FRACTIONS.items():
        text = text.replace(bad_token, replacement)
    return text

def _clean_line_keep_original(text: str) -> str:
    """trim, normalize fractions, and collapse repeated whitespace"""
    cleaned = (text or "").strip()
    cleaned = _normalize_fractions(cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned

def _clean_non_empty_lines(lines: List[str]) -> List[str]:
    """clean raw lines and keep only non-empty values"""
    cleaned_lines: List[str] = []
    for line in lines or []:
        cleaned = _clean_line_keep_original(str(line))
        if cleaned:
            cleaned_lines.append(cleaned)
    return cleaned_lines

def clean_raw_fields(
    title: str,
    ingredients_raw: List[str],
    instructions_raw: List[str],
) -> Tuple[str, List[str], List[str]]:
    """Normalize raw title/ingredients/instructions while preserving wording"""
    cleaned_title = _clean_line_keep_original(str(title))
    cleaned_ingredients = _clean_non_empty_lines(ingredients_raw)
    cleaned_instructions = _clean_non_empty_lines(instructions_raw)
    return cleaned_title, cleaned_ingredients, cleaned_instructions

def normalize_title_for_storage(title_raw: str) -> str:
    """Build a normalized title string for storage and search."""
    cleaned_title = _clean_line_keep_original(title_raw)
    if not cleaned_title:
        return ""
    doc = NLP(cleaned_title.lower())  # lowercase for consistency
    normalized_tokens: List[str] = []
    for token in doc:
        # skip spaces/punctuation and keep only meaningful tokens
        if token.is_space or token.is_punct:
            continue
        # use lemma (base form) to normalize title wording variants
        lemma = (token.lemma_ or token.text).lower().strip()
        if lemma:
            normalized_tokens.append(lemma)
    # Store as a single normalized text value
    return " ".join(normalized_tokens).strip()
