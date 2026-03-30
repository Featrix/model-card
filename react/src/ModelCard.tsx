import React, { useState } from 'react';

// Type definitions for the model card JSON structure
export interface ClassificationMetric {
  value: number;
  quality: string;
  trend: string;
  delta_1: number | null;
  delta_5: number | null;
  delta_10: number | null;
}

export interface ConfusionMatrix {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  threshold: number;
  precision: number;
  recall: number;
  specificity: number;
}

export interface PerRowTracking {
  this_epoch?: {
    correct: number;
    wrong: number;
    accuracy_pct: number;
  };
  cumulative_categories?: {
    never_wrong: number;
    rarely_wrong: number;
    sometimes_wrong: number;
    frequently_wrong: number;
    always_wrong: number;
  };
}

export interface ClassificationDisplayMetadata {
  epoch: number;
  classification_metrics?: {
    accuracy?: ClassificationMetric;
    auc?: ClassificationMetric;
    pr_auc?: ClassificationMetric;
    f1?: ClassificationMetric;
    precision?: ClassificationMetric;
    recall?: ClassificationMetric;
    specificity?: ClassificationMetric;
  };
  confusion_matrix?: ConfusionMatrix;
  per_row_tracking?: PerRowTracking;
}

export interface BestEpochData {
  epoch: number;
  roc_auc?: number;
  pr_auc?: number;
  classification_display_metadata?: ClassificationDisplayMetadata;
}

export interface TrainingOptimization {
  loss_function?: string;
  optimization_priority?: string;
  checkpoint_metric?: string;
  optimization_description?: string;
  focal_gamma?: number;
  focal_alpha?: number;
  class_weights?: number[];
  cost_sensitive?: {
    cost_false_positive: number;
    cost_false_negative: number;
  };
  adaptive_loss?: boolean;
  gamma_adjustments?: number;
  checkpoint_value?: number;
  checkpoint_epoch?: number;
  positive_class?: string;
}

export interface ModelCardData {
  model_identification: {
    session_id: string;
    job_id?: string;
    name: string;
    target_column: string | null;
    target_column_type: string | null;
    compute_cluster: string;
    training_date: string;
    status: string;
    model_type: string;
    framework: string;
  };
  embedding_space?: {
    num_columns: number;
    num_layers: number;
    num_parameters: number;
    d_model: number;
    num_rows: number;
  };
  class_imbalance?: {
    total_samples: number;
    minority_class: string;
    majority_class: string;
    minority_class_count: number;
    majority_class_count: number;
    imbalance_ratio: number;
    train_distribution?: { [key: string]: number };
    val_distribution?: { [key: string]: number };
  };
  best_epochs?: {
    best_roc_auc?: BestEpochData;
    best_pr_auc?: BestEpochData;
  };
  training_optimization?: TrainingOptimization;
  model_architecture?: {
    predictor_layers: number | null;
    predictor_parameters: number | null;
  };
  model_stack?: Array<{
    rows?: number;
    layers?: number;
    parameters?: number;
  }>;
  single_predictor?: {
    num_rows?: number;
    num_layers?: number;
    num_parameters?: number;
  };
  disk_usage?: {
    best_model_path?: string;
  };
  data_processing_notes?: DataProcessingNote[];
}

export interface DataProcessingNote {
  category: string;
  message: string;
  severity: string;
  columns?: string[];
  rows_affected?: number;
  details?: Record<string, unknown>;
}

interface ModelCardProps {
  data: ModelCardData;
  className?: string;
}

const COLORS = {
  primary: '#333',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#007bff',
};

const getStatusColor = (status: string): string => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'done' || statusLower === 'ready') return COLORS.success;
  if (statusLower === 'training') return COLORS.warning;
  if (statusLower === 'failed') return COLORS.danger;
  return '#6c757d';
};

const getStatusDisplay = (status: string): string => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'done') return 'READY';
  return (status || 'N/A').toUpperCase();
};

const getQualityColor = (quality: string | null): string => {
  if (!quality) return '#6c757d';
  const q = quality.toLowerCase();
  if (q === 'excellent') return COLORS.success;
  if (q === 'good') return COLORS.info;
  if (q === 'fair') return '#fff';
  if (q === 'poor') return '#fd7e14';
  return '#6c757d';
};

