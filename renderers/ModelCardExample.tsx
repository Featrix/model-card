import React from 'react';
import ModelCard, { ModelCardData } from './ModelCard';

// Example usage of the ModelCard component
const ExampleApp: React.FC = () => {
  // Example model card data (truncated for brevity)
  const exampleModelCard: ModelCardData = {
    model_identification: {
      session_id: 'example-demo-model-8c482fa5-1304-442d-8875-4263d5bf79d6',
      name: 'demo-model',
      target_column: 'target_label',
      target_column_type: 'set',
      compute_cluster: 'DEFAULT',
      training_date: '2026-01-15',
      status: 'done',
      model_type: 'Single Predictor',
      framework: 'FeatrixSphere v0.3',
    },
    embedding_space: {
      num_columns: 15,
      num_layers: 8400,
      num_parameters: 264925317,
      d_model: 256,
      num_rows: 5000,
    },
    class_imbalance: {
      total_samples: 539,
      minority_class: '1',
      majority_class: '0',
      minority_class_count: 189,
      majority_class_count: 350,
      imbalance_ratio: 1.85,
      train_distribution: { '0': 280, '1': 151 },
      val_distribution: { '0': 70, '1': 38 },
    },
    best_epochs: {
      best_roc_auc: {
        epoch: 28,
        roc_auc: 0.967,
        classification_display_metadata: {
          epoch: 28,
          classification_metrics: {
            accuracy: { value: 0.925, quality: 'EXCELLENT', trend: '↗', delta_1: 0.005, delta_5: 0.02, delta_10: null },
            auc: { value: 0.967, quality: 'EXCELLENT', trend: '↗', delta_1: 0.003, delta_5: 0.015, delta_10: null },
            pr_auc: { value: 0.891, quality: 'GOOD', trend: '↗', delta_1: 0.008, delta_5: 0.025, delta_10: null },
            f1: { value: 0.899, quality: 'GOOD', trend: '↗', delta_1: 0.004, delta_5: 0.018, delta_10: null },
            precision: { value: 0.912, quality: 'EXCELLENT', trend: '↗↗', delta_1: 0.01, delta_5: 0.03, delta_10: null },
            recall: { value: 0.887, quality: 'GOOD', trend: '→', delta_1: 0, delta_5: 0.01, delta_10: null },
            specificity: { value: 0.945, quality: 'EXCELLENT', trend: '↗', delta_1: 0.002, delta_5: 0.012, delta_10: null },
          },
          confusion_matrix: {
            tp: 34, fn: 4, fp: 3, tn: 67,
            threshold: 0.45, precision: 0.912, recall: 0.887, specificity: 0.945,
          },
          per_row_tracking: {
            this_epoch: { correct: 101, wrong: 7, accuracy_pct: 93.5 },
            cumulative_categories: { never_wrong: 75, rarely_wrong: 15, sometimes_wrong: 10, frequently_wrong: 5, always_wrong: 3 },
          },
        },
      },
      best_pr_auc: {
        epoch: 26,
        pr_auc: 0.891,
        classification_display_metadata: {
          epoch: 26,
          classification_metrics: {
            accuracy: { value: 0.918, quality: 'EXCELLENT', trend: '↗', delta_1: 0.003, delta_5: 0.015, delta_10: null },
            auc: { value: 0.958, quality: 'EXCELLENT', trend: '↗', delta_1: 0.005, delta_5: 0.02, delta_10: null },
            pr_auc: { value: 0.895, quality: 'GOOD', trend: '↗↗', delta_1: 0.012, delta_5: 0.035, delta_10: null },
            f1: { value: 0.89, quality: 'GOOD', trend: '↗', delta_1: 0.006, delta_5: 0.022, delta_10: null },
            precision: { value: 0.88, quality: 'GOOD', trend: '↗', delta_1: 0.008, delta_5: 0.025, delta_10: null },
            recall: { value: 0.9, quality: 'EXCELLENT', trend: '↗↗', delta_1: 0.015, delta_5: 0.04, delta_10: null },
            specificity: { value: 0.928, quality: 'EXCELLENT', trend: '→', delta_1: 0, delta_5: 0.008, delta_10: null },
          },
          confusion_matrix: {
            tp: 36, fn: 2, fp: 5, tn: 65,
            threshold: 0.38, precision: 0.88, recall: 0.9, specificity: 0.928,
          },
          per_row_tracking: {
            this_epoch: { correct: 99, wrong: 9, accuracy_pct: 91.7 },
            cumulative_categories: { never_wrong: 72, rarely_wrong: 17, sometimes_wrong: 11, frequently_wrong: 6, always_wrong: 2 },
          },
        },
      },
    },
  };

  return (
    <div>
      <ModelCard data={exampleModelCard} />
    </div>
  );
};

export default ExampleApp;
