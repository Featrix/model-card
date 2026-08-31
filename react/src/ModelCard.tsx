import React, { useState, useEffect, useRef } from 'react';

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

/** PROPOSED, not yet implemented: N×N confusion matrix for >2 classes. Rows = actual class,
 *  columns = predicted class, in class_labels order. See examples/ticket_priority_multiclass.json. */
export interface ConfusionMatrixNxN {
  class_labels: string[];
  matrix: number[][];
}

export interface PerClassMetric {
  label: string;
  display_name?: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface PerClassAuc {
  label: string;
  auc: number;
}

export interface SelectivePredictionEntry {
  intent_feasible?: boolean | null;
  intent_feasibility_reason?: string | null;
  coverage: number | null;
  covered_auc: number | null;
  full_auc: number | null;
  full_accuracy: number | null;
  auc_lift: number | null;
  confidence_threshold: number | null;
  n_covered: number;
  n_total: number;
  demur_error_capture: number | null;
  demur_random_baseline: number;
  n_demurred: number;
  n_demurred_true_positives: number;
  n_demurred_false_positives: number;
  n_demurred_true_negatives: number;
  n_demurred_false_negatives: number;
  intent?: string | null;
  source?: string | null;
  calibration_method?: string | null;
  covered_precision?: number | null;
  covered_recall?: number | null;
  epoch?: number;
  /** PROPOSED, not yet implemented: multiclass selective prediction fields. */
  label?: string;
  target_class?: string | null;
  covered_macro_f1?: number | null;
  full_macro_f1?: number | null;
  macro_f1_lift?: number | null;
  covered_recall_target_class?: number | null;
  full_recall_target_class?: number | null;
  confidence_threshold_basis?: string | null;
  declined_matrix?: ConfusionMatrixNxN;
}

export interface SelectivePrediction {
  summary?: SelectivePredictionEntry;
  strategies?: Record<string, SelectivePredictionEntry>;
  history?: SelectivePredictionEntry[];
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

export interface RegressionMetric {
  value: number;
  quality: string | null;
}

export interface RegressionSkillVerdict {
  tier: string;
  text: string;
}

export interface RegressionDisplayMetadata {
  epoch: number;
  regression_metrics?: {
    r2?: RegressionMetric;
    nrmse?: RegressionMetric;
    rmse?: RegressionMetric;
    mae?: RegressionMetric;
    spearman?: RegressionMetric;
    smape?: RegressionMetric;
    median_ae?: RegressionMetric;
    max_error?: RegressionMetric;
  };
  skill?: RegressionSkillVerdict | null;
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
    /** PROPOSED, not yet implemented: multiclass headline metrics. */
    macro_f1?: ClassificationMetric;
    weighted_f1?: ClassificationMetric;
    macro_auc_ovr?: ClassificationMetric;
    log_loss?: ClassificationMetric;
    per_class?: PerClassMetric[];
    averaging?: {
      macro?: { precision: number; recall: number; f1: number };
      weighted?: { precision: number; recall: number; f1: number };
      support?: number;
    };
    per_class_auc_ovr?: PerClassAuc[];
  };
  confusion_matrix?: ConfusionMatrix | ConfusionMatrixNxN;
  per_row_tracking?: PerRowTracking;
}

export interface BestEpochData {
  epoch: number;
  roc_auc?: number;
  pr_auc?: number;
  r2?: number;
  classification_display_metadata?: ClassificationDisplayMetadata;
  regression_display_metadata?: RegressionDisplayMetadata;
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

export interface UserIntent {
  task: string;
  objective: string;
  params?: Record<string, unknown>;
  source?: string;
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
    training_phase?: string;
    model_id?: string | number | null;
    user_intent?: UserIntent | null;
    encoding_intent?: string | null;
    /** PROPOSED, not yet implemented: distinguishes binary vs multiclass 'set' targets — see
     *  examples/ticket_priority_multiclass.json. */
    num_classes?: number | null;
    class_labels?: string[] | null;
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
    minority_class?: string;
    majority_class?: string;
    minority_class_count?: number;
    majority_class_count?: number;
    imbalance_ratio?: number;
    train_distribution?: { [key: string]: number };
    val_distribution?: { [key: string]: number };
    /** PROPOSED, not yet implemented: N-class distribution — array shape only. Some existing
     *  cards already send class_distribution as a legacy {label: count} dict; that shape is
     *  still handled, just not through this field. */
    class_distribution?: Array<{ label: string; display_name?: string; count?: number; pct?: number }>;
  };
  best_epochs?: {
    best_roc_auc?: BestEpochData;
    best_pr_auc?: BestEpochData;
    best_r2?: BestEpochData;
    /** PROPOSED, not yet implemented: multiclass models track whatever metrics were actually
     *  optimized (e.g. best_macro_f1, best_log_loss, best_accuracy) — not fixed to PR/ROC-AUC. */
    [key: string]: BestEpochData | undefined;
  };
  training_configuration?: {
    current_epoch?: number;
    planned_epochs?: number;
    best_epoch?: number;
    [key: string]: unknown;
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
  coverage?: SelectivePrediction;
  selective_prediction?: SelectivePrediction;
  model_fit?: ModelFit;
  training_dataset?: {
    train_rows?: number;
    val_rows?: number;
    total_rows?: number;
    total_features?: number;
    feature_names?: string[];
    validation_notes?: string[];
  };
}

export interface DataProcessingNote {
  category: string;
  message: string;
  severity: string;
  columns?: string[];
  rows_affected?: number;
  details?: Record<string, unknown>;
}

export interface ModelFitTopFit {
  id?: string;
  label: string;
  score: number;
  summary?: string;
  good_fit?: string[];
  poor_fit?: string[];
  target_framing?: string;
}

export interface ModelFitShapeScore {
  id?: string;
  label: string;
  score: number;
}

export interface ModelFitEntry {
  intent: string;
  metrics?: Record<string, number>;
  shape_scores?: ModelFitShapeScore[];
  top_fit?: ModelFitTopFit;
}

export interface ModelFitReferenceShape {
  id: string;
  label: string;
  summary?: string;
  good_fit?: string[];
  poor_fit?: string[];
  target_framing?: string;
  criteria?: Array<{
    metric: string;
    op: string;
    target: number;
    tol?: number;
    weight?: number;
  }>;
}

export interface ModelFit {
  primary?: {
    intent: string;
    top_fit?: ModelFitTopFit;
  };
  per_intent?: ModelFitEntry[];
  reference_table?: ModelFitReferenceShape[];
}

interface ModelCardProps {
  data: ModelCardData;
  className?: string;
  /** Called periodically during training so the parent can re-fetch and update `data`. */
  onRefetch?: () => void;
  /** Polling interval in ms (default 15000). Only active when status is TRAINING. */
  pollIntervalMs?: number;
}

const COLORS = {
  primary: 'var(--fmc-ink)',
  success: 'var(--fmc-good)',
  warning: 'var(--fmc-warn)',
  danger: 'var(--fmc-bad)',
  info: 'var(--fmc-brass)',
  neutral: 'var(--fmc-slate)',
};

const getStatusColor = (status: string): string => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'done' || statusLower === 'ready') return COLORS.success;
  if (statusLower === 'training') return COLORS.warning;
  if (statusLower === 'failed') return COLORS.danger;
  return COLORS.neutral;
};

const getStatusDisplay = (status: string): string => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'done') return 'READY';
  return (status || 'N/A').toUpperCase();
};

const getQualityColor = (quality: string | null): string => {
  if (!quality) return COLORS.neutral;
  const q = quality.toLowerCase();
  if (q === 'excellent') return COLORS.success;
  if (q === 'good') return COLORS.info;
  if (q === 'fair') return COLORS.warning;
  if (q === 'poor' || q === 'bad') return COLORS.danger;
  return COLORS.neutral;
};

const getQualityStyle = (quality: string | null): React.CSSProperties => {
  return { backgroundColor: getQualityColor(quality), color: 'white' };
};

const formatLargeNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

const getModelTypeDisplay = (
  modelType: string,
  targetType: string | null,
  numClasses?: number | null,
  isMulticlassFallback?: boolean
): string => {
  if (!modelType) return 'N/A';
  const modelTypeLower = modelType.toLowerCase();
  const targetTypeLower = (targetType || '').toLowerCase();

  if (modelTypeLower === 'embedding space' || modelTypeLower === 'es') {
    return 'Foundational Embedding Space';
  } else if (modelTypeLower === 'single predictor' || modelTypeLower === 'sp') {
    if (targetTypeLower === 'set') {
      // 'set' covers both binary and multiclass targets — num_classes/class_labels (once the
      // backend emits them) decide which; until then, fall back to whether the best_epochs
      // data itself looks multiclass (see isMulticlass in the caller).
      const isMulticlass = numClasses != null ? numClasses > 2 : !!isMulticlassFallback;
      return isMulticlass ? 'Multiclass Classifier' : 'Binary Classifier';
    }
    if (targetTypeLower === 'scalar') return 'Regression';
    return 'Single Predictor';
  }
  return modelType;
};

const humanizeObjective = (objective: string): string =>
  objective.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const EPOCH_METRIC_LABELS: Record<string, string> = {
  roc_auc: 'ROC-AUC', pr_auc: 'PR-AUC', macro_f1: 'Macro-F1', weighted_f1: 'Weighted-F1',
  macro_auc_ovr: 'Macro-AUC (OvR)', log_loss: 'Log-Loss', cross_entropy: 'Cross-Entropy',
  accuracy: 'Accuracy', f1: 'F1', r2: 'R²',
};

const REGRESSION_METRIC_ORDER = ['r2', 'nrmse', 'rmse', 'mae', 'spearman', 'smape', 'median_ae', 'max_error'] as const;
const REGRESSION_METRIC_LABELS: Record<string, string> = {
  r2: 'R²', nrmse: 'NRMSE (σ-normalized error)', rmse: 'RMSE', mae: 'MAE',
  spearman: 'Spearman ρ (rank correlation)', smape: 'sMAPE', median_ae: 'Median AE', max_error: 'Max Error',
};