const getQualityStyle = (quality: string | null): React.CSSProperties => {
  if (!quality) return { backgroundColor: '#6c757d', color: 'white' };
  if (quality.toLowerCase() === 'fair') {
    return { backgroundColor: '#fff', color: '#000', border: '1px solid #000' };
  }
  return { backgroundColor: getQualityColor(quality), color: 'white' };
};

const formatLargeNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

const getModelTypeDisplay = (modelType: string, targetType: string | null): string => {
  if (!modelType) return 'N/A';
  const modelTypeLower = modelType.toLowerCase();
  const targetTypeLower = (targetType || '').toLowerCase();

  if (modelTypeLower === 'embedding space' || modelTypeLower === 'es') {
    return 'Foundational Embedding Space';
  } else if (modelTypeLower === 'single predictor' || modelTypeLower === 'sp') {
    if (targetTypeLower === 'set') return 'Binary Classifier';
    if (targetTypeLower === 'scalar') return 'Regression';
    return 'Single Predictor';
  }
  return modelType;
};

const parseModelPath = (path?: string): { sessionId: string | null } => {
  if (!path) return { sessionId: null };
  const parts = path.split('/');
  for (const part of parts) {
    if (part.startsWith('predictor-') && part.length > 37) {
      return { sessionId: part.substring(0, part.length - 37) };
    }
  }
  return { sessionId: null };
};

