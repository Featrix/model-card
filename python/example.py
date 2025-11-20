#!/usr/bin/env python3
"""
Example usage of the Featrix Model Card Python package.
Demonstrates rendering to strings, files, and printing.
"""

import json
from featrix_modelcard import (
    render_html,
    render_html_to_file,
    render_brief_text,
    render_detailed_text,
    render_text_to_file,
    print_html,
    print_text,
)

# Example model card JSON
example_model_card = {
    "model_identification": {
        "session_id": "public-alphafreight-mini-8c482fa5-1304-442d-8875-4263d5bf79d6",
        "job_id": "cadab2-20251118-010809",
        "name": "alphafreight-mini",
        "target_column": "has_fuel_card_Comdata",
        "target_column_type": "set",
        "compute_cluster": "BURRITO",
        "training_date": "2025-11-18",
        "status": "DONE",
        "model_type": "Single Predictor",
        "framework": "FeatrixSphere v0.2.968"
    },
    "training_dataset": {
        "train_rows": 431,
        "val_rows": 108,
        "total_rows": 539,
        "total_features": 15,
        "feature_names": [
            "fleet_size",
            "annual_revenue",
            "primary_operation",
            "vehicle_types",
            "operating_regions"
        ],
        "target_column": "has_fuel_card_Comdata"
    },
    "training_metrics": {
        "best_epoch": {
            "epoch": 28,
            "validation_loss": 0.1334,
            "train_loss": 0.1256
        },
        "classification_metrics": {
            "accuracy": 0.925,
            "precision": 0.912,
            "recall": 0.887,
            "f1": 0.899,
            "auc": 0.967,
            "is_binary": True
        }
    },
    "model_quality": {
        "warnings": [
            {
                "type": "CLASS_IMBALANCE",
                "severity": "MODERATE",
                "message": "Class imbalance detected: positive class represents 35% of training data"
            }
        ]
    }
}


def main():
    """Demonstrate various rendering methods."""
    print("=" * 60)
    print("Featrix Model Card - Python Package Examples")
    print("=" * 60)
    print()

    # Example 1: Print brief summary to console
    print("Example 1: Print brief summary to console")
    print("-" * 60)
    print_text(example_model_card, detailed=False)
    print()

    # Example 2: Get HTML as string
    print("Example 2: Get HTML as string")
    print("-" * 60)
    html_string = render_html(example_model_card)
    print(f"HTML string length: {len(html_string)} characters")
    print(f"First 100 chars: {html_string[:100]}...")
    print()

    # Example 3: Get detailed text as string
    print("Example 3: Get detailed text as string")
    print("-" * 60)
    detailed_text = render_detailed_text(example_model_card)
    print(f"Detailed text length: {len(detailed_text)} characters")
    print(f"First 200 chars:\n{detailed_text[:200]}...")
    print()

    # Example 4: Save to files
    print("Example 4: Save to files")
    print("-" * 60)
    html_path = render_html_to_file(example_model_card, "example_model_card.html")
    print(f"✅ HTML saved to: {html_path}")

    text_path = render_text_to_file(example_model_card, "example_model_card.txt", detailed=True)
    print(f"✅ Text saved to: {text_path}")
    print()

    # Example 5: Print HTML to console (for piping)
    print("Example 5: Print HTML to console")
    print("-" * 60)
    print("(Uncomment the line below to see full HTML output)")
    # print_html(example_model_card)
    print("Use: python example.py | tee output.html")
    print()

    # Example 6: Use in web application
    print("Example 6: Use in web application (Flask example)")
    print("-" * 60)
    print("""
from flask import Flask
from featrix_modelcard import render_html

app = Flask(__name__)

@app.route('/model-card')
def model_card():
    model_card_json = load_model_card()  # Your function
    html = render_html(model_card_json)
    return html
    """)
    print()

    print("Done! Check the generated files.")


if __name__ == "__main__":
    main()

