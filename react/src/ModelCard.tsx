import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Type definitions for the model card JSON structure
export interface ModelCardData {
  model_identification: {
    session_id: string;
    job_id: string;
    name: string;
    target_column: string | null;
    target_column_type: string | null;
    compute_cluster: string;
    training_date: string;
    status: string;
    model_type: string;
    framework: string;
  };
  training_dataset: {
    train_rows: number;
    val_rows: number;
    total_rows: number;
    total_features: number;
    feature_names: string[];
    target_column: string | null;
  };
  feature_inventory: Array<{
    name: string;
    type: string;
    encoder_type: string;
    unique_values: number | null;
    sample_values: string[] | null;
    statistics: {
      min: number;
      max: number;
      mean: number;
      std: number;
      median: number;
    } | null;
  }>;
  training_configuration: {
    epochs_total: number;
    best_epoch: number;
    d_model: number;
    batch_size: number | null;
    learning_rate: number | null;
    optimizer: string;
    dropout_schedule?: {
      enabled: boolean;
      initial: number;
      final: number;
    } | null;
  };
  training_metrics: {
    best_epoch: {
      epoch: number;
      validation_loss: number;
      train_loss: number;
      spread_loss?: number | null;
      joint_loss?: number | null;
      marginal_loss?: number | null;
    };
    classification_metrics?: {
      accuracy: number | null;
      precision: number | null;
      recall: number | null;
      f1: number | null;
      auc: number | null;
      is_binary: boolean;
    } | null;
    optimal_threshold?: {
      optimal_threshold: number;
      pos_label: string | null;
      optimal_threshold_f1: number;
      accuracy_at_optimal_threshold: number;
    } | null;
    argmax_metrics?: {
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
    } | null;
    final_epoch?: {
      epoch: number;
      train_loss: number;
      val_loss: number;
    } | null;
    loss_progression?: {
      initial_train: number;
      initial_val: number;
      improvement_pct: number | null;
    } | null;
  };
  model_architecture: {
    predictor_layers: number | null;
    predictor_parameters: number | null;
    embedding_space_d_model: number | null;
  };
  model_quality: {
    assessment: string | null;
    recommendations: Array<{
      issue: string;
      suggestion: string;
    }> | null;
    warnings: Array<{
      type: string;
      severity: string;
      message: string;
      details: any | null;
      recommendation: string | null;
    }>;
    training_quality_warning: string | null;
  };
  technical_details: {
    pytorch_version: string;
    device: string;
    precision: string;
    normalization: string | null;
    loss_function: string;
  };
  provenance: {
    created_at: string;
    training_duration_minutes: number | null;
    version_info: any | null;
  };
  column_statistics?: {
    [key: string]: {
      mutual_information_bits: number | null;
      marginal_loss: number | null;
    };
  };
}

interface ModelCardProps {
  data: ModelCardData;
  className?: string;
}

const COLORS = {
  primary: '#333',
  secondary: '#666',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#17a2b8',
  dark: '#000',
};

const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'done') return COLORS.success;
  if (statusLower === 'training') return COLORS.warning;
  if (statusLower === 'failed') return COLORS.danger;
  return COLORS.dark;
};

const getQualityColor = (assessment: string | null): string => {
  if (!assessment) return COLORS.dark;
  const assessmentLower = assessment.toLowerCase();
  if (assessmentLower === 'excellent') return COLORS.success;
  if (assessmentLower === 'good') return COLORS.info;
  if (assessmentLower === 'fair') return COLORS.warning;
  if (assessmentLower === 'poor') return '#fd7e14';
  return COLORS.dark;
};

const getSeverityColor = (severity: string): string => {
  const severityLower = severity.toLowerCase();
  if (severityLower === 'high') return COLORS.danger;
  if (severityLower === 'moderate') return COLORS.warning;
  if (severityLower === 'low') return COLORS.info;
  return COLORS.dark;
};

const formatValue = (value: any, precision: number = 4): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') {
    const formatted = value.toFixed(precision).replace(/\.?0+$/, '');
    return formatted;
  }
  return String(value);
};

const formatPercentage = (value: number | null): string => {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
};

