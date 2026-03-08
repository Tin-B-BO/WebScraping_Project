import json
import os
import sys
from pathlib import Path
from sklearn.metrics import f1_score, classification_report
from sklearn.preprocessing import MultiLabelBinarizer

# setup path to find project root
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, root_path)

from services.nlp.preprocess import clean_raw_fields
from services.nlp.allergen_model import detect_allergens

# read samples.json from the same folder as this script
GOLD_FILE = Path(__file__).with_name("samples.json")

ALL_LABELS = [
    "celery",
    "cereals containing gluten",
    "crustaceans",
    "eggs",
    "fish",
    "lupin",
    "milk",
    "molluscs",
    "mustard",
    "peanuts",
    "sesame",
    "soybeans",
    "sulphur dioxide and sulphites",
    "tree nuts"
]


def main():
    if not GOLD_FILE.exists():
        print(f"Error: {GOLD_FILE} not found. Please create/export samples.json first.")
        return

    y_true = []
    y_pred = []

    print("Processing recipes and running NLP detection...")

    with open(GOLD_FILE, "r", encoding="utf-8-sig") as f:
        samples = json.load(f)

    if not isinstance(samples, list):
        print("Error: samples.json must contain a JSON array of sample objects.")
        return

    for idx, sample in enumerate(samples, 1):
        try:
            # 1. Ground Truth (manual labels)
            gold = sample.get("gold_allergens", [])
            y_true.append(gold)

            # 2. Prediction (actual NLP logic)
            title_c, ing_c, ins_c = clean_raw_fields(
                sample.get("title", ""),
                sample.get("ingredients_raw", []) or [],
                sample.get("instructions_raw", []) or []
            )

            prediction = detect_allergens(title_c, ing_c, ins_c)
            y_pred.append(prediction)
        except Exception as e:
            print(f"Warning: Error on sample {idx}: {e}")

    # initialize the Binarizer with 14 specific labels
    mlb = MultiLabelBinarizer(classes=ALL_LABELS)

    # transform labels into binary format (0 or 1 for each allergen)
    try:
        y_true_bin = mlb.fit_transform(y_true)
        y_pred_bin = mlb.transform(y_pred)
    except ValueError as e:
        print(f"Label Error: {e}")
        print("Check if manual labels in samples.json match the ALL_LABELS list exactly.")
        return

    # Calculate Global Metrics
    f1_macro = f1_score(y_true_bin, y_pred_bin, average='macro', zero_division=0)

    print("\n" + "=" * 40)
    print("      NLP ALLERGEN MODEL PERFORMANCE")
    print("=" * 40)
    print(f"Total Samples:     {len(y_true)}")
    print(f"Macro F1 Score:    {f1_macro:.2f}")
    print("-" * 40)

    print("\nPer-Allergen Breakdown:")
    print(
        classification_report(
            y_true_bin,
            y_pred_bin,
            target_names=ALL_LABELS,
            zero_division=0,
        )
    )


if __name__ == "__main__":
    main()
