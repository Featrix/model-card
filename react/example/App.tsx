import React from 'react';
import ModelCard, { ModelCardData } from './ModelCard';

// Example usage of the ModelCard component
const ExampleApp: React.FC = () => {
  // Example model card data (truncated for brevity)
  const exampleModelCard: ModelCardData = {
    model_identification: {
      session_id: 'public-alphafreight-mini-8c482fa5-1304-442d-8875-4263d5bf79d6',
      job_id: 'cadab2-20251118-010809',
      name: 'alphafreight-mini',
      target_column: 'has_fuel_card_Comdata',
      target_column_type: 'set',
      compute_cluster: 'BURRITO',
      training_date: '2025-11-18',
      status: 'DONE',
      model_type: 'Single Predictor',
      framework: 'FeatrixSphere v0.2.968',
    },
    training_dataset: {
      train_rows: 431,
      val_rows: 108,
      total_rows: 539,
      total_features: 15,
      feature_names: [
        'fleet_size',
        'annual_revenue',
        'primary_operation',
        'vehicle_types',
        'operating_regions',
        'insurance_provider',
        'fuel_program',
        'maintenance_program',
        'driver_count',
        'years_in_business',
        'fleet_age_avg',
        'miles_per_year',
        'fuel_efficiency',
        'safety_rating',
        'compliance_score',
      ],
      target_column: 'has_fuel_card_Comdata',
    },
    feature_inventory: [
      {
        name: 'fleet_size',
        type: 'scalar',
        encoder_type: 'ScalarCodec',
        unique_values: null,
        sample_values: null,
        statistics: {
          min: 5.0,
          max: 500.0,
          mean: 45.2,
          std: 78.5,
          median: 25.0,
        },
      },
      {
        name: 'primary_operation',
        type: 'set',
        encoder_type: 'SetCodec',
        unique_values: 8,
        sample_values: ['long_haul', 'local_delivery', 'regional', 'interstate', 'specialized'],
        statistics: null,
      },
    ],
    training_configuration: {
      epochs_total: 32,
      best_epoch: 28,
      d_model: 512,
      batch_size: 64,
      learning_rate: 0.001,
      optimizer: 'Adam',
    },
    training_metrics: {
      best_epoch: {
        epoch: 28,
        validation_loss: 0.1334,
        train_loss: 0.1256,
      },
      classification_metrics: {
        accuracy: 0.925,
        precision: 0.912,
        recall: 0.887,
        f1: 0.899,
        auc: 0.967,
        is_binary: true,
      },
      optimal_threshold: {
        optimal_threshold: 0.452,
        pos_label: 'true',
        optimal_threshold_f1: 0.899,
        accuracy_at_optimal_threshold: 0.925,
      },
      argmax_metrics: {
        accuracy: 0.918,
        precision: 0.905,
        recall: 0.875,
        f1: 0.89,
      },
    },
    model_architecture: {
      predictor_layers: 5,
      predictor_parameters: 264925317,
      embedding_space_d_model: 512,
    },
    model_quality: {
      assessment: null,
      recommendations: null,
      warnings: [
        {
          type: 'CLASS_IMBALANCE',
          severity: 'MODERATE',
          message: 'Class imbalance detected: positive class represents 35% of training data',
          details: null,
          recommendation: 'Consider using class weights or oversampling techniques',
        },
      ],
      training_quality_warning: null,
    },
    technical_details: {
      pytorch_version: '2.1.0',
      device: 'GPU',
      precision: 'float32',
      normalization: null,
      loss_function: 'CrossEntropyLoss',
    },
    provenance: {
      created_at: '2025-11-18T01:08:09.123456',
      training_duration_minutes: 45.2,
      version_info: null,
    },
    column_statistics: {
      fleet_size: {
        mutual_information_bits: 2.34,
        marginal_loss: 0.012,
      },
      annual_revenue: {
        mutual_information_bits: 1.87,
        marginal_loss: 0.008,
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

