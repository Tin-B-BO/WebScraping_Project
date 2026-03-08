from typing import List, Dict

from spacy.matcher import PhraseMatcher

from services.nlp.nlp import NLP

# phrase matcher keyed by canonical protein category
_MATCHER = PhraseMatcher(NLP.vocab, attr="LOWER")

# protein categories mapped to keyword phrases
PROTEIN_KEYWORDS: Dict[str, List[str]] = {
    "poultry": [
        "chicken", "turkey", "duck", "goose", "quail",
        "pheasant", "cornish hen", "poussin"
    ],
    "pork": [
        "pork", "bacon", "ham", "pork belly", "pork chop",
        "pork loin", "ribs", "gammon", "pancetta",
        "prosciutto", "lard", "crackling"
    ],
    "red_meat": [
        "beef", "steak", "brisket", "short ribs", "ribeye",
        "sirloin", "chuck", "lamb", "mutton", "veal",
        "venison", "goat", "bison", "elk"
    ],
    "seafood": [
        "salmon", "tuna", "cod", "haddock", "pollock", "hake",
        "halibut", "sole", "flounder", "tilapia", "snapper",
        "grouper", "bass", "sea bass", "swordfish",
        "mahi mahi", "trout", "anchovy", "anchovies",
        "sardine", "mackerel", "herring", "whitefish",
        "catfish", "carp", "barramundi", "monkfish", "eel",
        "shrimp", "prawn", "lobster", "crab", "crayfish",
        "crawfish", "langoustine", "scallop", "clam",
        "mussel", "oyster", "squid", "calamari",
        "octopus", "cuttlefish", "sea urchin"
    ],
    "preserved_meat": [
        "pepperoni", "chorizo", "sausage", "hot dog",
        "frankfurter", "salami", "mortadella", "meatball",
        "meatballs", "kielbasa", "bratwurst", "andouille",
        "black pudding", "blood sausage", "jerky",
        "pastrami", "corned beef"
    ],
    "vegetables": [
        "tofu", "tempeh", "lentil", "lentils", "chickpea", "chickpeas",
        "beans", "bean", "peas", "pea", "mushroom", "mushrooms",
        "eggplant", "aubergine", "zucchini", "courgette",
        "squash", "pumpkin", "cauliflower", "broccoli",
        "spinach", "kale", "cabbage", "jackfruit",
        "seitan", "plant based", "vegan", "vegetarian"
    ],
}

for ptype, phrases in PROTEIN_KEYWORDS.items():
    _MATCHER.add(ptype, [NLP.make_doc(p) for p in phrases])

# deterministic tie-break order when multiple categories are matched.
_PRIORITY = list(PROTEIN_KEYWORDS.keys())


def _combine_text(title: str, ingredients: List[str]) -> str:
    """Join title and ingredient lines into one analyzable text block"""
    return " ".join([title or "", " ".join(ingredients or [])]).strip()


def detect_protein_type(title: str, ingredients: List[str]) -> str:
    """Return the highest-priority protein category found in recipe text"""
    combined_text = _combine_text(title, ingredients)
    if not combined_text:
        return "others"

    recipe_doc = NLP(combined_text)
    category_matches = _MATCHER(recipe_doc)
    if not category_matches:
        return "others"

    matched_categories = {NLP.vocab.strings[m_id] for (m_id, _, _) in category_matches}
    for protein_category in _PRIORITY:
        if protein_category in matched_categories:
            return protein_category

    return "others"