const getSkillColor = (tier: string | undefined): string => {
  if (tier === 'beats_xgb') return COLORS.success;
  if (tier === 'ties_xgb' || tier === 'beats_lr') return COLORS.info;
  if (tier === 'no_skill' || tier === 'below_baselines') return COLORS.danger;
  return COLORS.neutral;
};
const formatMetricName = (key: string | null | undefined): string => {
  if (!key) return '';
  return EPOCH_METRIC_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
/** Best PR-AUC / Best ROC-AUC keep their historical left-to-right order for existing binary cards;
 *  any other best_epochs key (multiclass) sorts after them in whatever order it was declared. */
const EPOCH_ORDER_PREFERENCE = ['best_pr_auc', 'best_roc_auc'];
const sortEpochKeys = (keys: string[]): string[] =>
  [...keys].sort((a, b) => {
    const ia = EPOCH_ORDER_PREFERENCE.indexOf(a), ib = EPOCH_ORDER_PREFERENCE.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

const INTENT_DISPLAY: Record<string, string> = {
  balanced: 'Balanced (default)',
  only_alert_when_confident: 'Only alert when confident',
  catch_everything: 'Catch everything',
  minimize_cost: 'Minimize expected cost',
  rank: 'Ranking — no operating point',
  predict_probabilities: 'Calibrated probabilities — no operating point',
};

// Strategy tabs are generated from whatever keys are actually present under sp.strategies — not a
// fixed set — so per-class strategies (detect_class_P0, ...) show up automatically. Legacy key
// names get their historical labels and left-to-right order; anything else falls back to
// entry.label (if the backend supplied one) or a humanized version of the key.
const LEGACY_STRATEGY_LABELS: Record<string, string> = {
  everything: 'Always answer', best_always_answers: 'Always answer',
  only_when_sure: 'Balanced demur', best_balanced_may_demur: 'Balanced demur',
  only_on_strong_positives: 'Detect positives', best_detects_positives_may_demur: 'Detect positives',
  only_on_strong_negatives: 'Rule out negatives', best_rules_out_negatives_may_demur: 'Rule out negatives',
};
const LEGACY_STRATEGY_ORDER = [
  'everything', 'best_always_answers',
  'only_when_sure', 'best_balanced_may_demur',
  'only_on_strong_positives', 'best_detects_positives_may_demur',
  'only_on_strong_negatives', 'best_rules_out_negatives_may_demur',
];
const humanizeKey = (key: string): string => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const sortStrategyKeys = (keys: string[]): string[] =>
  [...keys].sort((a, b) => {
    const ia = LEGACY_STRATEGY_ORDER.indexOf(a), ib = LEGACY_STRATEGY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

const pickPrimaryMetric = (entry: SelectivePredictionEntry): { label: string; covered: number | null; full: number | null; lift: number | null } => {
  if (entry.target_class && entry.covered_recall_target_class != null) {
    return { label: `Recall (${entry.target_class})`, covered: entry.covered_recall_target_class, full: entry.full_recall_target_class ?? null, lift: null };
  }
  if (entry.covered_macro_f1 != null || entry.full_macro_f1 != null) {
    return { label: 'Macro-F1', covered: entry.covered_macro_f1 ?? null, full: entry.full_macro_f1 ?? null, lift: entry.macro_f1_lift ?? null };
  }
  return { label: 'AUC', covered: entry.covered_auc, full: entry.full_auc, lift: entry.auc_lift };
};

const getDemurBadge = (value: number | null, baseline: number): { text: string; bg: string; fg: string } => {
  if (value === null) return { text: 'N/A — answers everything', bg: 'var(--fmc-slate)', fg: 'white' };
  if (value === 1.0) return { text: 'PERFECT ✓', bg: 'var(--fmc-good)', fg: 'white' };
  if (value > baseline + 0.05) return { text: 'BETTER THAN RANDOM', bg: 'var(--fmc-good)', fg: 'white' };
  if (Math.abs(value - baseline) <= 0.05) return { text: '≈ RANDOM', bg: 'var(--fmc-warn)', fg: 'white' };
  return { text: 'ANTI-ALIGNED ⚠', bg: 'var(--fmc-bad)', fg: 'white' };
};

const getTrainingPhase = (mi: ModelCardData['model_identification']): 'es' | 'sp' | null => {
  if (mi.training_phase) return mi.training_phase.toLowerCase() as 'es' | 'sp';
  const mt = (mi.model_type || '').toLowerCase();
  if (mt === 'foundation' || mt === 'embedding space' || mt === 'es') return 'es';
  if (mt.includes('predictor') || mt.includes('tbd') || mt === 'sp' || mt === 'single predictor') return 'sp';
  return null;
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

export const ModelCard: React.FC<ModelCardProps> = ({ data, className = '', onRefetch, pollIntervalMs = 15000 }) => {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showPerRowTracking, setShowPerRowTracking] = useState<{ [key: string]: boolean }>({});
  const [activeStrategyTab, setActiveStrategyTab] = useState<string>('best_always_answers');

  // Auto-refresh polling during training
  const onRefetchRef = useRef(onRefetch);
  onRefetchRef.current = onRefetch;
  useEffect(() => {
    const isTraining = data.model_identification?.status?.toLowerCase() === 'training';
    if (!isTraining || !onRefetchRef.current) return;
    const id = setInterval(() => { onRefetchRef.current?.(); }, pollIntervalMs);
    return () => clearInterval(id);
  }, [data.model_identification?.status, pollIntervalMs]);

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
  const td = data.training_dataset;
  const be = data.best_epochs;
  const to = data.training_optimization;
  const dpn = data.data_processing_notes;
  const ma = data.model_architecture || {};
  const ms = data.model_stack?.[0] || {};
  const sp = data.single_predictor || {};

  const isTraining = mi.status?.toLowerCase() === 'training';
  const phase = getTrainingPhase(mi);
  const hideAucCards = isTraining && phase === 'es';

  const parsed = parseModelPath(data.disk_usage?.best_model_path);
  const modelIdDisplay = parsed.sessionId || mi.session_id?.substring(0, 20) || mi.model_id?.toString().substring(0, 20) || 'N/A';

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

  // Regression hero metrics (scalar targets) — best_r2 replaces ROC/PR-AUC entirely,
  // those are classification-only and are always N/A for a regression target.
  let bestR2: number | null = null;
  let bestRmse: number | null = null;
  let bestNrmse: number | null = null;
  let r2Skill: RegressionSkillVerdict | null = null;
  if (be?.best_r2?.regression_display_metadata) {
    const regMetrics = be.best_r2.regression_display_metadata.regression_metrics;
    bestR2 = regMetrics?.r2?.value ?? null;
    bestRmse = regMetrics?.rmse?.value ?? null;
    bestNrmse = regMetrics?.nrmse?.value ?? null;
    r2Skill = be.best_r2.regression_display_metadata.skill ?? null;
  }
  const isRegression = bestR2 !== null || bestRmse !== null;

  // Multiclass hero metrics. num_classes/class_labels (once the backend emits them) is the
  // authoritative multiclass signal — a multiclass target still gets a real "auc" (macro
  // one-vs-rest), so "both roc_auc and pr_auc are null" is NOT reliable by itself; it's only
  // the fallback for old cards that predate num_classes. Whatever best_epochs entry is
  // available (best_roc_auc included — its classification_metrics carries accuracy/macro_f1
  // too, not just auc) is fair game as the metrics source.
  const numClasses = mi.num_classes ?? (Array.isArray(mi.class_labels) ? mi.class_labels.length : null);
  let mcAccuracy: number | null = null;
  let mcHeadlineKey: string | null = null;
  let mcHeadlineVal: number | null = null;
  let isMulticlass = false;
  const wantMulticlass = !isRegression && (numClasses != null ? numClasses > 2 : (bestRocAuc === null && bestPrAuc === null));
  if (wantMulticlass && be) {
    const MC_HEADLINE_PREFERENCE = ['macro_f1', 'weighted_f1', 'cross_entropy', 'log_loss', 'macro_auc_ovr'];
    const checkpointMetricMc = to?.checkpoint_metric ?? null;
    let mcEpochKey = checkpointMetricMc && be[`best_${checkpointMetricMc}`] ? `best_${checkpointMetricMc}` : null;
    if (!mcEpochKey) {
      mcEpochKey = Object.keys(be).find(k => k.charAt(0) !== '_' && k !== 'best_r2' && be[k]) ?? null;
    }
    const mcMetrics = mcEpochKey ? be[mcEpochKey]?.classification_display_metadata?.classification_metrics : undefined;
    if (mcMetrics) {
      const mcMetricsRec = mcMetrics as Record<string, ClassificationMetric | undefined>;
      mcAccuracy = mcMetrics.accuracy?.value ?? null;
      if (checkpointMetricMc && mcMetricsRec[checkpointMetricMc] && checkpointMetricMc !== 'accuracy') {
        mcHeadlineKey = checkpointMetricMc;
      } else {
        mcHeadlineKey = MC_HEADLINE_PREFERENCE.find(k => mcMetricsRec[k]) ?? null;
      }
      mcHeadlineVal = mcHeadlineKey ? mcMetricsRec[mcHeadlineKey]?.value ?? null : null;
      isMulticlass = mcAccuracy !== null || mcHeadlineVal !== null;
    }
  }

  // Model stack values
  const spRows = ci?.total_samples || ms.rows || sp.num_rows || 0;
  const spLayers = ms.layers || ma.predictor_layers || sp.num_layers || 0;
  const spParams = ms.parameters || ma.predictor_parameters || sp.num_parameters || 0;

  const renderMetricsTable = (metrics: ClassificationDisplayMetadata['classification_metrics']) => {
    if (!metrics) return null;
    const metricOrder: (keyof typeof metrics)[] = ['accuracy', 'auc', 'pr_auc', 'f1', 'precision', 'recall', 'specificity', 'macro_f1', 'weighted_f1', 'macro_auc_ovr', 'log_loss'];
    const METRIC_LABELS: Partial<Record<keyof typeof metrics, string>> = {
      macro_f1: 'Macro F1', weighted_f1: 'Weighted F1', macro_auc_ovr: 'Macro AUC (OvR)', log_loss: 'Log Loss',
    };

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
            if (!m || typeof m !== 'object' || !('value' in m)) return null;
            return (
              <tr key={key}>
                <td style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{METRIC_LABELS[key] || String(key).replace('_', ' ')}</td>
                <td>{typeof m.value === 'number' ? (key === 'accuracy' ? `${(m.value * 100).toFixed(2)}%` : m.value.toFixed(4)) : 'N/A'}</td>
                <td><span className="quality-badge" style={getQualityStyle(m.quality)}>{m.quality || 'N/A'}</span></td>
                <td style={{ fontSize: '18px' }}>{m.trend || ''}</td>
                <td>{m.delta_1 !== null ? `${m.delta_1 > 0 ? '+' : ''}${key === 'accuracy' ? `${(m.delta_1 * 100).toFixed(2)}%` : m.delta_1.toFixed(4)}` : '-'}</td>
                <td>{m.delta_5 !== null ? `${m.delta_5 > 0 ? '+' : ''}${key === 'accuracy' ? `${(m.delta_5 * 100).toFixed(2)}%` : m.delta_5.toFixed(4)}` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const fmt3 = (v: number | null | undefined): string => (typeof v === 'number' ? v.toFixed(3) : '—');

  const renderPerClassMetrics = (metrics: ClassificationDisplayMetadata['classification_metrics']) => {
    const perClass = metrics?.per_class;
    if (!perClass || perClass.length === 0) return null;
    const avg = metrics?.averaging;
    const support = avg?.support != null ? avg.support.toLocaleString() : '—';

    return (
      <div>
        <p className="confusion-title" style={{ marginTop: 0 }}>Per-Class Metrics</p>
        <table>
          <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>
          <tbody>
            {perClass.map(c => (
              <tr key={c.label}>
                <td>{c.display_name ? `${c.label} — ${c.display_name}` : c.label}</td>
                <td>{fmt3(c.precision)}</td>
                <td>{fmt3(c.recall)}</td>
                <td>{fmt3(c.f1)}</td>
                <td>{c.support != null ? c.support.toLocaleString() : '—'}</td>
              </tr>
            ))}
            {avg?.macro && (
              <tr style={{ borderTop: '1px solid var(--fmc-line)' }}>
                <td style={{ fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>Macro avg</td>
                <td style={{ fontWeight: 'bold' }}>{fmt3(avg.macro.precision)}</td>
                <td style={{ fontWeight: 'bold' }}>{fmt3(avg.macro.recall)}</td>
                <td style={{ fontWeight: 'bold' }}>{fmt3(avg.macro.f1)}</td>
                <td style={{ fontWeight: 'bold' }}>{support}</td>
              </tr>
            )}
            {avg?.weighted && (
              <tr>
                <td style={{ fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>Weighted avg</td>
                <td style={{ fontWeight: 'bold' }}>{fmt3(avg.weighted.precision)}</td>
                <td style={{ fontWeight: 'bold' }}>{fmt3(avg.weighted.recall)}</td>
                <td style={{ fontWeight: 'bold' }}>{fmt3(avg.weighted.f1)}</td>
                <td style={{ fontWeight: 'bold' }}>{support}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPerClassAuc = (metrics: ClassificationDisplayMetadata['classification_metrics']) => {
    const perClassAuc = metrics?.per_class_auc_ovr;
    if (!perClassAuc || perClassAuc.length === 0) return null;
    const macroAuc = metrics?.macro_auc_ovr?.value;

    return (
      <details className="show-more" style={{ marginTop: '14px' }}>
        <summary>Show per-class AUC (one-vs-rest)</summary>
        <div style={{ marginTop: '10px', maxWidth: '320px' }}>
          <table>
            <thead><tr><th>Class</th><th>AUC (OvR)</th></tr></thead>
            <tbody>
              {perClassAuc.map(c => (
                <tr key={c.label}><td>{c.label}</td><td>{c.auc != null ? c.auc.toFixed(4) : '—'}</td></tr>
              ))}
              {typeof macroAuc === 'number' && (
                <tr style={{ borderTop: '1px solid var(--fmc-line)' }}>
                  <td style={{ fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>Macro AUC</td>
                  <td style={{ fontWeight: 'bold' }}>{macroAuc.toFixed(4)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    );
  };

  const isNxNConfusionMatrix = (cm: ConfusionMatrix | ConfusionMatrixNxN): cm is ConfusionMatrixNxN =>
    Array.isArray((cm as ConfusionMatrixNxN).matrix) && Array.isArray((cm as ConfusionMatrixNxN).class_labels);

  // Shared by the main confusion matrix (Model Details) and the declined-rows breakdown
  // (Selective Prediction) — one N×N heatmap component, reused wherever actual-vs-predicted
  // (or would-have-predicted) class counts need showing.
  const renderMatrixGrid = (labels: string[], matrix: number[][]) => {
    const n = labels.length;
    let maxDiag = 0, maxOffDiag = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = matrix[i]?.[j] || 0;
        if (i === j) { if (v > maxDiag) maxDiag = v; }
        else if (v > maxOffDiag) { maxOffDiag = v; }
      }
    }
    const cell = n <= 4 ? 56 : n <= 6 ? 46 : 36;
    const rowHeadW = 42;
    const cmLabelStyle: React.CSSProperties = { fontFamily: 'var(--fmc-mono)', fontSize: '11px', color: 'var(--fmc-slate)' };

    return (
      <div style={{ display: 'flex' }}>
        <div style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-lr', transform: 'rotate(180deg)', ...cmLabelStyle }}>Actual</div>
        <div>
          <div style={{ textAlign: 'center', marginLeft: `${rowHeadW}px`, marginBottom: '4px', ...cmLabelStyle }}>Predicted</div>
          <div style={{ display: 'flex', marginLeft: `${rowHeadW}px`, marginBottom: '3px' }}>
            {labels.map(l => (
              <div key={l} style={{ width: `${cell}px`, textAlign: 'center', fontWeight: 600, ...cmLabelStyle }}>{l}</div>
            ))}
          </div>
          {labels.map((rowLabel, i) => (
            <div key={rowLabel} style={{ display: 'flex', alignItems: 'center', marginBottom: '1px' }}>
              <div style={{ width: `${rowHeadW}px`, textAlign: 'right', paddingRight: '6px', fontWeight: 600, ...cmLabelStyle }}>{rowLabel}</div>
              {labels.map((colLabel, j) => {
                const val = matrix[i]?.[j] || 0;
                let cellStyle: React.CSSProperties;
                if (i === j) {
                  const alpha = maxDiag > 0 ? Math.min(0.86, 0.30 + 0.56 * (val / maxDiag)) : 0.3;
                  cellStyle = { background: `rgba(31,138,76,${alpha.toFixed(2)})`, color: alpha >= 0.45 ? '#fff' : 'var(--fmc-good)' };
                } else {
                  const oAlpha = (val === 0 || maxOffDiag === 0) ? 0 : Math.min(0.5, 0.06 + 0.44 * (val / maxOffDiag));
                  cellStyle = { background: `rgba(178,58,50,${oAlpha.toFixed(2)})`, color: 'var(--fmc-bad)' };
                }
                return (
                  <div key={colLabel} className="cm-cell" style={{ width: `${cell}px`, height: `${cell}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...cellStyle }}>
                    {val}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderConfusionMatrixNxN = (labels: string[], matrix: number[][], metrics: ClassificationDisplayMetadata['classification_metrics']) => {
    const perClassHtml = renderPerClassMetrics(metrics);
    return (
      <div className="confusion-wrapper">
        <h4 className="confusion-title">Confusion Matrix</h4>
        <div className="confusion-layout">
          {renderMatrixGrid(labels, matrix)}
          {perClassHtml && (
            <div style={{ flex: 1, minWidth: '300px' }}>
              {perClassHtml}
              {renderPerClassAuc(metrics)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfusionMatrix = (cm: ConfusionMatrix | ConfusionMatrixNxN | undefined, metrics?: ClassificationDisplayMetadata['classification_metrics']) => {
    if (!cm) return null;
    if (isNxNConfusionMatrix(cm)) {
      return renderConfusionMatrixNxN(cm.class_labels, cm.matrix, metrics);
    }
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
              <tr><td><strong>Hit Rate</strong> (Recall)</td><td className="dm-value">{hitRate.toFixed(4)}</td><td className="dm-formula">TP / (TP+FN)</td></tr>
              <tr><td><strong>Miss Rate</strong></td><td className="dm-value">{missRate.toFixed(4)}</td><td className="dm-formula">FN / (TP+FN)</td></tr>
              <tr><td><strong>Specificity</strong> (TNR)</td><td className="dm-value">{specificity.toFixed(4)}</td><td className="dm-formula">TN / (TN+FP)</td></tr>
              <tr><td><strong>False Alarm</strong> (FPR)</td><td className="dm-value">{falseAlarmRate.toFixed(4)}</td><td className="dm-formula">FP / (TN+FP)</td></tr>
              <tr><td><strong>Precision</strong> (PPV)</td><td className="dm-value">{precision.toFixed(4)}</td><td className="dm-formula">TP / (TP+FP)</td></tr>
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
            <h4 style={{ margin: '15px 0 10px 0', fontFamily: 'var(--fmc-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>This Epoch</h4>
            <table style={{ width: 'auto' }}>
              <thead><tr><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '18px', fontWeight: 'bold', color: 'var(--fmc-good)' }}>{prt.this_epoch.correct}</td>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '18px', fontWeight: 'bold', color: 'var(--fmc-bad)' }}>{prt.this_epoch.wrong}</td>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '18px', fontWeight: 'bold' }}>{prt.this_epoch.accuracy_pct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        {prt.cumulative_categories && (
          <>
            <h4 style={{ margin: '15px 0 10px 0', fontFamily: 'var(--fmc-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>Cumulative</h4>
            <table style={{ width: 'auto' }}>
              <thead><tr><th>Never Wrong</th><th>Rarely</th><th>Sometimes</th><th>Frequently</th><th>Always Wrong</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', color: 'var(--fmc-good)' }}>{prt.cumulative_categories.never_wrong}</td>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', color: '#6b8f2e' }}>{prt.cumulative_categories.rarely_wrong}</td>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', color: 'var(--fmc-warn)' }}>{prt.cumulative_categories.sometimes_wrong}</td>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', color: '#c2660c' }}>{prt.cumulative_categories.frequently_wrong}</td>
                  <td style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', color: 'var(--fmc-bad)' }}>{prt.cumulative_categories.always_wrong}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </details>
    );
  };

  const renderRegressionMetricsTable = (regMetrics: RegressionDisplayMetadata['regression_metrics'], skill: RegressionSkillVerdict | null | undefined) => {
    if (!regMetrics) return null;
    return (
      <>
        <table className="metrics-table">
          <thead><tr><th>Metric</th><th>Value</th><th>Quality</th></tr></thead>
          <tbody>
            {REGRESSION_METRIC_ORDER.map(key => {
              const m = regMetrics[key];
              if (!m || typeof m.value !== 'number') return null;
              const displayVal = key === 'smape' ? `${m.value.toFixed(2)}%` : m.value.toFixed(4);
              return (
                <tr key={key}>
                  <td style={{ fontWeight: 'bold' }}>{REGRESSION_METRIC_LABELS[key] || key}</td>
                  <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{displayVal}</td>
                  <td>{m.quality ? <span className="quality-badge" style={getQualityStyle(m.quality)}>{m.quality}</span> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {skill?.text && (
          <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: getSkillColor(skill.tier) }}>
            {skill.text}
          </div>
        )}
      </>
    );
  };

  const renderEpochSection = (title: string, epochData: BestEpochData | undefined, tabKey: string) => {
    if (!epochData) return null;

    // Regression (scalar target): R²/RMSE/MAE table + skill verdict — no confusion matrix,
    // no per-row correct/wrong (that tracking is classification-only today).
    if (epochData.regression_display_metadata) {
      const rdm = epochData.regression_display_metadata;
      return (
        <div className="epoch-section">
          <h3 className="epoch-title">{title} — Epoch {epochData.epoch || rdm.epoch || 'N/A'}</h3>
          {renderRegressionMetricsTable(rdm.regression_metrics, rdm.skill)}
        </div>
      );
    }

    const cdm = epochData.classification_display_metadata;

    return (
      <div className="epoch-section">
        <h3 className="epoch-title">{title} — Epoch {epochData.epoch || cdm?.epoch || 'N/A'}</h3>
        {renderMetricsTable(cdm?.classification_metrics)}
        {renderConfusionMatrix(cdm?.confusion_matrix, cdm?.classification_metrics)}
        {renderPerRowTracking(cdm?.per_row_tracking, tabKey)}
      </div>
    );
  };

  const renderSPEntry = (entry: SelectivePredictionEntry) => {
    if (entry.coverage === null || entry.coverage === undefined) return null;

    const {
      demur_error_capture, demur_random_baseline,
      coverage, confidence_threshold,
      n_covered, n_total, n_demurred,
      n_demurred_true_positives: tp, n_demurred_false_positives: fp,
      n_demurred_true_negatives: tn, n_demurred_false_negatives: fn,
      intent, source, calibration_method,
      intent_feasible, intent_feasibility_reason,
      covered_precision, covered_recall,
      declined_matrix, confidence_threshold_basis,
    } = entry;

    const showPrecision = intent === 'only_alert_when_confident' && covered_precision != null;
    const showRecall = (intent === 'catch_everything' || intent === 'catch_everything_aggressive') && covered_recall != null;
    const extraMetric = showPrecision
      ? { label: 'Covered Precision', value: covered_precision!.toFixed(4) }
      : showRecall
      ? { label: 'Covered Recall', value: covered_recall!.toFixed(4) }
      : null;

    const CONTRACT_INTENTS = new Set(['only_alert_when_confident', 'catch_everything', 'catch_everything_aggressive']);
    const showFallbackBanner = intent_feasible === false && CONTRACT_INTENTS.has(intent ?? '');

    const isNoop = intent === 'rank' || intent === 'predict_probabilities';
    // isAlwaysAnswers is really "did this strategy decline anything" — n_demurred is the ground
    // truth for that. demur_error_capture is a binary-only headline metric on top; its absence
    // (e.g. per-class "detect X" strategies) doesn't mean nothing was declined.
    const isAlwaysAnswers = n_demurred === 0;
    const hasDemurBadge = demur_error_capture !== null && demur_error_capture !== undefined;
    const badge = (isAlwaysAnswers || hasDemurBadge) ? getDemurBadge(hasDemurBadge ? demur_error_capture : null, demur_random_baseline ?? 0) : null;
    const coveragePct = (coverage * 100).toFixed(1);

    const pm = pickPrimaryMetric(entry);
    const liftColor = (pm.lift == null || pm.lift >= 0) ? 'var(--fmc-good)' : 'var(--fmc-bad)';
    const fmtAuc = (v: number | null | undefined): string => (v != null ? v.toFixed(4) : '—');

    const cellStyle = (highlight: boolean): React.CSSProperties => ({
      border: highlight ? '1px solid var(--fmc-good-border)' : '1px solid var(--fmc-line)',
      background: highlight ? 'var(--fmc-good-bg)' : 'var(--fmc-mist-2)',
      padding: '10px 18px', textAlign: 'center', fontWeight: 'bold',
      fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums',
      fontSize: '16px', color: highlight ? 'var(--fmc-good)' : 'var(--fmc-ink)', minWidth: '80px',
    });
    const rowLabelStyle: React.CSSProperties = {
      color: 'var(--fmc-slate)', fontFamily: 'var(--fmc-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 12px', whiteSpace: 'nowrap',
    };
    const colHeaderStyle: React.CSSProperties = {
      color: 'var(--fmc-slate)', fontWeight: 600, fontFamily: 'var(--fmc-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 12px', textAlign: 'center',
    };

    const intentLabel = INTENT_DISPLAY[intent ?? ''] ?? (intent ? humanizeObjective(intent) : 'Balanced (default)');

    return (
      <div>
        {/* Intent label */}
        <div className="opt-strip">
          <span className="opt-label">Optimized for</span> <strong>{intentLabel}</strong>
          {source && (
            <span style={{ padding: '2px 6px', background: source === 'per_epoch' ? 'var(--fmc-warn-bg)' : 'var(--fmc-good-bg)', border: `1px solid ${source === 'per_epoch' ? 'var(--fmc-warn-border)' : 'var(--fmc-good-border)'}`, borderRadius: '3px', fontFamily: 'var(--fmc-mono)', fontSize: '11px', color: source === 'per_epoch' ? 'var(--fmc-warn)' : 'var(--fmc-good)' }}>
              {source.replace(/_/g, ' ')}{calibration_method ? ` · ${calibration_method}` : ''}
            </span>
          )}
        </div>

        {/* Intent feasibility fallback banner */}
        {showFallbackBanner && (
          <div style={{ marginBottom: '15px', padding: '12px 16px', background: 'var(--fmc-warn-bg)', borderLeft: '4px solid var(--fmc-warn)', borderRadius: '0 4px 4px 0', fontSize: '13px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', color: 'var(--fmc-ink-soft)' }}>⚠ Operating point fell back to max-AUC</div>
            <div style={{ marginBottom: '8px', color: 'var(--fmc-ink-soft)' }}>
              This model was trained with intent=<strong>{intent}</strong>, but no operating point in the validation sweep could meet that floor.
              The framework returned the highest-AUC fallback instead.
            </div>
            <div style={{ marginBottom: '8px', color: 'var(--fmc-ink-soft)' }}>
              <strong>What this means for production:</strong>
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                <li>The headline metrics describe the fallback point, not the contract you asked for.</li>
                <li>Deploying this model will not deliver the requested floor.</li>
                <li>To honor your contract: lower your floor, retrain, or accept that the data does not support it.</li>
              </ul>
            </div>
            {intent_feasibility_reason && (
              <div style={{ color: 'var(--fmc-ink-soft)', fontStyle: 'italic' }}>{intent_feasibility_reason}</div>
            )}
          </div>
        )}

        {/* per_epoch warning */}
        {source === 'per_epoch' && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--fmc-warn-bg)', borderLeft: '3px solid var(--fmc-warn)', borderRadius: '0 4px 4px 0', fontSize: '12px', color: 'var(--fmc-warn)' }}>
            Operating point computed on uncalibrated probabilities — calibration did not run.
          </div>
        )}

        {/* rank / predict_probabilities — scoring model, no operating point */}
        {isNoop ? (
          <div style={{ padding: '15px', background: 'var(--fmc-mist-2)', border: '1px solid var(--fmc-line)', borderRadius: '4px', fontSize: '13px', color: 'var(--fmc-ink-soft)' }}>
            This model is meant for scoring, not operating-point decisions — use raw <code>predict_proba()</code> output.
          </div>
        ) : (
          <>
            {/* Demur headline */}
            {(isAlwaysAnswers || hasDemurBadge || pm.lift != null) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {isAlwaysAnswers ? (
                  <span className="quality-badge" style={{ backgroundColor: badge!.bg, color: badge!.fg }}>{badge!.text}</span>
                ) : hasDemurBadge ? (
                  <>
                    <span style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '22px', fontWeight: 'bold' }}>{demur_error_capture!.toFixed(4)}</span>
                    <span className="quality-badge" style={{ backgroundColor: badge!.bg, color: badge!.fg }}>{badge!.text}</span>
                    <span style={{ color: 'var(--fmc-slate)', fontFamily: 'var(--fmc-mono)', fontSize: '12px' }}>vs {(demur_random_baseline ?? 0).toFixed(2)} random</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontFamily: 'var(--fmc-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '22px', fontWeight: 'bold', color: liftColor }}>
                      {pm.lift! >= 0 ? '+' : ''}{pm.lift!.toFixed(4)}
                    </span>
                    <span style={{ color: 'var(--fmc-slate)', fontSize: '12px' }}>{pm.label} lift vs full</span>
                  </>
                )}
              </div>
            )}

            {/* Metrics grid */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${extraMetric ? 6 : 5}, 1fr)`, marginBottom: confidence_threshold_basis ? '4px' : '15px' }}>
              <div className="metric">
                <div className="metric-label">Covered {pm.label}</div>
                <div className="metric-value" style={{ fontSize: '18px' }}>{fmtAuc(pm.covered)}</div>
              </div>
              {extraMetric && (
                <div className="metric">
                  <div className="metric-label">{extraMetric.label}</div>
                  <div className="metric-value" style={{ fontSize: '18px' }}>{extraMetric.value}</div>
                </div>
              )}
              <div className="metric">
                <div className="metric-label">Full {pm.label}</div>
                <div className="metric-value" style={{ fontSize: '18px' }}>{fmtAuc(pm.full)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">{pm.label} Lift</div>
                <div className="metric-value" style={{ fontSize: '18px', color: liftColor }}>
                  {pm.lift != null ? `${pm.lift >= 0 ? '+' : ''}${pm.lift.toFixed(4)}` : '—'}
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Coverage</div>
                <div className="metric-value" style={{ fontSize: '18px' }}>{coveragePct}%</div>
              </div>
              <div className="metric">
                <div className="metric-label">Threshold</div>
                <div className="metric-value" style={{ fontSize: '18px' }}>{confidence_threshold != null ? confidence_threshold.toFixed(2) : '—'}</div>
              </div>
            </div>

            {confidence_threshold_basis === 'max_softmax_probability' && (
              <p style={{ fontSize: '11.5px', color: 'var(--fmc-slate)', margin: '0 0 15px' }}>
                Threshold is on max predicted-class probability (top-1 confidence) — a single &ldquo;positive-class score&rdquo; doesn&rsquo;t exist once there are more than two classes.
              </p>
            )}

            {/* Declined rows — N×N matrix when the backend supplies one, else the legacy binary 2×2 */}
            {!isAlwaysAnswers && declined_matrix ? (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontFamily: 'var(--fmc-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>Declined rows — what they would have been</h4>
                {renderMatrixGrid(declined_matrix.class_labels, declined_matrix.matrix)}
              </div>
            ) : !isAlwaysAnswers && n_demurred > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontFamily: 'var(--fmc-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'bold', color: 'var(--fmc-ink-soft)' }}>Declined rows — what they would have been</h4>
                <table style={{ width: 'auto' }}>
                  <tbody>
                    <tr>
                      <th></th>
                      <th style={colHeaderStyle}>Actual +</th>
                      <th style={colHeaderStyle}>Actual −</th>
                    </tr>
                    <tr>
                      <td style={rowLabelStyle}>Would predict +</td>
                      <td style={cellStyle(false)}>{tp}<br /><span style={{ fontFamily: 'var(--fmc-sans)', fontSize: '10px', fontWeight: 'normal', color: 'var(--fmc-slate)' }}>thrown away</span></td>
                      <td style={cellStyle(true)}>{fp}<br /><span style={{ fontFamily: 'var(--fmc-sans)', fontSize: '10px', fontWeight: 'normal', color: 'var(--fmc-good)' }}>error hidden ✓</span></td>
                    </tr>
                    <tr>
                      <td style={rowLabelStyle}>Would predict −</td>
                      <td style={cellStyle(true)}>{fn}<br /><span style={{ fontFamily: 'var(--fmc-sans)', fontSize: '10px', fontWeight: 'normal', color: 'var(--fmc-good)' }}>error hidden ✓</span></td>
                      <td style={cellStyle(false)}>{tn}<br /><span style={{ fontFamily: 'var(--fmc-sans)', fontSize: '10px', fontWeight: 'normal', color: 'var(--fmc-slate)' }}>thrown away</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Context line */}
            <div style={{ color: 'var(--fmc-ink-soft)', fontSize: '13px' }}>
              Answered {n_covered.toLocaleString()}/{n_total.toLocaleString()} ({coveragePct}%) — declined {n_demurred.toLocaleString()}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSelectivePrediction = () => {
    const sp = data.coverage ?? data.selective_prediction;
    if (!sp) return null;

    // Build strategy tabs from whatever keys are actually present under sp.strategies.
    const stratKeys = sortStrategyKeys(Object.keys(sp.strategies ?? {}).filter(k => k.charAt(0) !== '_' && sp.strategies?.[k]));
    const availableGroups = stratKeys.map(key => ({
      label: sp.strategies![key].label || LEGACY_STRATEGY_LABELS[key] || humanizeKey(key),
      key,
    }));

    const initialTab = availableGroups[0]?.key ?? '';
    const activeTab = availableGroups.find(g => g.key === activeStrategyTab) ? activeStrategyTab : initialTab;

    return (
      <details className="section" open>
        <summary>SELECTIVE PREDICTION</summary>
        <div className="section-content">
          {sp.summary && (
            <>
              <h3 className="epoch-title">Summary</h3>
              {renderSPEntry(sp.summary)}
            </>
          )}

          {availableGroups.length > 0 && (
            <div style={{ marginTop: sp.summary ? '25px' : '0' }}>
              <h3 className="epoch-title">Strategies</h3>
              <div className="epoch-tabs">
                {availableGroups.map(({ label, key }) => (
                  <button key={key} className={`epoch-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveStrategyTab(key)}>
                    {label}
                  </button>
                ))}
              </div>
              {availableGroups.map(({ key }) => (
                <div key={key} className={`epoch-tab-content ${activeTab === key ? 'active' : ''}`}>
                  <div className="epoch-section">
                    {renderSPEntry(sp.strategies![key]!)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sp.history && sp.history.length > 0 && (
            <div style={{ marginTop: '25px' }}>
              <h3 className="epoch-title">History</h3>
              <table>
                <thead>
                  <tr>
                    <th>Epoch</th>
                    <th>Coverage</th>
                    <th>Covered AUC</th>
                    <th>Demur Error Capture</th>
                    <th>vs Random</th>
                  </tr>
                </thead>
                <tbody>
                  {sp.history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.epoch ?? i}</td>
                      <td>{h.coverage != null ? `${(h.coverage * 100).toFixed(1)}%` : '—'}</td>
                      <td>{h.covered_auc != null ? h.covered_auc.toFixed(4) : '—'}</td>
                      <td>{h.demur_error_capture != null ? h.demur_error_capture.toFixed(4) : 'N/A'}</td>
                      <td style={{ color: 'var(--fmc-slate)', fontFamily: 'var(--fmc-mono)', fontSize: '12px' }}>{h.demur_random_baseline != null ? h.demur_random_baseline.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    );
  };

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return (
    <div className={`featrix-model-card ${className}`}>
      <style>{`
        .featrix-model-card {
          --fmc-paper: #ffffff;
          --fmc-mist: #f4f5f7;
          --fmc-mist-2: #eceef1;
          --fmc-ink: #14171c;
          --fmc-ink-soft: #454b56;
          --fmc-slate: #6b7280;
          --fmc-line: #dde0e5;
          --fmc-line-soft: #e8eaed;
          --fmc-brass: #8a5a1e;
          --fmc-brass-strong: #6e480f;
          --fmc-brass-bg: #f7ecd9;
          --fmc-brass-border: #e6cd9e;
          --fmc-good: #1f8a4c;
          --fmc-good-bg: #e5f5ea;
          --fmc-good-border: #b9e2c6;
          --fmc-bad: #b23a32;
          --fmc-bad-bg: #fbe9e7;
          --fmc-bad-border: #f0c3bd;
          --fmc-warn: #a8710c;
          --fmc-warn-bg: #fbf1dc;
          --fmc-warn-border: #edd39a;
          --fmc-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          --fmc-mono: ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Menlo, Consolas, monospace;
        }
        .featrix-model-card * { margin: 0; padding: 0; box-sizing: border-box; color: var(--fmc-ink); }
        .featrix-model-card { font-family: var(--fmc-sans); background: var(--fmc-mist); color: var(--fmc-ink); line-height: 1.5; }
        .featrix-model-card .page { max-width: 1400px; margin: 0 auto; padding: 20px 40px; }

        .featrix-model-card .header { border-bottom: 2px solid var(--fmc-ink); padding-bottom: 10px; margin-bottom: 15px; }
        .featrix-model-card .header h1 { font-family: var(--fmc-mono); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 4px; }
        .featrix-model-card .header .meta { font-family: var(--fmc-mono); font-size: 12px; color: var(--fmc-slate); }

        .featrix-model-card details { margin: 20px 0; border: 1px solid var(--fmc-line); border-radius: 5px; background: var(--fmc-paper); overflow: hidden; }
        .featrix-model-card details summary { padding: 10px 20px; cursor: pointer; font-weight: 700; background: var(--fmc-mist-2); border-bottom: 1px solid var(--fmc-line); user-select: none; text-transform: uppercase; font-family: var(--fmc-mono); font-size: 11.5px; letter-spacing: 0.06em; color: var(--fmc-ink-soft); }
        .featrix-model-card details summary:hover { color: var(--fmc-ink); }
        .featrix-model-card details[open] summary { border-bottom: 1px solid var(--fmc-line); }
        .featrix-model-card .section-content { padding: 22px; }

        .featrix-model-card .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--fmc-line); border: 1px solid var(--fmc-line); border-radius: 4px; overflow: hidden; }
        .featrix-model-card .metric { padding: 14px 15px; background: var(--fmc-paper); border: none; }
        .featrix-model-card .metric-label { font-family: var(--fmc-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; color: var(--fmc-slate); }
        .featrix-model-card .metric-value { font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 700; }

        .featrix-model-card table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .featrix-model-card th { color: var(--fmc-slate); padding: 8px 12px; text-align: left; font-weight: 600; font-family: var(--fmc-mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 1px solid var(--fmc-line); }
        .featrix-model-card td { padding: 9px 12px; font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--fmc-line-soft); }
        .featrix-model-card tr:last-child td { border-bottom: none; }

        .featrix-model-card .epoch-tabs { display: flex; gap: 6px; margin-bottom: 0; border-bottom: 1px solid var(--fmc-line); flex-wrap: wrap; }
        .featrix-model-card .epoch-tab { padding: 8px 16px; background: none; border: 1px solid var(--fmc-line); border-bottom: none; cursor: pointer; font-size: 12px; font-weight: 700; font-family: var(--fmc-mono); margin-bottom: -1px; border-radius: 4px 4px 0 0; color: var(--fmc-slate); }
        .featrix-model-card .epoch-tab:hover { color: var(--fmc-ink); }
        .featrix-model-card .epoch-tab.active { background: var(--fmc-paper); color: var(--fmc-ink); border-color: var(--fmc-line); border-bottom: 1px solid var(--fmc-paper); position: relative; }
        .featrix-model-card .epoch-tab-content { display: none; }
        .featrix-model-card .epoch-tab-content.active { display: block; }
        .featrix-model-card .epoch-section { padding: 20px; background: var(--fmc-paper); border: 1px solid var(--fmc-line); border-top: none; }
        .featrix-model-card .epoch-title { margin: 0 0 15px 0; font-family: var(--fmc-mono); font-size: 13.5px; font-weight: 700; color: var(--fmc-ink); }

        .featrix-model-card .opt-strip { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .featrix-model-card .opt-label { font-size: 12.5px; color: var(--fmc-slate); }
        .featrix-model-card .fmc-badge-brass { display: inline-flex; align-items: center; font-family: var(--fmc-mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; padding: 4px 10px; border-radius: 3px; background: var(--fmc-brass-bg); color: var(--fmc-brass-strong); border: 1px solid var(--fmc-brass-border); }
        .featrix-model-card .fmc-tag { font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate); border: 1px solid var(--fmc-line); background: var(--fmc-mist); padding: 2px 7px; border-radius: 3px; }

        .featrix-model-card .confusion-wrapper { margin-top: 20px; }
        .featrix-model-card .confusion-title { margin: 0 0 15px 0; font-family: var(--fmc-mono); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--fmc-ink-soft); }
        .featrix-model-card .confusion-layout { display: flex; gap: 36px; align-items: flex-start; }
        .featrix-model-card .confusion-matrix { width: auto; text-align: center; }
        .featrix-model-card .confusion-matrix th, .featrix-model-card .confusion-matrix td { border: none; }
        .featrix-model-card .cm-header { padding: 5px; font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate); font-weight: normal; }
        .featrix-model-card .cm-label { padding: 5px; width: 50px; font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate); font-weight: normal; }
        .featrix-model-card .cm-cell { padding: 12px 15px; border: 1px solid var(--fmc-paper); outline: 1px solid var(--fmc-line-soft); font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 16px; font-weight: bold; }
        .featrix-model-card .cm-correct { background: var(--fmc-good-bg); color: var(--fmc-good); }
        .featrix-model-card .cm-error { background: var(--fmc-bad-bg); color: var(--fmc-bad); }
        .featrix-model-card .derived-metrics { width: auto; font-size: 13px; }
        .featrix-model-card .derived-metrics td { padding: 6px 12px; border: none; font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; }
        .featrix-model-card .dm-value { text-align: right; }
        .featrix-model-card .dm-formula { color: var(--fmc-slate); }

        .featrix-model-card .show-more { margin-top: 15px; border: none; background: none; }
        .featrix-model-card .show-more summary { padding: 5px 0; cursor: pointer; font-size: 12px; color: var(--fmc-brass); background: none; border: none; font-weight: 600; text-transform: none; }
        .featrix-model-card .show-more summary:hover { color: var(--fmc-brass-strong); text-decoration: underline; }

        .featrix-model-card .controls { margin-bottom: 15px; display: flex; gap: 8px; flex-wrap: wrap; }
        .featrix-model-card .btn { padding: 6px 13px; background: var(--fmc-paper); color: var(--fmc-ink); border: 1px solid var(--fmc-line); border-radius: 4px; cursor: pointer; font-size: 12px; font-family: var(--fmc-mono); }
        .featrix-model-card .btn:hover { border-color: var(--fmc-slate); }

        @keyframes featrix-training-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .featrix-model-card .status-badge, .featrix-model-card .quality-badge { display: inline-block; padding: 4px 12px; border-radius: 3px; color: white; font-family: var(--fmc-mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em; }
        .featrix-model-card .status-badge.training { animation: featrix-training-pulse 2s ease-in-out infinite; }

        .featrix-model-card code { background: var(--fmc-mist-2); padding: 2px 6px; border: 1px solid var(--fmc-line); border-radius: 3px; font-family: var(--fmc-mono); font-size: 12.5px; }

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
            {isTraining && phase && (
              <div style={{ marginBottom: '15px', padding: '8px 14px', background: 'var(--fmc-warn-bg)', borderLeft: '3px solid var(--fmc-warn)', borderRadius: '0 4px 4px 0', fontSize: '13px', color: 'var(--fmc-warn)' }}>
                {phase === 'es' ? 'Phase 1/2: Training Foundation Model' : 'Phase 2/2: Training Predictor'}
              </div>
            )}
            {mi.user_intent && (
              <div style={{ marginBottom: '15px', padding: '12px 16px', background: 'var(--fmc-brass-bg)', borderLeft: '3px solid var(--fmc-brass)', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--fmc-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fmc-brass)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Objective</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--fmc-brass-strong)' }}>{humanizeObjective(mi.user_intent.objective)}</span>
                <span style={{ fontSize: '12px', color: 'var(--fmc-brass)' }}>{mi.user_intent.task}</span>
                {mi.user_intent.source && (
                  <span style={{ fontFamily: 'var(--fmc-mono)', fontSize: '11px', color: 'var(--fmc-brass)', marginLeft: 'auto' }}>{mi.user_intent.source.replace(/_/g, ' ')}</span>
                )}
              </div>
            )}
            <div className="grid" style={hideAucCards ? { gridTemplateColumns: 'repeat(2, 1fr)' } : undefined}>
              <div className="metric">
                <div className="metric-label">Target Column</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>{mi.target_column || 'N/A'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Model Type</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>
                  {getModelTypeDisplay(mi.model_type, mi.target_column_type, numClasses, isMulticlass)}
                </div>
              </div>
              {!hideAucCards && isRegression && (
                <>
                  <div className="metric" style={{ background: 'var(--fmc-brass-bg)', borderColor: 'var(--fmc-brass-border)' }}>
                    <div className="metric-label" style={{ color: 'var(--fmc-brass-strong)' }}>Best R²</div>
                    <div className="metric-value" style={{ fontSize: '28px', color: 'var(--fmc-brass-strong)' }}>
                      {bestR2 !== null ? bestR2.toFixed(4) : 'N/A'}
                    </div>
                  </div>
                  <div className="metric" style={{ background: 'var(--fmc-brass-bg)', borderColor: 'var(--fmc-brass-border)' }} title={bestNrmse !== null ? `NRMSE (RMSE / target σ): ${bestNrmse.toFixed(3)}` : undefined}>
                    <div className="metric-label" style={{ color: 'var(--fmc-brass-strong)' }}>Best RMSE</div>
                    <div className="metric-value" style={{ fontSize: '28px', color: 'var(--fmc-brass-strong)' }}>
                      {bestRmse !== null ? bestRmse.toFixed(4) : 'N/A'}
                    </div>
                  </div>
                </>
              )}
              {!hideAucCards && !isRegression && isMulticlass && (
                <>
                  <div className="metric" style={{ background: 'var(--fmc-brass-bg)', borderColor: 'var(--fmc-brass-border)' }}>
                    <div className="metric-label" style={{ color: 'var(--fmc-brass-strong)' }}>Best Accuracy</div>
                    <div className="metric-value" style={{ fontSize: '28px', color: 'var(--fmc-brass-strong)' }}>
                      {mcAccuracy !== null ? `${(mcAccuracy * 100).toFixed(2)}%` : 'N/A'}
                    </div>
                  </div>
                  <div className="metric" style={{ background: 'var(--fmc-brass-bg)', borderColor: 'var(--fmc-brass-border)' }}>
                    <div className="metric-label" style={{ color: 'var(--fmc-brass-strong)' }}>Best {formatMetricName(mcHeadlineKey)}</div>
                    <div className="metric-value" style={{ fontSize: '28px', color: 'var(--fmc-brass-strong)' }}>
                      {mcHeadlineVal !== null ? mcHeadlineVal.toFixed(4) : 'N/A'}
                    </div>
                  </div>
                </>
              )}
              {!hideAucCards && !isRegression && !isMulticlass && (
                <>
                  <div className="metric" style={{ background: 'var(--fmc-brass-bg)', borderColor: 'var(--fmc-brass-border)' }}>
                    <div className="metric-label" style={{ color: 'var(--fmc-brass-strong)' }}>Best ROC-AUC</div>
                    <div className="metric-value" style={{ fontSize: '28px', color: 'var(--fmc-brass-strong)' }}>
                      {bestRocAuc !== null ? bestRocAuc.toFixed(4) : 'N/A'}
                    </div>
                  </div>
                  <div className="metric" style={{ background: 'var(--fmc-brass-bg)', borderColor: 'var(--fmc-brass-border)' }}>
                    <div className="metric-label" style={{ color: 'var(--fmc-brass-strong)' }}>Best PR-AUC</div>
                    <div className="metric-value" style={{ fontSize: '28px', color: 'var(--fmc-brass-strong)' }}>
                      {bestPrAuc !== null ? bestPrAuc.toFixed(4) : 'N/A'}
                      {prAucLift !== null && <span style={{ fontSize: '14px', fontWeight: 'normal' }}> [{prAucLift.toFixed(1)}x]</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
            {isRegression && r2Skill?.text && (
              <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: getSkillColor(r2Skill.tier) }}>
                {r2Skill.text}
              </div>
            )}
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--fmc-line)', fontFamily: 'var(--fmc-mono)', fontSize: '12px', color: 'var(--fmc-slate)', lineHeight: 2 }}>
              <span className={`status-badge${mi.status?.toLowerCase() === 'training' ? ' training' : ''}`} style={{ backgroundColor: getStatusColor(mi.status), fontSize: '11px', padding: '2px 8px' }}>
                {getStatusDisplay(mi.status)}
              </span>
              &nbsp;&nbsp;{mi.training_date || 'N/A'}
              &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Model:</strong> <code style={{ fontSize: '11px' }}>{modelIdDisplay}</code>
              &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Cluster:</strong> {(mi.compute_cluster || 'N/A').toUpperCase()}
              &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Dims:</strong> {es?.d_model || 'N/A'}
              {mi.encoding_intent && <>&nbsp;&nbsp;•&nbsp;&nbsp;<strong>Encoding:</strong> {mi.encoding_intent}</>}
              {isTraining && (() => {
                const tc = data.training_configuration;
                const currentEpoch = tc?.current_epoch ?? tc?.best_epoch ?? null;
                const plannedEpochs = tc?.planned_epochs ?? null;
                if (currentEpoch === null) return null;
                const pct = plannedEpochs ? Math.min(100, Math.round((currentEpoch / plannedEpochs) * 100)) : null;
                return (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--fmc-ink-soft)' }}>
                    <strong>Epoch {currentEpoch}{plannedEpochs ? ` / ${plannedEpochs}` : ''}</strong>
                    {pct !== null && (
                      <>
                        <div style={{ display: 'inline-block', width: '120px', height: '8px', background: 'var(--fmc-line)', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '10px' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fmc-warn)', borderRadius: '4px' }} />
                        </div>
                        {' '}<span style={{ fontFamily: 'var(--fmc-mono)', fontSize: '11px', color: 'var(--fmc-slate)' }}>{pct}%</span>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </details>

        {/* MODEL FIT */}
        {data.model_fit && (() => {
          const mf = data.model_fit!;
          const MF_INTENT_LABELS: Record<string, string> = {
            balanced: 'Balanced',
            only_alert_when_confident: 'Only alert when confident',
            catch_everything: 'Catch everything',
            catch_everything_aggressive: 'Catch everything (aggressive)',
            minimize_cost: 'Minimize cost',
            rank: 'Ranking',
            predict_probabilities: 'Calibrated probabilities',
          };
          const mfScoreColor = (s: number) =>
            s >= 0.80 ? '#28a745' : s >= 0.50 ? '#e6940a' : '#6c757d';
          const ScoreBar = ({ score }: { score: number }) => {
            const color = mfScoreColor(score);
            const pct = Math.round(score * 100);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
                <div style={{ flex: 1, maxWidth: 200, background: '#e0e0e0', height: 8, borderRadius: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 'bold', color, minWidth: 34 }}>{pct}%</span>
              </div>
            );
          };
          const ShapeScoreList = ({ scores }: { scores: ModelFitShapeScore[] }) => {
            if (!scores || scores.length === 0) return null;
            const top3 = scores.slice(0, 3);
            const rest = scores.slice(3);
            return (
              <>
                {top3.map((s, i) => (
                  <div key={i} style={{ margin: '8px 0' }}>
                    <div style={{ fontSize: 13, color: '#333' }}>{s.label}</div>
                    <ScoreBar score={s.score} />
                  </div>
                ))}
                {rest.length > 0 && (
                  <details style={{ marginTop: 6, border: 'none' }}>
                    <summary style={{ fontSize: 12, color: '#1976d2', cursor: 'pointer', padding: '4px 0', fontWeight: 'normal', textTransform: 'none' }}>
                      Show {rest.length} more
                    </summary>
                    {rest.map((s, i) => (
                      <div key={i} style={{ margin: '8px 0' }}>
                        <div style={{ fontSize: 13, color: '#888' }}>{s.label}</div>
                        <ScoreBar score={s.score} />
                      </div>
                    ))}
                  </details>
                )}
              </>
            );
          };
          const TopFitDetail = ({ tf }: { tf: ModelFitTopFit }) => (
            <>
              {tf.summary && <div style={{ fontSize: 13, color: '#555', margin: '8px 0' }}>{tf.summary}</div>}
              {tf.good_fit && tf.good_fit.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#2e7d32', margin: '6px 0 3px' }}>Good for</div>
                  <ul style={{ margin: '0 0 8px 18px', padding: 0, listStyle: 'disc' }}>
                    {tf.good_fit.map((g, i) => <li key={i} style={{ fontSize: 12, color: '#333', margin: '2px 0' }}>{g}</li>)}
                  </ul>
                </>
              )}
              {tf.poor_fit && tf.poor_fit.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#c62828', margin: '6px 0 3px' }}>Watch out</div>
                  <ul style={{ margin: '0 0 8px 18px', padding: 0, listStyle: 'disc' }}>
                    {tf.poor_fit.map((p, i) => <li key={i} style={{ fontSize: 12, color: '#666', margin: '2px 0' }}>{p}</li>)}
                  </ul>
                </>
              )}
              {tf.target_framing && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>
                  Positive class framing: {tf.target_framing}
                </div>
              )}
            </>
          );

          return (
            <details className="section" open>
              <summary>MODEL FIT</summary>
              <div className="section-content">

                {/* Primary block */}
                {mf.primary?.top_fit && (() => {
                  const tf = mf.primary!.top_fit!;
                  const score = tf.score ?? 0;
                  const pct = Math.round(score * 100);
                  const color = mfScoreColor(score);
                  const intentLabel = MF_INTENT_LABELS[mf.primary!.intent || ''] || mf.primary!.intent || '';
                  const primaryEntry = (mf.per_intent || []).find(e => e.intent === mf.primary!.intent);
                  if (score >= 0.50) {
                    return (
                      <div style={{ padding: 20, background: '#f8f9fa', borderLeft: `4px solid ${color}`, marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span style={{ fontSize: 20, fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>{tf.label}</span>
                          <span style={{ fontSize: 16, fontWeight: 'bold', color }}>{pct}%</span>
                          <span style={{ fontSize: 11, color: '#999' }}>under {intentLabel} intent</span>
                        </div>
                        <TopFitDetail tf={tf} />
                        {primaryEntry && primaryEntry.shape_scores && primaryEntry.shape_scores.length > 1 && (
                          <details style={{ marginTop: 14, border: 'none' }}>
                            <summary style={{ fontSize: 12, color: '#1976d2', cursor: 'pointer', padding: '4px 0', fontWeight: 'normal', textTransform: 'none' }}>
                              Other shapes scored
                            </summary>
                            <div style={{ marginTop: 8 }}>
                              <ShapeScoreList scores={primaryEntry.shape_scores.slice(1)} />
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  } else {
                    const topScores = primaryEntry?.shape_scores?.slice(0, 3) ?? [tf];
                    return (
                      <div style={{ padding: 20, background: '#f8f9fa', borderLeft: '4px solid #6c757d', marginBottom: 20 }}>
                        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 12 }}>No single clear use-case fit</div>
                        <ShapeScoreList scores={topScores} />
                      </div>
                    );
                  }
                })()}

                {/* Per-intent fits */}
                {mf.per_intent && mf.per_intent.length > 0 && (
                  <>
                    <h3 className="epoch-title" style={{ marginTop: 10 }}>Per-intent fits</h3>
                    <div style={{ border: '1px solid #ddd' }}>
                      {mf.per_intent.map((entry, i) => {
                        const tf2 = entry.top_fit || {} as ModelFitTopFit;
                        const s2 = tf2.score ?? 0;
                        const c2 = mfScoreColor(s2);
                        const p2 = Math.round(s2 * 100);
                        const iLabel = MF_INTENT_LABELS[entry.intent || ''] || entry.intent || '—';
                        return (
                          <details key={i} style={{ margin: 0, border: 'none', borderBottom: i < mf.per_intent!.length - 1 ? '1px solid #eee' : undefined }}>
                            <summary style={{ padding: '12px 16px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 'normal', textTransform: 'none', fontSize: 13, userSelect: 'none' }}>
                              <span style={{ flex: 1, color: '#333' }}>{iLabel}</span>
                              <span style={{ color: '#555', fontSize: 13 }}>{tf2.label || '—'}</span>
                              <span style={{ fontSize: 12, fontWeight: 'bold', color: c2, minWidth: 38, textAlign: 'right' }}>{p2}%</span>
                            </summary>
                            <div style={{ padding: '16px 20px', background: '#fafafa', borderTop: '1px solid #eee' }}>
                              {tf2.label && <TopFitDetail tf={tf2} />}
                              {entry.shape_scores && entry.shape_scores.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#666', fontWeight: 'bold', marginBottom: 8 }}>All shapes</div>
                                  <ShapeScoreList scores={entry.shape_scores} />
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Reference table */}
                {mf.reference_table && mf.reference_table.length > 0 && (
                  <details style={{ marginTop: 20, border: '1px solid #ddd' }}>
                    <summary style={{ padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 'bold', background: '#f5f5f5', textTransform: 'none', color: '#333', userSelect: 'none' }}>
                      What do these shapes mean?
                    </summary>
                    <div style={{ padding: '16px 20px' }}>
                      {mf.reference_table.map((shape, i) => (
                        <div key={i}>
                          {i > 0 && <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #eee' }} />}
                          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#000', marginBottom: 4 }}>{shape.label || shape.id}</div>
                          {shape.summary && <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{shape.summary}</div>}
                          {shape.good_fit && shape.good_fit.length > 0 && (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 3 }}>Good for</div>
                              <ul style={{ margin: '0 0 8px 18px', padding: 0, listStyle: 'disc' }}>
                                {shape.good_fit.map((g, j) => <li key={j} style={{ fontSize: 12, color: '#333', margin: '2px 0' }}>{g}</li>)}
                              </ul>
                            </>
                          )}
                          {shape.poor_fit && shape.poor_fit.length > 0 && (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#c62828', marginBottom: 3 }}>Watch out</div>
                              <ul style={{ margin: '0 0 8px 18px', padding: 0, listStyle: 'disc' }}>
                                {shape.poor_fit.map((p, j) => <li key={j} style={{ fontSize: 12, color: '#666', margin: '2px 0' }}>{p}</li>)}
                              </ul>
                            </>
                          )}
                          {shape.criteria && shape.criteria.length > 0 && (
                            <details style={{ marginTop: 6, border: 'none' }}>
                              <summary style={{ fontSize: 11, color: '#1976d2', cursor: 'pointer', padding: '4px 0', fontWeight: 'normal', textTransform: 'none' }}>
                                Why this shape? (engineer view)
                              </summary>
                              <table style={{ width: 'auto', marginTop: 8, fontSize: 11 }}>
                                <thead>
                                  <tr><th>Metric</th><th>Op</th><th>Target</th><th>Tol</th><th>Weight</th></tr>
                                </thead>
                                <tbody>
                                  {shape.criteria.map((c, j) => (
                                    <tr key={j}>
                                      <td style={{ fontFamily: 'monospace' }}>{c.metric}</td>
                                      <td>{c.op}</td>
                                      <td>{c.target}</td>
                                      <td>{c.tol ?? ''}</td>
                                      <td>{c.weight ?? ''}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

              </div>
            </details>
          );
        })()}

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
                    <td style={{ color: 'var(--fmc-good)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Yes</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{spRows.toLocaleString()}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{spLayers ? formatLargeNumber(spLayers) : 'N/A'}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{spParams ? formatLargeNumber(spParams) : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Foundation</td>
                    <td style={{ color: 'var(--fmc-slate)', whiteSpace: 'nowrap' }}>No</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{(es.num_rows || 0).toLocaleString()}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatLargeNumber(es.num_layers)}</td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatLargeNumber(es.num_parameters)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* MODEL DETAILS - Best Epochs with Tabs (hidden during ES training) */}
        {/* Tabs are generated from whatever best_epochs.* keys are actually present — not hardcoded
            to PR-AUC/ROC-AUC — so multiclass models (best_macro_f1, best_log_loss, ...) get their
            own tabs automatically. training_optimization.checkpoint_metric picks the default tab. */}
        {be && !hideAucCards && (() => {
          const epochKeys = sortEpochKeys(Object.keys(be).filter(k => k.charAt(0) !== '_' && be[k]));
          if (epochKeys.length === 0) return null;
          const checkpointMetric = to?.checkpoint_metric ?? null;
          const preferredKey = checkpointMetric ? `best_${checkpointMetric}` : null;
          const defaultKey = (preferredKey && be[preferredKey]) ? preferredKey : (be.best_roc_auc ? 'best_roc_auc' : epochKeys[0]);
          const currentTab = (activeTab && epochKeys.includes(activeTab)) ? activeTab : defaultKey;

          return (
            <details className="section" open>
              <summary>MODEL DETAILS</summary>
              <div className="section-content">
                {checkpointMetric && (
                  <div className="opt-strip">
                    <span className="opt-label">Optimized for</span>
                    <span className="fmc-badge-brass">{formatMetricName(checkpointMetric).toUpperCase()}</span>
                  </div>
                )}
                <div className="epoch-tabs">
                  {epochKeys.map(key => (
                    <button
                      key={key}
                      className={`epoch-tab ${currentTab === key ? 'active' : ''}`}
                      onClick={() => setActiveTab(key)}
                    >
                      Best {formatMetricName(key.replace(/^best_/, ''))}
                    </button>
                  ))}
                </div>
                {epochKeys.map(key => (
                  <div key={key} className={`epoch-tab-content ${currentTab === key ? 'active' : ''}`}>
                    {renderEpochSection(`Best ${formatMetricName(key.replace(/^best_/, ''))}`, be[key], key)}
                  </div>
                ))}
              </div>
            </details>
          );
        })()}

        {/* SELECTIVE PREDICTION */}
        {renderSelectivePrediction()}

        {/* TRAINING OPTIMIZATION */}
        {to && (
          <details className="section" open>
            <summary>TRAINING OPTIMIZATION</summary>
            <div className="section-content">
              {to.optimization_description && (
                <div style={{ marginBottom: '20px', padding: '12px 15px', background: 'var(--fmc-brass-bg)', borderLeft: '3px solid var(--fmc-brass)', borderRadius: '0 4px 4px 0', fontSize: '14px' }}>
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
                      <td>{to.checkpoint_value.toFixed(4)} at epoch {to.checkpoint_epoch ?? 'N/A'}</td>
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
        {(ci || td?.total_rows !== undefined) && (
          <details className="section" open>
            <summary>TRAINING DATASET</summary>
            <div className="section-content">
              {/* Base row/feature counts -- always present (ES, SP, regression, multiclass
                  alike), unlike the class-imbalance breakdown below, which only exists for
                  classification SP cards. A regression or Embedding Space card has no
                  class_imbalance at all, so without this the section rendered nothing even
                  though total_rows/train_rows/etc. were sitting right there in
                  training_dataset the whole time. */}
              {td?.total_rows !== undefined && (
                <>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
                    <div className="metric"><div className="metric-label">Total Rows</div><div className="metric-value">{(td.total_rows || 0).toLocaleString()}</div></div>
                    <div className="metric"><div className="metric-label">Train Rows</div><div className="metric-value">{(td.train_rows || 0).toLocaleString()}</div></div>
                    <div className="metric"><div className="metric-label">Val Rows</div><div className="metric-value">{(td.val_rows || 0).toLocaleString()}</div></div>
                    <div className="metric"><div className="metric-label">Features</div><div className="metric-value">{td.total_features !== undefined ? td.total_features : 'N/A'}</div></div>
                  </div>
                  {td.validation_notes && td.validation_notes.length > 0 && (
                    <ul style={{ margin: '0 0 15px 0', paddingLeft: '20px', color: 'var(--fmc-slate)', fontSize: '13px' }}>
                      {td.validation_notes.map((note, i) => <li key={i}>{note}</li>)}
                    </ul>
                  )}
                </>
              )}
              {ci && (Array.isArray(ci.class_distribution) && ci.class_distribution.length > 0 ? (() => {
                // N-class distribution table — one column per class, driven by class_distribution
                // rather than assuming exactly two (minority/majority). Array shape only: some
                // existing cards send class_distribution as a legacy {label: count} dict, which
                // falls through to the branch below unchanged.
                const classes = ci.class_distribution!;
                const trainDist = ci.train_distribution ?? {};
                const valDist = ci.val_distribution ?? {};
                let totalTrain = 0, totalVal = 0, totalAll = 0;
                const pctKnown = classes.every(c => c.pct != null);
                const minC = pctKnown ? classes.reduce((a, b) => (b.pct! < a.pct! ? b : a)) : null;
                const maxC = pctKnown ? classes.reduce((a, b) => (b.pct! > a.pct! ? b : a)) : null;
                return (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '150px' }}></th>
                          {classes.map(c => (
                            <th key={c.label} style={{ textAlign: 'right' }}>{c.display_name ? `${c.label} — ${c.display_name}` : c.label}</th>
                          ))}
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Train</strong></td>
                          {classes.map(c => {
                            const v = trainDist[c.label] || 0;
                            totalTrain += v;
                            return <td key={c.label} style={{ textAlign: 'right' }}>{v.toLocaleString()}</td>;
                          })}
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalTrain.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td><strong>Validation</strong></td>
                          {classes.map(c => {
                            const v = valDist[c.label] || 0;
                            totalVal += v;
                            return <td key={c.label} style={{ textAlign: 'right' }}>{v.toLocaleString()}</td>;
                          })}
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalVal.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td style={{ borderTop: '2px solid var(--fmc-ink)' }}><strong>Total</strong></td>
                          {classes.map(c => {
                            const v = c.count != null ? c.count : (trainDist[c.label] || 0) + (valDist[c.label] || 0);
                            totalAll += v;
                            return <td key={c.label} style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid var(--fmc-ink)' }}>{v.toLocaleString()}</td>;
                          })}
                          <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid var(--fmc-ink)' }}>{totalAll.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                    {minC && maxC && (
                      <div style={{ marginTop: '15px', color: 'var(--fmc-slate)', fontSize: '13px' }}>
                        Class balance: <strong>{minC.label}</strong> is {minC.pct!.toFixed(1)}% of data, <strong>{maxC.label}</strong> is {maxC.pct!.toFixed(1)}%
                      </div>
                    )}
                  </>
                );
              })() : (ci.class_distribution || ci.train_distribution) ? (() => {
                // Legacy binary distribution table (also covers the legacy dict-shaped class_distribution).
                const minClass = ci.minority_class || '1';
                const majClass = ci.majority_class || '0';
                const train0 = ci.train_distribution?.[majClass] ?? ci.train_distribution?.['0'] ?? 0;
                const train1 = ci.train_distribution?.[minClass] ?? ci.train_distribution?.['1'] ?? 0;
                const val0 = ci.val_distribution?.[majClass] ?? ci.val_distribution?.['0'] ?? 0;
                const val1 = ci.val_distribution?.[minClass] ?? ci.val_distribution?.['1'] ?? 0;
                const totalTrain = train0 + train1;
                const totalVal = val0 + val1;
                const minorityCount = ci.minority_class_count ?? (train1 + val1);
                const majorityCount = ci.majority_class_count ?? (train0 + val0);
                const totalSamples = ci.total_samples || (totalTrain + totalVal);
                return (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '150px' }}></th>
                          <th style={{ textAlign: 'right' }}>Class "{minClass}"</th>
                          <th style={{ textAlign: 'right' }}>Class "{majClass}"</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Train</strong></td>
                          <td style={{ textAlign: 'right' }}>{train1.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{train0.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalTrain.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td><strong>Validation</strong></td>
                          <td style={{ textAlign: 'right' }}>{val1.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{val0.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalVal.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td style={{ borderTop: '2px solid var(--fmc-ink)' }}><strong>Total</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid var(--fmc-ink)' }}>{minorityCount.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid var(--fmc-ink)' }}>{majorityCount.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid var(--fmc-ink)' }}>{totalSamples.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ marginTop: '15px', color: 'var(--fmc-slate)', fontSize: '13px' }}>
                      Imbalance ratio: <strong>{ci.imbalance_ratio ?? 'N/A'}:1</strong> (minority class is {totalSamples ? ((minorityCount / totalSamples) * 100).toFixed(1) : '0.0'}% of data)
                    </div>
                  </>
                );
              })() : null)}
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
                  <tr style={{ borderBottom: '2px solid var(--fmc-ink)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: '110px' }}>Severity</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: '140px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Message</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', width: '180px' }}>Affected</th>
                  </tr>
                </thead>
                <tbody>
                  {dpn.map((note, i) => {
                    const sev = (note.severity || 'info').toLowerCase();
                    const severityColor: Record<string, string> = { info: 'var(--fmc-brass)', warning: 'var(--fmc-warn)', critical: 'var(--fmc-bad)' };
                    const severityBg: Record<string, string> = { info: 'var(--fmc-brass-bg)', warning: 'var(--fmc-warn-bg)', critical: 'var(--fmc-bad-bg)' };
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
                      <tr key={i} style={{ borderBottom: '1px solid var(--fmc-line-soft)', background: severityBg[sev] || 'var(--fmc-mist-2)' }}>
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          <span style={{
                            background: severityColor[sev] || 'var(--fmc-slate)', color: '#fff',
                            fontFamily: 'var(--fmc-mono)', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px',
                            borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.03em',
                          }}>{sev}</span>
                        </td>
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', color: 'var(--fmc-ink-soft)', fontSize: '12px' }}>
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
