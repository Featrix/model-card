#!/usr/bin/env python3
"""
Example usage of the Featrix Sphere Model Card renderers.
"""

import json
from renderers import render_html_to_file, render_text_to_file

# Example model card JSON (from the specification)
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
            "operating_regions",
            "insurance_provider",
            "fuel_program",
            "maintenance_program",
            "driver_count",
            "years_in_business",
            "fleet_age_avg",
            "miles_per_year",
            "fuel_efficiency",
            "safety_rating",
            "compliance_score"
        ],
        "target_column": "has_fuel_card_Comdata"
    },
    "feature_inventory": [
        {
            "name": "fleet_size",
            "type": "scalar",
            "encoder_type": "ScalarCodec",
            "statistics": {
                "min": 5.0,
                "max": 500.0,
                "mean": 45.2,
                "std": 78.5,
                "median": 25.0
            }
        },
        {
            "name": "primary_operation",
            "type": "set",
            "encoder_type": "SetCodec",
            "unique_values": 8,
            "sample_values": [
                "long_haul",
                "local_delivery",
                "regional",
                "interstate",
                "specialized"
            ]
        }
    ],
    "training_configuration": {
        "epochs_total": 32,
        "best_epoch": 28,
        "d_model": 512,
        "batch_size": 64,
        "learning_rate": 0.001,
        "optimizer": "Adam"
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
        },
        "optimal_threshold": {
            "optimal_threshold": 0.452,
            "pos_label": "true",
            "optimal_threshold_f1": 0.899,
            "accuracy_at_optimal_threshold": 0.925
        }
    },
    "model_architecture": {
        "predictor_layers": 5,
        "predictor_parameters": 264925317,
        "embedding_space_d_model": 512
    },
    "model_quality": {
        "warnings": [
            {
                "type": "CLASS_IMBALANCE",
                "severity": "MODERATE",
                "message": "Class imbalance detected: positive class represents 35% of training data",
                "recommendation": "Consider using class weights or oversampling techniques"
            }
        ],
        "training_quality_warning": None
    },
    "technical_details": {
        "pytorch_version": "2.1.0",
        "device": "GPU",
        "precision": "float32",
        "loss_function": "CrossEntropyLoss"
    },
    "provenance": {
        "created_at": "2025-11-18T01:08:09.123456",
        "training_duration_minutes": 45.2
    },
    "column_statistics": {
        "fleet_size": {
            "mutual_information_bits": 2.34,
            "marginal_loss": 0.012
        },
        "annual_revenue": {
            "mutual_information_bits": 1.87,
            "marginal_loss": 0.008
        }
    }
}


def main():
    """Generate example model card outputs."""
    print("Generating model card outputs...")
    
    # Generate HTML output
    html_path = render_html_to_file(example_model_card, "example_model_card.html")
    print(f"✅ HTML model card saved to: {html_path}")
    
    # Generate detailed text output
    detailed_text_path = render_text_to_file(example_model_card, "example_model_card_detailed.txt", detailed=True)
    print(f"✅ Detailed text model card saved to: {detailed_text_path}")
    
    # Generate brief text output
    brief_text_path = render_text_to_file(example_model_card, "example_model_card_brief.txt", detailed=False)
    print(f"✅ Brief text model card saved to: {brief_text_path}")
    
    print("\nDone! Check the generated files.")


if __name__ == "__main__":
    main()

