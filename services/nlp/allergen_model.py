import re
from typing import Dict, List, Set

from spacy.matcher import PhraseMatcher

from services.nlp.nlp import NLP

# spaCy matcher where each rule name is the canonical allergen label
_MATCHER = PhraseMatcher(NLP.vocab, attr="LOWER")

# canonical allergen mapped to ingredient words and phrases to match
ALLERGEN_SYNONYMS: Dict[str, Set[str]] = {
    "celery": {"celery", "celeriac", "celery salt", "celery seed", "celery powder"},
    "cereals containing gluten": {
        "gluten", "wheat", "barley", "rye", "oats", "spelt", "kamut", "triticale", "durum", "semolina",
        "couscous", "bulgur", "farro", "malt", "malt extract", "malt syrup", "malt vinegar", "bread",
        "breadcrumbs", "flour", "wheat flour", "plain flour", "self raising flour", "pasta", "noodles",
        "ramen", "udon", "soba", "seitan", "vital wheat gluten", "beer", "ale", "soy sauce",
        "worcestershire sauce",
    },
    "crustaceans": {
        "shrimp", "shrimps", "prawn", "prawns", "crab", "lobster", "crayfish", "krill", "shrimp paste",
        "prawn paste", "belacan", "red curry paste",
    },
    "eggs": {
        "egg", "eggs", "egg white", "egg yolk", "albumen", "albumin", "mayonnaise", "mayo", "meringue",
        "egg wash",
    },
    "fish": {
        "fish", "salmon", "tuna", "cod", "haddock", "anchovy", "anchovies", "fish sauce", "surimi",
        "roe", "caviar", "worcestershire sauce",
    },
    "lupin": {"lupin", "lupine", "lupin flour", "lupin bean"},
    "milk": {
        "milk", "dairy", "butter", "ghee", "cream", "cheese", "yogurt", "yoghurt", "whey", "casein",
        "caseinate", "lactose", "buttermilk",
    },
    "molluscs": {
        "mussel", "mussels", "oyster", "oysters", "clam", "clams", "scallop", "scallops", "squid",
        "calamari", "octopus",
    },
    "mustard": {"mustard", "dijon", "mustard seed", "mustard seeds", "mustard powder"},
    "peanuts": {"peanut", "peanuts", "groundnut", "groundnuts", "arachis", "peanut butter", "peanut oil"},
    "sesame": {"sesame", "sesame seed", "sesame seeds", "tahini", "tahina", "sesame oil"},
    "soybeans": {
        "soy", "soya", "soybean", "soybeans", "tofu", "tempeh", "miso", "edamame", "soy sauce",
        "tamari", "soy lecithin", "lecithin", "e322",
    },
    "sulphur dioxide and sulphites": {
        "sulphite", "sulphites", "sulfite", "sulfites", "sulphur dioxide", "sulfur dioxide", "e220",
        "e221", "e222", "e223", "e224", "e226", "e227", "e228", "dried apricot", "dried apricots",
    },
    "tree nuts": {
        "almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "hazelnut", "hazelnuts",
        "pistachio", "pistachios", "pecan", "pecans", "macadamia", "brazil nut", "brazil nuts",
        "pine nut", "pine nuts", "chestnut", "chestnuts", "nut", "nuts", "nut butter", "marzipan",
        "praline",
    },
}

for allergen, phrases in ALLERGEN_SYNONYMS.items():
    _MATCHER.add(allergen, [NLP.make_doc(phrase) for phrase in sorted(phrases)])

# words to catch "X-free" labels (e.g., "gluten-free")
_FREE_ALIASES: Dict[str, Set[str]] = {
    "celery": {"celery"},
    "cereals containing gluten": {"gluten", "wheat", "barley", "rye", "oats"},
    "crustaceans": {"crustacean", "crustaceans", "shrimp", "prawn", "shellfish"},
    "eggs": {"egg", "eggs"},
    "fish": {"fish"},
    "lupin": {"lupin", "lupine"},
    "milk": {"milk", "dairy"},
    "molluscs": {"mollusc", "molluscs", "mollusk", "mollusks"},
    "mustard": {"mustard"},
    "peanuts": {"peanut", "peanuts"},
    "sesame": {"sesame"},
    "soybeans": {"soy", "soya", "soybean", "soybeans"},
    "sulphur dioxide and sulphites": {"sulphite", "sulphites", "sulfite", "sulfites"},
    "tree nuts": {"nut", "nuts", "tree nut", "tree nuts"},
}

# named regex rules used to remove likely false positives
_SPECIAL_EXCLUSIONS: Dict[str, Dict[str, re.Pattern[str]]] = {
    "milk": {
        "coconut_milk": re.compile(r"\bcoconut milk\b"),
        "almond_milk": re.compile(r"\balmond milk\b"),
        "oat_milk": re.compile(r"\boat milk\b"),
        "soy_milk": re.compile(r"\bsoy milk\b"),
        "rice_milk": re.compile(r"\brice milk\b"),
        "cashew_milk": re.compile(r"\bcashew milk\b"),
        "butternut": re.compile(r"\bbutternut\b"),
    },
    "tree nuts": {
        "butternut": re.compile(r"\bbutternut\b"),
    },
}

def _is_free_claim(text: str, alias: str) -> bool:
    """Return True if text contains a direct allergen-free claim for alias"""
    escaped = re.escape(alias)
    patterns = [rf"\b{escaped}[-\s]?free\b"]
    return any(re.search(pattern, text) for pattern in patterns)

def _combine_text(title: str, ingredients: List[str], instructions: List[str]) -> str:
    """Join recipe fields into a single text block"""
    return " ".join([title or "", " ".join(ingredients or []), " ".join(instructions or [])]).strip()

def detect_allergens(title: str, ingredients: List[str], instructions: List[str]) -> List[str]:
    """Detect allergens found in the title, ingredients, or instructions"""
    combined_text = _combine_text(title, ingredients, instructions)
    if not combined_text:
        return []
    normalized_text = combined_text.lower()
    recipe_doc = NLP(combined_text)
    allergen_matches = _MATCHER(recipe_doc)
    detected_allergens = {NLP.vocab.strings[match_id] for (match_id, _, _) in allergen_matches}

    # drop allergens when exclusion patterns indicate a likely false match
    for allergen, rules in _SPECIAL_EXCLUSIONS.items():
        if allergen not in detected_allergens:
            continue
        has_exclusion = any(pattern.search(normalized_text) for pattern in rules.values())
        if not has_exclusion:
            continue
        detected_allergens.discard(allergen)

    # remove allergens explicitly marked as free (for example, "gluten-free").
    for allergen, aliases in _FREE_ALIASES.items():
        if any(_is_free_claim(normalized_text, alias) for alias in aliases):
            detected_allergens.discard(allergen)

    return sorted(detected_allergens)

