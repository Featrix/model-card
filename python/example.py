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
    print_text,
)

# Example model card JSON (current schema)
example_model_card = {
    "model_identification": {
        "session_id": "predictor-alphafreight-mini-8c482fa5-1304-442d-8875-4263d5bf79d6",
        "name": "alphafreight-mini",
        "target_column": "has_fuel_card_Comdata",
        "target_column_type": "set",
        "compute_cluster": "BURRITO",
        "training_date": "2026-01-15",
        "status": "done",
        "model_type": "Single Predictor",
        "framework": "FeatrixSphere v0.3",
    },
    "embedding_space": {
        "num_columns": 15,
        "num_layers": 8400,
        "num_parameters": 264925317,
        "d_model": 256,
        "num_rows": 5000,
    },
    "model_architecture": {
        "predictor_layers": 2100,
        "predictor_parameters": 66231329,
    },
    "best_epochs": {
        "best_roc_auc": {
            "epoch": 28,
            "roc_auc": 0.967,
            "classification_display_metadata": {
                "epoch": 28,
                "classification_metrics": {
                    "accuracy": {"value": 0.925},
                    "auc": {"value": 0.967},
                    "pr_auc": {"value": 0.891},
                    "f1": {"value": 0.899},
                },
                "confusion_matrix": {"tp": 34, "fn": 4, "fp": 3, "tn": 67},
            },
        },
        "best_pr_auc": {
            "epoch": 26,
            "pr_auc": 0.895,
            "classification_display_metadata": {
                "epoch": 26,
                "classification_metrics": {
                    "accuracy": {"value": 0.918},
                    "auc": {"value": 0.958},
                    "pr_auc": {"value": 0.895},
                    "f1": {"value": 0.890},
                },
                "confusion_matrix": {"tp": 36, "fn": 2, "fp": 5, "tn": 65},
            },
        },
    },
    "class_imbalance": {
        "total_samples": 539,
        "minority_class": "1",
        "majority_class": "0",
        "minority_class_count": 189,
        "majority_class_count": 350,
        "imbalance_ratio": 1.85,
        "train_distribution": {"0": 280, "1": 151},
        "val_distribution": {"0": 70, "1": 38},
    },
    "training_optimization": {
        "loss_function": "FocalLoss",
        "optimization_priority": "recall",
        "checkpoint_metric": "roc_auc",
        "focal_gamma": 2.0,
        "focal_alpha": 0.65,
        "class_weights": [1.0, 1.85],
    },
}


def main():
    """Demonstrate various rendering methods."""
    print("=" * 60)
    print("Featrix Model Card - Python Package Examples")
    print("=" * 60)
    print()

    # Brief text summary
    print("Brief summary:")
    print("-" * 60)
    print(render_brief_text(example_model_card))

    # Detailed text
    print("Detailed text:")
    print("-" * 60)
    print(render_detailed_text(example_model_card))

    # HTML (loads model-card.js from CDN)
    html = render_html(example_model_card)
    print(f"HTML: {len(html)} chars (loads JS renderer from CDN)")

    # HTML with sphere
    html_sphere = render_html(example_model_card, show_sphere=True)
    print(f"HTML with sphere: {len(html_sphere)} chars")

    # Save to files
    render_html_to_file(example_model_card, "example_output.html")
    render_text_to_file(example_model_card, "example_output.txt")
    print("Saved: example_output.html, example_output.txt")


if __name__ == "__main__":
    main()