const getModelTypeDisplay = (modelType: string, targetType: string | null): string => {
  if (!modelType) return 'N/A';
  const modelTypeLower = modelType.toLowerCase();
  const targetTypeLower = (targetType || '').toLowerCase();
  
  if (modelTypeLower === 'embedding space' || modelTypeLower === 'es') {
    return 'Foundational Embedding Space';
  } else if (modelTypeLower === 'single predictor' || modelTypeLower === 'sp') {
    if (targetTypeLower === 'set') {
      return 'Classifier';
    } else if (targetTypeLower === 'scalar') {
      return 'Regression';
    } else {
      return 'Single Predictor';
    }
  }
  return modelType;
};

export const ModelCard: React.FC<ModelCardProps> = ({ data, className = '' }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['model-identification', 'training-metrics', 'model-quality'])
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedSections(
      new Set([
        'model-identification',
        'training-dataset',
        'feature-inventory',
        'training-configuration',
        'training-metrics',
        'model-architecture',
        'model-quality',
        'technical-details',
        'provenance',
        'column-statistics',
      ])
    );
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Prepare data for charts
  const metricsChartData = useMemo(() => {
    if (data.model_identification.model_type !== 'Single Predictor') return null;
    
    const cm = data.training_metrics.classification_metrics;
    if (!cm) return null;

    return [
      { name: 'Accuracy', value: cm.accuracy || 0 },
      { name: 'Precision', value: cm.precision || 0 },
      { name: 'Recall', value: cm.recall || 0 },
      { name: 'F1', value: cm.f1 || 0 },
      { name: 'AUC', value: cm.auc || 0 },
    ].filter((item) => item.value > 0);
  }, [data]);

  const featureTypeDistribution = useMemo(() => {
    const typeCounts: { [key: string]: number } = {};
    data.feature_inventory.forEach((feat) => {
      typeCounts[feat.type] = (typeCounts[feat.type] || 0) + 1;
    });
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  }, [data]);

  const columnStatisticsData = useMemo(() => {
    if (!data.column_statistics) return null;
    return Object.entries(data.column_statistics)
      .map(([name, stats]) => ({
        name,
        mutualInfo: stats.mutual_information_bits || 0,
        marginalLoss: stats.marginal_loss || 0,
      }))
      .sort((a, b) => b.mutualInfo - a.mutualInfo)
      .slice(0, 10);
  }, [data]);

  const renderSection = (
    id: string,
    title: string,
    content: React.ReactNode,
    defaultOpen: boolean = false
  ) => {
    const isOpen = expandedSections.has(id);
    return (
      <div className="model-card-section" key={id}>
        <div
          className="section-header"
          onClick={() => toggleSection(id)}
          style={{ cursor: 'pointer' }}
        >
          <h2>{title}</h2>
          <span className="toggle-icon">{isOpen ? '▼' : '▶'}</span>
        </div>
        {isOpen && <div className="section-content">{content}</div>}
      </div>
    );
  };

  return (
    <div className={`model-card ${className}`}>
      <style>{`
        .model-card {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          background: #f5f5f5;
          color: #000;
        }
        
        .model-card * {
          color: #000;
        }
        
        .model-card-header {
          background: #000;
          color: white;
          padding: 30px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .model-card-header h1 {
          margin: 0 0 10px 0;
          font-size: 32px;
          color: white;
        }
        
        .model-card-header div {
          color: white;
        }
        
        .model-card-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          color: #000;
        }
        
        .model-card-controls button {
          padding: 8px 16px;
          background: ${COLORS.primary};
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .model-card-controls button:hover {
          background: #5568d3;
          color: white;
        }
        
        .model-card-section {
          background: white;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 3px double ${COLORS.primary};
          color: #000;
        }
        
        .section-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid ${COLORS.primary};
          color: #000;
        }
        
        .section-header h2 {
          margin: 0;
          font-size: 20px;
          color: #000;
        }
        
        .toggle-icon {
          font-size: 12px;
          color: #000;
        }
        
        .section-content {
          padding: 20px;
          color: #000;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 20px 0;
          color: #000;
        }
        
        .metric-card {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          border-left: 4px solid ${COLORS.primary};
          color: #000;
        }
        
        .metric-label {
          font-size: 12px;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        
        .metric-value {
          font-size: 24px;
          font-weight: bold;
          color: #000;
        }
        
        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          color: #000;
        }
        
        .info-table th {
          text-align: left;
          padding: 10px;
          background: #f8f9fa;
          font-weight: 600;
          width: 200px;
          border-bottom: 1px solid #ddd;
          color: #000;
        }
        
        .info-table td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
          color: #000;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 14px;
          color: #000;
        }
        
        .data-table th {
          background: #333;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        
        .data-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #ddd;
          color: #000;
        }
        
        .data-table tr:hover {
          background: #f8f9fa;
          color: #000;
        }
        
        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
          color: #000;
        }
        
        .tag {
          display: inline-block;
          padding: 4px 12px;
          background: #f0f0f0;
          color: #000;
          border: 1px solid #ccc;
          border-radius: 12px;
          font-size: 12px;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 12px;
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .warning-item {
          padding: 15px;
          margin-bottom: 15px;
          background: #fff3cd;
          border-left: 4px solid ${COLORS.warning};
          border-radius: 4px;
          color: #000;
        }
        
        .warning-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          color: #000;
        }
        
        .warning-message {
          color: #000;
        }
        
        .chart-container {
          margin: 20px 0;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 5px;
          color: #000;
        }
        
        h3 {
          color: #000;
        }
        
        strong {
          color: #000;
        }
        
        em {
          color: #000;
        }
        
        code {
          color: #000;
        }
        
        li {
          color: #000;
        }
        
        ul {
          color: #000;
        }
      `}</style>

      <div className="model-card-header">
        <h1>Model Card: {data.model_identification.name}</h1>
        <div style={{ opacity: 0.9 }}>
          {data.model_identification.model_type} • {data.model_identification.status} •{' '}
          {data.model_identification.training_date}
        </div>
      </div>

      <div className="model-card-controls">
        <button onClick={expandAll}>Expand All</button>
        <button onClick={collapseAll}>Collapse All</button>
      </div>

      {renderSection(
        'model-identification',
        'Model Identification',
        <div>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Target Column</div>
              <div className="metric-value" style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {data.model_identification.target_column || 'N/A'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Model Type</div>
              <div className="metric-value" style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {getModelTypeDisplay(
                  data.model_identification.model_type,
                  data.model_identification.target_column_type
                )}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="metric-value">
                <span
                  className="badge"
                  style={{ backgroundColor: getStatusColor(data.model_identification.status) }}
                >
                  {data.model_identification.status}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Training Date</div>
              <div className="metric-value" style={{ fontSize: '18px' }}>
                {data.model_identification.training_date}
              </div>
            </div>
          </div>
          <table className="info-table">
            <tbody>
              <tr>
                <th style={{ width: '250px' }}>Session ID</th>
                <td>
                  <code>{data.model_identification.session_id.substring(0, 20)}</code>
                </td>
              </tr>
              <tr>
                <th>Compute Cluster</th>
                <td>{data.model_identification.compute_cluster}</td>
              </tr>
              <tr>
                <th>Job ID</th>
                <td>
                  <code>{data.model_identification.job_id}</code>
                </td>
              </tr>
              <tr>
                <th>Target Type</th>
                <td>{(data.model_identification.target_column_type || 'N/A').toUpperCase()}</td>
              </tr>
              <tr>
                <th>Framework</th>
                <td>{data.model_identification.framework}</td>
              </tr>
            </tbody>
          </table>
        </div>,
        true
      )}

      {renderSection(
        'training-metrics',
        'Model Performance Metrics',
        <div>
          <div>
            <h3>Best Epoch</h3>
            <table className="info-table">
              <tbody>
                <tr>
                  <th>Epoch</th>
                  <td>{data.training_metrics.best_epoch.epoch}</td>
                </tr>
                <tr>
                  <th>Validation Loss</th>
                  <td>{formatValue(data.training_metrics.best_epoch.validation_loss)}</td>
                </tr>
                <tr>
                  <th>Train Loss</th>
                  <td>{formatValue(data.training_metrics.best_epoch.train_loss)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {data.training_metrics.classification_metrics && (
            <div>
              <h3>Classification Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label" title="How often we are correct when we raise an alert">Precision</div>
                  <div className="metric-value">
                    {formatValue(data.training_metrics.classification_metrics.precision, 3)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label" title="How many true rare events we catch">Recall</div>
                  <div className="metric-value">
                    {formatValue(data.training_metrics.classification_metrics.recall, 3)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">F1 Score</div>
                  <div className="metric-value">
                    {formatValue(data.training_metrics.classification_metrics.f1, 3)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">AUC</div>
                  <div className="metric-value">
                    {formatValue(data.training_metrics.classification_metrics.auc, 3)}
                  </div>
                </div>
              </div>
              {metricsChartData && metricsChartData.length > 0 && (
                <div className="chart-container">
                  <h3>Metrics Visualization</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metricsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 1]} />
                      <Tooltip formatter={(value: number) => formatPercentage(value)} />
                      <Bar dataKey="value" fill="#333" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {data.training_metrics.optimal_threshold && (
            <div>
              <h3>Optimal Threshold</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <th>Optimal Threshold</th>
                    <td>{formatValue(data.training_metrics.optimal_threshold.optimal_threshold)}</td>
                  </tr>
                  <tr>
                    <th>Positive Label</th>
                    <td>{data.training_metrics.optimal_threshold.pos_label || 'N/A'}</td>
                  </tr>
                  <tr>
                    <th>F1 at Optimal Threshold</th>
                    <td>
                      {formatPercentage(data.training_metrics.optimal_threshold.optimal_threshold_f1)}
                    </td>
                  </tr>
                  <tr>
                    <th>Accuracy at Optimal Threshold</th>
                    <td>
                      {formatPercentage(
                        data.training_metrics.optimal_threshold.accuracy_at_optimal_threshold
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>,
        true
      )}

      {renderSection(
        'model-quality',
        'Model Quality',
        <div>
          {data.model_quality.assessment && (
            <div>
              <h3>Assessment</h3>
              <span
                className="badge"
                style={{ backgroundColor: getQualityColor(data.model_quality.assessment) }}
              >
                {data.model_quality.assessment}
              </span>
            </div>
          )}

          {data.model_quality.recommendations && data.model_quality.recommendations.length > 0 && (
            <div>
              <h3>Recommendations</h3>
              <ul>
                {data.model_quality.recommendations.map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: '10px' }}>
                    <strong>Issue:</strong> {rec.issue}
                    <br />
                    <strong>Suggestion:</strong> {rec.suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.model_quality.warnings.length > 0 && (
            <div>
              <h3>Warnings</h3>
              {data.model_quality.warnings.map((warning, idx) => (
                <div key={idx} className="warning-item">
                  <div className="warning-header">
                    <span
                      className="badge"
                      style={{ backgroundColor: getSeverityColor(warning.severity) }}
                    >
                      {warning.severity}
                    </span>
                    <strong>{warning.type}</strong>
                  </div>
                  <div>{warning.message}</div>
                  {warning.recommendation && (
                    <div style={{ marginTop: '10px' }}>
                      <strong>Recommendation:</strong> {warning.recommendation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>,
        true
      )}

      {renderSection(
        'training-dataset',
        'Training Dataset',
        <div>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Training Rows</div>
              <div className="metric-value">{data.training_dataset.train_rows.toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Validation Rows</div>
              <div className="metric-value">{data.training_dataset.val_rows.toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Rows</div>
              <div className="metric-value">{data.training_dataset.total_rows.toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Features</div>
              <div className="metric-value">{data.training_dataset.total_features}</div>
            </div>
          </div>
          <div>
            <h3>Feature Names</h3>
            <div className="tag-list">
              {data.training_dataset.feature_names.map((name) => (
                <span key={name} className="tag">
                  {name}
                </span>
              ))}
            </div>
          </div>
          {featureTypeDistribution.length > 0 && (
            <div className="chart-container">
              <h3>Feature Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={featureTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {featureTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#333', '#666', '#999', COLORS.warning][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {renderSection(
        'feature-inventory',
        'Feature Inventory',
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Encoder</th>
                <th>Unique Values</th>
                <th>Sample Values</th>
                <th>Statistics</th>
              </tr>
            </thead>
            <tbody>
              {data.feature_inventory.map((feat) => (
                <tr key={feat.name}>
                  <td>
                    <strong>{feat.name}</strong>
                  </td>
                  <td>{feat.type}</td>
                  <td>{feat.encoder_type}</td>
                  <td>{feat.unique_values ?? 'N/A'}</td>
                  <td>
                    {feat.sample_values
                      ? feat.sample_values.slice(0, 3).join(', ') +
                        (feat.sample_values.length > 3 ? ` (+${feat.sample_values.length - 3} more)` : '')
                      : 'N/A'}
                  </td>
                  <td>
                    {feat.statistics ? (
                      <div>
                        Min: {formatValue(feat.statistics.min)}, Max: {formatValue(feat.statistics.max)}
                        <br />
                        Mean: {formatValue(feat.statistics.mean)}, Std: {formatValue(feat.statistics.std)}
                        <br />
                        Median: {formatValue(feat.statistics.median)}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renderSection(
        'training-configuration',
        'Training Configuration',
        <div>
          <table className="info-table">
            <tbody>
              <tr>
                <th>Total Epochs</th>
                <td>{data.training_configuration.epochs_total}</td>
              </tr>
              <tr>
                <th>Best Epoch</th>
                <td>{data.training_configuration.best_epoch}</td>
              </tr>
              <tr>
                <th>d_model</th>
                <td>{data.training_configuration.d_model}</td>
              </tr>
              <tr>
                <th>Batch Size</th>
                <td>{data.training_configuration.batch_size ?? 'N/A'}</td>
              </tr>
              <tr>
                <th>Learning Rate</th>
                <td>{formatValue(data.training_configuration.learning_rate)}</td>
              </tr>
              <tr>
                <th>Optimizer</th>
                <td>{data.training_configuration.optimizer}</td>
              </tr>
              {data.training_configuration.dropout_schedule && (
                <>
                  <tr>
                    <th>Dropout Enabled</th>
                    <td>{String(data.training_configuration.dropout_schedule.enabled)}</td>
                  </tr>
                  <tr>
                    <th>Dropout Initial</th>
                    <td>{formatValue(data.training_configuration.dropout_schedule.initial)}</td>
                  </tr>
                  <tr>
                    <th>Dropout Final</th>
                    <td>{formatValue(data.training_configuration.dropout_schedule.final)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {renderSection(
        'model-architecture',
        'Model Architecture',
        <div>
          <table className="info-table">
            <tbody>
              {data.model_architecture.predictor_layers !== null && (
                <tr>
                  <th>Predictor Layers</th>
                  <td>{data.model_architecture.predictor_layers}</td>
                </tr>
              )}
              {data.model_architecture.predictor_parameters !== null && (
                <tr>
                  <th>Predictor Parameters</th>
                  <td>{data.model_architecture.predictor_parameters.toLocaleString()}</td>
                </tr>
              )}
              {data.model_architecture.embedding_space_d_model !== null && (
                <tr>
                  <th>Embedding Space d_model</th>
                  <td>{data.model_architecture.embedding_space_d_model}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {renderSection(
        'technical-details',
        'Technical Details',
        <div>
          <table className="info-table">
            <tbody>
              <tr>
                <th>PyTorch Version</th>
                <td>{data.technical_details.pytorch_version}</td>
              </tr>
              <tr>
                <th>Device</th>
                <td>{data.technical_details.device}</td>
              </tr>
              <tr>
                <th>Precision</th>
                <td>{data.technical_details.precision}</td>
              </tr>
              <tr>
                <th>Loss Function</th>
                <td>{data.technical_details.loss_function}</td>
              </tr>
              {data.technical_details.normalization && (
                <tr>
                  <th>Normalization</th>
                  <td>{data.technical_details.normalization}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {renderSection(
        'provenance',
        'Provenance',
        <div>
          <table className="info-table">
            <tbody>
              <tr>
                <th>Created At</th>
                <td>{data.provenance.created_at}</td>
              </tr>
              {data.provenance.training_duration_minutes !== null && (
                <tr>
                  <th>Training Duration</th>
                  <td>
                    {Math.floor(data.provenance.training_duration_minutes / 60)}h{' '}
                    {Math.floor(data.provenance.training_duration_minutes % 60)}m (
                    {data.provenance.training_duration_minutes.toFixed(2)} minutes)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data.column_statistics &&
        Object.keys(data.column_statistics).length > 0 &&
        renderSection(
          'column-statistics',
          'Column Statistics',
          <div>
            <div className="chart-container">
              <h3>Mutual Information by Column</h3>
              {columnStatisticsData && (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={columnStatisticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mutualInfo" fill="#333" name="Mutual Information (bits)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Mutual Information (bits)</th>
                  <th>Marginal Loss</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.column_statistics).map(([name, stats]) => (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td>{formatValue(stats.mutual_information_bits)}</td>
                    <td>{formatValue(stats.marginal_loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default ModelCard;