export const ModelCard: React.FC<ModelCardProps> = ({ data, className = '' }) => {
  const [activeTab, setActiveTab] = useState<'roc-auc' | 'pr-auc'>('roc-auc');
  const [showPerRowTracking, setShowPerRowTracking] = useState<{ [key: string]: boolean }>({});

  const expandAll = () => {
    document.querySelectorAll('details').forEach(d => d.open = true);
  };

  const collapseAll = () => {
    document.querySelectorAll('details').forEach(d => d.open = false);
  };

  // Calculate derived values
  const mi = data.model_identification;
  const es = data.embedding_space;
  const ci = data.class_imbalance;
  const be = data.best_epochs;
  const to = data.training_optimization;
  const dpn = data.data_processing_notes;
  const ma = data.model_architecture || {};
  const ms = data.model_stack?.[0] || {};
  const sp = data.single_predictor || {};

  const parsed = parseModelPath(data.disk_usage?.best_model_path);
  const modelIdDisplay = parsed.sessionId || mi.session_id?.substring(0, 20) || 'N/A';

  // Best metrics
  let bestRocAuc: number | null = null;
  let bestPrAuc: number | null = null;
  if (be?.best_roc_auc?.classification_display_metadata?.classification_metrics?.auc) {
    bestRocAuc = be.best_roc_auc.classification_display_metadata.classification_metrics.auc.value;
  }
  if (be?.best_pr_auc?.classification_display_metadata?.classification_metrics?.pr_auc) {
    bestPrAuc = be.best_pr_auc.classification_display_metadata.classification_metrics.pr_auc.value;
  }

  // PR-AUC lift
  let prAucLift: number | null = null;
  if (bestPrAuc && ci?.minority_class_count && ci?.total_samples) {
    const prevalence = ci.minority_class_count / ci.total_samples;
    prAucLift = bestPrAuc / prevalence;
  }

  // Model stack values
  const spRows = ci?.total_samples || ms.rows || sp.num_rows || 0;
  const spLayers = ms.layers || ma.predictor_layers || sp.num_layers || 0;
  const spParams = ms.parameters || ma.predictor_parameters || sp.num_parameters || 0;

  const renderMetricsTable = (metrics: ClassificationDisplayMetadata['classification_metrics']) => {
    if (!metrics) return null;
    const metricOrder: (keyof typeof metrics)[] = ['accuracy', 'auc', 'pr_auc', 'f1', 'precision', 'recall', 'specificity'];

    return (
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Quality</th>
            <th>Trend</th>
            <th>Δ1</th>
            <th>Δ5</th>
          </tr>
        </thead>
        <tbody>
          {metricOrder.map(key => {
            const m = metrics[key];
            if (!m) return null;
            return (
              <tr key={key}>
                <td style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{key.replace('_', ' ')}</td>
                <td>{typeof m.value === 'number' ? `${(m.value * 100).toFixed(2)}%` : 'N/A'}</td>
                <td><span className="quality-badge" style={getQualityStyle(m.quality)}>{m.quality || 'N/A'}</span></td>
                <td style={{ fontSize: '18px' }}>{m.trend || ''}</td>
                <td>{m.delta_1 !== null ? `${m.delta_1 > 0 ? '+' : ''}${(m.delta_1 * 100).toFixed(2)}%` : '-'}</td>
                <td>{m.delta_5 !== null ? `${m.delta_5 > 0 ? '+' : ''}${(m.delta_5 * 100).toFixed(2)}%` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderConfusionMatrix = (cm: ConfusionMatrix | undefined) => {
    if (!cm) return null;
    const { tn, fp, fn, tp } = cm;
    const totalPos = tp + fn;
    const totalNeg = tn + fp;
    const hitRate = totalPos > 0 ? tp / totalPos : 0;
    const missRate = totalPos > 0 ? fn / totalPos : 0;
    const specificity = totalNeg > 0 ? tn / totalNeg : 0;
    const falseAlarmRate = totalNeg > 0 ? fp / totalNeg : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;

    return (
      <div className="confusion-wrapper">
        <h4 className="confusion-title">Confusion Matrix</h4>
        <div className="confusion-layout">
          <table className="confusion-matrix">
            <tbody>
              <tr><th></th><th></th><th colSpan={2} className="cm-header">Predicted</th></tr>
              <tr><th></th><th></th><th className="cm-label">Pos</th><th className="cm-label">Neg</th></tr>
              <tr>
                <th rowSpan={2} className="cm-header" style={{ verticalAlign: 'middle' }}>Actual</th>
                <th className="cm-label">Pos</th>
                <td className="cm-cell cm-correct">{tp}</td>
                <td className="cm-cell cm-error">{fn}</td>
              </tr>
              <tr>
                <th className="cm-label">Neg</th>
                <td className="cm-cell cm-error">{fp}</td>
                <td className="cm-cell cm-correct">{tn}</td>
              </tr>
            </tbody>
          </table>
          <table className="derived-metrics">
            <tbody>
              <tr><td><strong>Hit Rate</strong> (Recall)</td><td className="dm-value">{(hitRate * 100).toFixed(1)}%</td><td className="dm-formula">TP / (TP+FN)</td></tr>
              <tr><td><strong>Miss Rate</strong></td><td className="dm-value">{(missRate * 100).toFixed(1)}%</td><td className="dm-formula">FN / (TP+FN)</td></tr>
              <tr><td><strong>Specificity</strong> (TNR)</td><td className="dm-value">{(specificity * 100).toFixed(1)}%</td><td className="dm-formula">TN / (TN+FP)</td></tr>
              <tr><td><strong>False Alarm</strong> (FPR)</td><td className="dm-value">{(falseAlarmRate * 100).toFixed(1)}%</td><td className="dm-formula">FP / (TN+FP)</td></tr>
              <tr><td><strong>Precision</strong> (PPV)</td><td className="dm-value">{(precision * 100).toFixed(1)}%</td><td className="dm-formula">TP / (TP+FP)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPerRowTracking = (prt: PerRowTracking | undefined, tabKey: string) => {
    if (!prt || (!prt.this_epoch && !prt.cumulative_categories)) return null;
    const isOpen = showPerRowTracking[tabKey];

    return (
      <details className="show-more" open={isOpen} onToggle={(e) => setShowPerRowTracking(prev => ({ ...prev, [tabKey]: (e.target as HTMLDetailsElement).open }))}>
        <summary>Show per-row tracking</summary>
        {prt.this_epoch && (
          <>
            <h4 style={{ margin: '15px 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>This Epoch</h4>
            <table style={{ width: 'auto' }}>
              <thead><tr><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{ fontSize: '18px', fontWeight: 'bold', color: '#388e3c' }}>{prt.this_epoch.correct}</td>
                  <td style={{ fontSize: '18px', fontWeight: 'bold', color: '#d32f2f' }}>{prt.this_epoch.wrong}</td>
                  <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{prt.this_epoch.accuracy_pct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        {prt.cumulative_categories && (
          <>
            <h4 style={{ margin: '15px 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Cumulative</h4>
            <table style={{ width: 'auto' }}>
              <thead><tr><th>Never Wrong</th><th>Rarely</th><th>Sometimes</th><th>Frequently</th><th>Always Wrong</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', color: '#388e3c' }}>{prt.cumulative_categories.never_wrong}</td>
                  <td style={{ fontWeight: 'bold', color: '#689f38' }}>{prt.cumulative_categories.rarely_wrong}</td>
                  <td style={{ fontWeight: 'bold', color: '#ffa000' }}>{prt.cumulative_categories.sometimes_wrong}</td>
                  <td style={{ fontWeight: 'bold', color: '#f57c00' }}>{prt.cumulative_categories.frequently_wrong}</td>
                  <td style={{ fontWeight: 'bold', color: '#d32f2f' }}>{prt.cumulative_categories.always_wrong}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </details>
    );
  };

  const renderEpochSection = (title: string, epochData: BestEpochData | undefined, tabKey: string) => {
    if (!epochData) return null;
    const cdm = epochData.classification_display_metadata;

    return (
      <div className="epoch-section">
        <h3 className="epoch-title">{title} — Epoch {epochData.epoch || cdm?.epoch || 'N/A'}</h3>
        {renderMetricsTable(cdm?.classification_metrics)}
        {renderConfusionMatrix(cdm?.confusion_matrix)}
        {renderPerRowTracking(cdm?.per_row_tracking, tabKey)}
      </div>
    );
  };

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return (
    <div className={`featrix-model-card ${className}`}>
      <style>{`
        .featrix-model-card * { margin: 0; padding: 0; box-sizing: border-box; color: #000; }
        .featrix-model-card { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #000; line-height: 1.5; }
        .featrix-model-card .page { max-width: 1400px; margin: 0 auto; padding: 20px 40px; }

        .featrix-model-card .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        .featrix-model-card .header h1 { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
        .featrix-model-card .header .meta { font-size: 12px; color: #666; }

        .featrix-model-card details { margin: 20px 0; border: 1px solid #ccc; background: white; }
        .featrix-model-card details summary { padding: 12px 20px; cursor: pointer; font-weight: bold; background: #f5f5f5; border-bottom: 1px solid #ccc; user-select: none; text-transform: uppercase; font-size: 13px; color: #333; }
        .featrix-model-card details summary:hover { background: #eee; }
        .featrix-model-card details[open] summary { border-bottom: 1px solid #ccc; }
        .featrix-model-card .section-content { padding: 20px; }

        .featrix-model-card .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .featrix-model-card .metric { padding: 15px; background: #fff; border: 1px solid #ddd; }
        .featrix-model-card .metric-label { font-size: 11px; text-transform: uppercase; margin-bottom: 6px; color: #666; }
        .featrix-model-card .metric-value { font-size: 24px; font-weight: bold; }

        .featrix-model-card table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .featrix-model-card th { color: #666; padding: 10px 12px; text-align: left; font-weight: normal; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #ddd; }
        .featrix-model-card td { padding: 10px 12px; border-bottom: 1px solid #eee; }
        .featrix-model-card tr:last-child td { border-bottom: none; }

        .featrix-model-card .epoch-tabs { display: flex; gap: 0; margin-bottom: 0; border-bottom: 1px solid #ddd; }
        .featrix-model-card .epoch-tab { padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-bottom: none; cursor: pointer; font-size: 13px; font-weight: bold; font-family: inherit; margin-right: -1px; color: #666; }
        .featrix-model-card .epoch-tab:hover { background: #eee; }
        .featrix-model-card .epoch-tab.active { background: #fafafa; color: #333; border-bottom: 1px solid #fafafa; position: relative; top: 1px; }
        .featrix-model-card .epoch-tab-content { display: none; }
        .featrix-model-card .epoch-tab-content.active { display: block; }
        .featrix-model-card .epoch-section { padding: 20px; background: #fafafa; border: 1px solid #ddd; border-top: none; }
        .featrix-model-card .epoch-title { margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #333; }

        .featrix-model-card .confusion-wrapper { margin-top: 20px; }
        .featrix-model-card .confusion-title { margin: 0 0 15px 0; font-size: 13px; font-weight: bold; color: #333; }
        .featrix-model-card .confusion-layout { display: flex; gap: 30px; align-items: flex-start; }
        .featrix-model-card .confusion-matrix { width: auto; text-align: center; }
        .featrix-model-card .confusion-matrix th, .featrix-model-card .confusion-matrix td { border: none; }
        .featrix-model-card .cm-header { padding: 5px; font-size: 11px; color: #666; font-weight: normal; }
        .featrix-model-card .cm-label { padding: 5px; width: 50px; font-size: 11px; color: #666; font-weight: normal; }
        .featrix-model-card .cm-cell { padding: 12px 15px; border: 1px solid #ccc; font-size: 18px; font-weight: bold; }
        .featrix-model-card .cm-correct { background: #e8f5e9; }
        .featrix-model-card .cm-error { background: #ffebee; }
        .featrix-model-card .derived-metrics { width: auto; font-size: 13px; }
        .featrix-model-card .derived-metrics td { padding: 6px 12px; border: none; }
        .featrix-model-card .dm-value { text-align: right; }
        .featrix-model-card .dm-formula { color: #666; }

        .featrix-model-card .show-more { margin-top: 15px; border: none; background: none; }
        .featrix-model-card .show-more summary { padding: 5px 0; cursor: pointer; font-size: 12px; color: #1976d2; background: none; border: none; font-weight: normal; text-transform: none; }
        .featrix-model-card .show-more summary:hover { color: #1565c0; text-decoration: underline; }

        .featrix-model-card .controls { margin-bottom: 15px; display: flex; gap: 8px; flex-wrap: wrap; }
        .featrix-model-card .btn { padding: 6px 12px; background: #fff; color: #000; border: 1px solid #999; cursor: pointer; font-size: 12px; font-family: inherit; }
        .featrix-model-card .btn:hover { background: #f0f0f0; }

        .featrix-model-card .status-badge, .featrix-model-card .quality-badge { display: inline-block; padding: 4px 12px; color: white; font-size: 12px; font-weight: 600; }

        .featrix-model-card code { background: #fff; padding: 2px 6px; border: 1px solid #000; font-family: 'Courier New', monospace; font-size: 13px; }

        @media print {
          .featrix-model-card .page { padding: 0; max-width: 100%; }
          .featrix-model-card .controls { display: none; }
          .featrix-model-card .grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="page">
        <div className="header">
          <h1>MODEL CARD: {mi.name?.toUpperCase() || 'UNNAMED'}</h1>
          <div className="meta"><strong>Generated:</strong> {dateStr} UTC</div>
        </div>

        <div className="controls">
          <button className="btn" onClick={expandAll}>Expand All</button>
          <button className="btn" onClick={collapseAll}>Collapse All</button>
        </div>

        {/* MODEL IDENTIFICATION */}
        <details className="section" open>
          <summary>MODEL IDENTIFICATION</summary>
          <div className="section-content">
            <div className="grid">
              <div className="metric">
                <div className="metric-label">Target Column</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>{mi.target_column || 'N/A'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Model Type</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>{getModelTypeDisplay(mi.model_type, mi.target_column_type)}</div>
              </div>
              <div className="metric" style={{ background: '#e3f2fd', borderColor: '#90caf9' }}>
                <div className="metric-label" style={{ color: '#1976d2' }}>Best ROC-AUC</div>
                <div className="metric-value" style={{ fontSize: '28px', color: '#1565c0' }}>
                  {bestRocAuc !== null ? `${(bestRocAuc * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div className="metric" style={{ background: '#e8f5e9', borderColor: '#a5d6a7' }}>
                <div className="metric-label" style={{ color: '#388e3c' }}>Best PR-AUC</div>
                <div className="metric-value" style={{ fontSize: '28px', color: '#2e7d32' }}>
                  {bestPrAuc !== null ? `${(bestPrAuc * 100).toFixed(1)}%` : 'N/A'}
                  {prAucLift !== null && <span style={{ fontSize: '14px', fontWeight: 'normal' }}> [{prAucLift.toFixed(1)}x]</span>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #ddd', fontSize: '12px', color: '#666', lineHeight: 2 }}>
              <span className="status-badge" style={{ backgroundColor: getStatusColor(mi.status), fontSize: '11px', padding: '2px 8px' }}>
                {getStatusDisplay(mi.status)}
              </span>
              &nbsp;&nbsp;{mi.training_date || 'N/A'}
              &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Model:</strong> <code style={{ fontSize: '11px' }}>{modelIdDisplay}</code>
              &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Cluster:</strong> {(mi.compute_cluster || 'N/A').toUpperCase()}
              &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Dims:</strong> {es?.d_model || 'N/A'}
            </div>
          </div>
        </details>

        {/* MODEL STACK */}
        {es && (
          <details className="section" open>
            <summary>MODEL STACK</summary>
            <div className="section-content">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}></th>
                    <th>Labeled?</th>
                    <th>Rows</th>
                    <th>Layers</th>
                    <th>Parameters</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Predictor</td>
                    <td style={{ color: '#388e3c', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Yes</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{spRows.toLocaleString()}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{spLayers ? formatLargeNumber(spLayers) : 'N/A'}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{spParams ? formatLargeNumber(spParams) : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Foundation</td>
                    <td style={{ color: '#666', whiteSpace: 'nowrap' }}>No</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{(es.num_rows || 0).toLocaleString()}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatLargeNumber(es.num_layers)}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatLargeNumber(es.num_parameters)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* MODEL DETAILS - Best Epochs with Tabs */}
        {be && (
          <details className="section" open>
            <summary>MODEL DETAILS</summary>
            <div className="section-content">
              <div className="epoch-tabs">
                <button
                  className={`epoch-tab ${activeTab === 'pr-auc' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pr-auc')}
                >
                  Best PR-AUC
                </button>
                <button
                  className={`epoch-tab ${activeTab === 'roc-auc' ? 'active' : ''}`}
                  onClick={() => setActiveTab('roc-auc')}
                >
                  Best ROC-AUC
                </button>
              </div>
              <div className={`epoch-tab-content ${activeTab === 'pr-auc' ? 'active' : ''}`}>
                {renderEpochSection('Best PR-AUC', be.best_pr_auc, 'pr-auc')}
              </div>
              <div className={`epoch-tab-content ${activeTab === 'roc-auc' ? 'active' : ''}`}>
                {renderEpochSection('Best ROC-AUC', be.best_roc_auc, 'roc-auc')}
              </div>
            </div>
          </details>
        )}

        {/* TRAINING OPTIMIZATION */}
        {to && (
          <details className="section" open>
            <summary>TRAINING OPTIMIZATION</summary>
            <div className="section-content">
              {to.optimization_description && (
                <div style={{ marginBottom: '20px', padding: '12px 15px', background: '#e3f2fd', borderLeft: '3px solid #1976d2', fontSize: '14px' }}>
                  <strong>Strategy:</strong> {to.optimization_description}
                </div>
              )}
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="metric">
                  <div className="metric-label">Loss Function</div>
                  <div className="metric-value" style={{ fontSize: '18px' }}>{to.loss_function || 'N/A'}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Optimization Priority</div>
                  <div className="metric-value" style={{ fontSize: '18px', textTransform: 'capitalize' }}>{to.optimization_priority || 'N/A'}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Checkpoint Metric</div>
                  <div className="metric-value" style={{ fontSize: '18px' }}>
                    {(!to.checkpoint_metric || to.checkpoint_metric.toLowerCase() === 'none') ? 'Default' : to.checkpoint_metric.toUpperCase().replace('_', '-')}
                  </div>
                </div>
              </div>
              <table style={{ marginTop: '20px' }}>
                <tbody>
                  {(to.focal_gamma !== undefined || to.focal_alpha !== undefined) && (
                    <tr>
                      <td style={{ width: '200px' }}><strong>Focal Loss Parameters</strong></td>
                      <td>γ={to.focal_gamma ?? 'N/A'}, α={to.focal_alpha ?? 'N/A'}</td>
                    </tr>
                  )}
                  {to.class_weights && to.class_weights.length > 0 && (
                    <tr>
                      <td><strong>Class Weights</strong></td>
                      <td>[{to.class_weights.join(', ')}]</td>
                    </tr>
                  )}
                  {to.cost_sensitive && (
                    <tr>
                      <td><strong>Cost-Sensitive</strong></td>
                      <td>FP cost: {to.cost_sensitive.cost_false_positive ?? 1.0}, FN cost: {to.cost_sensitive.cost_false_negative ?? 1.0}</td>
                    </tr>
                  )}
                  {to.adaptive_loss !== undefined && (
                    <tr>
                      <td><strong>Adaptive Loss</strong></td>
                      <td>{to.adaptive_loss ? 'Yes' : 'No'}{to.gamma_adjustments ? ` (${to.gamma_adjustments} adjustments)` : ''}</td>
                    </tr>
                  )}
                  {to.checkpoint_value !== undefined && (
                    <tr>
                      <td><strong>Best Checkpoint</strong></td>
                      <td>{(to.checkpoint_value * 100).toFixed(2)}% at epoch {to.checkpoint_epoch ?? 'N/A'}</td>
                    </tr>
                  )}
                  {to.positive_class !== undefined && (
                    <tr>
                      <td><strong>Positive Class</strong></td>
                      <td>"{to.positive_class}"</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* TRAINING DATASET */}
        {ci && (
          <details className="section" open>
            <summary>TRAINING DATASET</summary>
            <div className="section-content">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}></th>
                    <th style={{ textAlign: 'right' }}>Class "{ci.minority_class || '1'}"</th>
                    <th style={{ textAlign: 'right' }}>Class "{ci.majority_class || '0'}"</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ci.train_distribution && (
                    <tr>
                      <td><strong>Train</strong></td>
                      <td style={{ textAlign: 'right' }}>{(ci.train_distribution['1'] || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{(ci.train_distribution['0'] || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{((ci.train_distribution['0'] || 0) + (ci.train_distribution['1'] || 0)).toLocaleString()}</td>
                    </tr>
                  )}
                  {ci.val_distribution && (
                    <tr>
                      <td><strong>Validation</strong></td>
                      <td style={{ textAlign: 'right' }}>{(ci.val_distribution['1'] || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{(ci.val_distribution['0'] || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{((ci.val_distribution['0'] || 0) + (ci.val_distribution['1'] || 0)).toLocaleString()}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ borderTop: '2px solid #333' }}><strong>Total</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333' }}>{ci.minority_class_count.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333' }}>{ci.majority_class_count.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333' }}>{ci.total_samples.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '15px', color: '#666', fontSize: '13px' }}>
                Imbalance ratio: <strong>{ci.imbalance_ratio}:1</strong> (minority class is {((ci.minority_class_count / ci.total_samples) * 100).toFixed(1)}% of data)
              </div>
            </div>
          </details>
        )}

        {/* DATA PROCESSING NOTES */}
        {dpn && dpn.length > 0 && (
          <details className="section" open>
            <summary>DATA PROCESSING NOTES</summary>
            <div className="section-content">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: '110px' }}>Severity</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: '140px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Message</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: '180px' }}>Affected</th>
                  </tr>
                </thead>
                <tbody>
                  {dpn.map((note, i) => {
                    const sev = (note.severity || 'info').toLowerCase();
                    const severityColor: Record<string, string> = { info: '#1976d2', warning: '#f57c00', critical: '#c62828' };
                    const severityBg: Record<string, string> = { info: '#e3f2fd', warning: '#fff3e0', critical: '#ffebee' };
                    const categoryLabel: Record<string, string> = {
                      column_dropped: 'Column Dropped', rows_filtered: 'Rows Filtered',
                      type_detection: 'Type Detection', data_transform: 'Data Transform',
                      csv_parsing: 'CSV Parsing', dataset_sampling: 'Dataset Sampling',
                    };
                    const affected: string[] = [];
                    if (note.columns && note.columns.length > 0) {
                      affected.push(note.columns.join(', '));
                    }
                    if (note.rows_affected != null) {
                      affected.push(`${note.rows_affected.toLocaleString()} rows`);
                    }
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #eee', background: severityBg[sev] || '#f5f5f5' }}>
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          <span style={{
                            background: severityColor[sev] || '#555', color: '#fff',
                            fontSize: '10px', fontWeight: 'bold', padding: '2px 7px',
                            borderRadius: '3px', textTransform: 'uppercase',
                          }}>{sev}</span>
                        </td>
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', color: '#444', fontSize: '12px' }}>
                          {categoryLabel[note.category] || note.category || 'Note'}
                        </td>
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>{note.message}</td>
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', fontSize: '12px' }}>
                          {affected.length > 0 ? affected.map((a, j) => <div key={j}>{a}</div>) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ModelCard;
