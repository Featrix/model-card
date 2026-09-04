/**
 * Featrix Model Card Renderer - Standalone JavaScript
 * 
 * Usage:
 *   <script src="model-card.js"></script>
 *   <script>
 *     const html = FeatrixModelCard.renderHTML(modelCardJson);
 *     document.getElementById('container').innerHTML = html;
 *   </script>
 */

(function(global) {
  'use strict';

  // Shared metric-key -> display-name lookup, used by the MODEL IDENTIFICATION hero cards
  // and the MODEL DETAILS epoch tabs so multiclass checkpoint metrics (macro_f1, log_loss, ...)
  // get the same human label wherever they show up.
  var EPOCH_METRIC_LABELS = {
    roc_auc: 'ROC-AUC', pr_auc: 'PR-AUC', macro_f1: 'Macro-F1', weighted_f1: 'Weighted-F1',
    macro_auc_ovr: 'Macro-AUC (OvR)', log_loss: 'Log-Loss', cross_entropy: 'Cross-Entropy',
    accuracy: 'Accuracy', f1: 'F1', r2: 'R²'
  };
  function formatMetricName(key) {
    if (!key) return '';
    return EPOCH_METRIC_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }

  // Epoch -1 is not a bug: it's the SP's "do-no-harm" floor marker — training
  // never beat the warm-start baseline, so the served checkpoint IS the
  // pre-training warm-start state, not any fine-tuned epoch. A bare "-1"
  // reads as broken; spell out what it actually means everywhere an epoch
  // number would otherwise print it.
  function formatEpochNum(epoch) {
    if (epoch === -1) return 'Warm Start (pre-training)';
    if (epoch === null || epoch === undefined) return 'N/A';
    return String(epoch);
  }
  function formatEpochPhrase(epoch) {
    return epoch === -1 ? 'Warm Start (pre-training)' : 'Epoch ' + formatEpochNum(epoch);
  }

  // A short, always-visible summary rendered into a section's <summary> tag
  // (via the '<!--HL-->' marker each section's opening <details> carries) so
  // collapsing a section doesn't hide everything about it -- just the detail.
  // CSS hides it again once the section is expanded, where the real content
  // says the same thing at greater length.
  function highlightSpan(text) {
    return text ? '<span class="fmc-summary-highlights">' + text + '</span>' : '';
  }

  // Shared by the main confusion matrix (Model Details) and the declined-rows breakdown
  // (Selective Prediction) — one N×N heatmap component, reused wherever actual-vs-predicted
  // (or would-have-predicted) class counts need showing.
  function renderMatrixGrid(labels, matrix) {
    var n = labels.length;
    var maxDiag = 0, maxOffDiag = 0;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        var v = (matrix[i] && matrix[i][j]) || 0;
        if (i === j) { if (v > maxDiag) maxDiag = v; }
        else if (v > maxOffDiag) { maxOffDiag = v; }
      }
    }
    var cell = n <= 4 ? 56 : (n <= 6 ? 46 : 36);
    var rowHeadW = 42;
    var cmLabel = 'font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate);';

    var html = '<div class="cm-block" style="display: flex;">';
    html += '<div style="width: 16px; display: flex; align-items: center; justify-content: center; writing-mode: vertical-lr; transform: rotate(180deg); ' + cmLabel + '">Actual</div>';
    html += '<div>';
    html += '<div style="text-align: center; margin-left: ' + rowHeadW + 'px; margin-bottom: 4px; ' + cmLabel + '">Predicted</div>';
    html += '<div style="display: flex; margin-left: ' + rowHeadW + 'px; margin-bottom: 3px;">';
    for (var j0 = 0; j0 < n; j0++) {
      html += '<div style="width: ' + cell + 'px; text-align: center; font-weight: 600; ' + cmLabel + '">' + labels[j0] + '</div>';
    }
    html += '</div>';

    for (var i1 = 0; i1 < n; i1++) {
      html += '<div style="display: flex; align-items: center; margin-bottom: 1px;">';
      html += '<div style="width: ' + rowHeadW + 'px; text-align: right; padding-right: 6px; font-weight: 600; ' + cmLabel + '">' + labels[i1] + '</div>';
      for (var j1 = 0; j1 < n; j1++) {
        var val = (matrix[i1] && matrix[i1][j1]) || 0;
        var cellStyle;
        if (i1 === j1) {
          var alpha = maxDiag > 0 ? Math.min(0.86, 0.30 + 0.56 * (val / maxDiag)) : 0.3;
          var textColor = alpha >= 0.45 ? '#fff' : 'var(--fmc-good)';
          cellStyle = 'background: rgba(31,138,76,' + alpha.toFixed(2) + '); color: ' + textColor + ';';
        } else {
          var oAlpha = (val === 0 || maxOffDiag === 0) ? 0 : Math.min(0.5, 0.06 + 0.44 * (val / maxOffDiag));
          cellStyle = 'background: rgba(178,58,50,' + oAlpha.toFixed(2) + '); color: var(--fmc-bad);';
        }
        html += '<div class="cm-cell" style="width: ' + cell + 'px; height: ' + cell + 'px; display: flex; align-items: center; justify-content: center; ' + cellStyle + '">' + val + '</div>';
      }
      html += '</div>';
    }
    html += '</div>'; // inner column
    html += '</div>'; // cm-block
    return html;
  }

  const FeatrixModelCard = {
    VERSION: '1.17.5',
    BUILD: 'dev',

    /**
     * Format a value for display
     */
    formatValue: function(value, precision) {
      precision = precision || 4;
      if (value === null || value === undefined) {
        return '<em>N/A</em>';
      }
      if (typeof value === 'number') {
        var formatted = value.toFixed(precision).replace(/\.?0+$/, '');
        return formatted;
      }
      if (typeof value === 'boolean') {
        return String(value);
      }
      if (Array.isArray(value) || typeof value === 'object') {
        return '<pre>' + JSON.stringify(value, null, 2) + '</pre>';
      }
      return String(value);
    },

    /**
     * Format a percentage value
     */
    formatPercentage: function(value) {
      if (value === null || value === undefined) {
        return '<em>N/A</em>';
      }
      return value.toFixed(4);
    },

    /**
     * Get color for status
     */
    getStatusColor: function(status) {
      var statusLower = (status || '').toLowerCase();
      if (statusLower === 'done' || statusLower === 'ready') return 'var(--fmc-good)';
      if (statusLower === 'training') return 'var(--fmc-warn)';
      if (statusLower === 'failed') return 'var(--fmc-bad)';
      return 'var(--fmc-slate)';
    },

    /**
     * Get color for quality assessment
     */
    getQualityColor: function(assessment) {
      if (!assessment) return 'var(--fmc-slate)';
      var assessmentLower = assessment.toLowerCase();
      if (assessmentLower === 'excellent') return 'var(--fmc-good)';
      if (assessmentLower === 'good') return 'var(--fmc-brass)';
      if (assessmentLower === 'fair') return 'var(--fmc-warn)';
      if (assessmentLower === 'poor' || assessmentLower === 'bad') return 'var(--fmc-bad)';
      return 'var(--fmc-slate)';
    },

    getQualityStyle: function(assessment) {
      return 'background-color: ' + this.getQualityColor(assessment) + ';';
    },

    /**
     * Get color for warning severity
     */
    getSeverityColor: function(severity) {
      var severityLower = (severity || '').toLowerCase();
      if (severityLower === 'high') return 'var(--fmc-bad)';
      if (severityLower === 'moderate') return 'var(--fmc-warn)';
      if (severityLower === 'low') return 'var(--fmc-slate)';
      return 'var(--fmc-slate)';
    },

    /**
     * Detect training phase: 'es', 'sp', or null (done/unknown)
     */
    getTrainingPhase: function(data) {
      var mi = data.model_identification || {};
      // Use explicit field if backend provides it
      if (mi.training_phase) return mi.training_phase.toLowerCase();
      // Infer from model_type
      var mt = (mi.model_type || '').toLowerCase();
      if (mt === 'foundation' || mt === 'embedding space' || mt === 'es') return 'es';
      if (mt.indexOf('predictor') !== -1 || mt.indexOf('tbd') !== -1 || mt === 'sp' || mt === 'single predictor') return 'sp';
      return null;
    },

    /**
     * Is the model currently training?
     */
    isTraining: function(data) {
      return ((data.model_identification || {}).status || '').toLowerCase() === 'training';
    },

    /**
     * Parse model path to extract session ID and job ID
     */
    parseModelPath: function(path) {
      if (!path) return { sessionId: null, jobId: null };

      // Path format: /sphere/app/featrix_output/predictor-xxx-UUID/train_single_predictor_UUID/file.pickle
      var parts = path.split('/');
      var sessionId = null;
      var jobId = null;

      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        // Session folder: predictor-xxx-UUID, chop the UUID (last 36 chars + dash)
        if (part.indexOf('predictor-') === 0) {
          // UUID is 36 chars, plus the dash before it = 37 chars to remove
          if (part.length > 37) {
            sessionId = part.substring(0, part.length - 37);
          } else {
            sessionId = part;
          }
        }
        // Job folder: train_single_predictor_UUID
        if (part.indexOf('train_single_predictor_') === 0 || part.indexOf('train_') === 0) {
          jobId = part;
        }
      }

      return { sessionId: sessionId, jobId: jobId };
    },

    /**
     * Render model identification section
     */
    renderModelIdentification: function(data, sphereSessionId) {
      var mi = data.model_identification || {};
      var statusColor = this.getStatusColor(mi.status);

      // Try to get model ID from disk_usage.best_model_path first
      var du = data.disk_usage || {};
      var parsed = this.parseModelPath(du.best_model_path);
      var modelIdDisplay = parsed.sessionId || (mi.session_id ? mi.session_id.substring(0, 20) : null) || (mi.model_id ? String(mi.model_id).substring(0, 20) : null) || 'N/A';
      var jobIdDisplay = parsed.jobId || 'N/A';

      // Get best epoch metrics
      var be = data.best_epochs || {};
      var ci = data.class_imbalance || {};
      var bestRocAuc = null;
      var bestPrAuc = null;
      var prAucLift = null;
      if (be.best_roc_auc && be.best_roc_auc.classification_display_metadata) {
        var rocMetrics = be.best_roc_auc.classification_display_metadata.classification_metrics || {};
        bestRocAuc = rocMetrics.auc ? rocMetrics.auc.value : null;
      }
      if (be.best_pr_auc && be.best_pr_auc.classification_display_metadata) {
        var prMetrics = be.best_pr_auc.classification_display_metadata.classification_metrics || {};
        bestPrAuc = prMetrics.pr_auc ? prMetrics.pr_auc.value : null;
      }
      // Calculate PR-AUC lift over random baseline (prevalence)
      // Random baseline = minority_class_count / total_samples
      var prevalence = null;
      if (ci.minority_class_count && ci.total_samples) {
        prevalence = ci.minority_class_count / ci.total_samples;
      }
      if (bestPrAuc !== null && prevalence !== null) {
        prAucLift = bestPrAuc / prevalence;
      }

      // Regression hero metrics (scalar targets) — best_r2 replaces ROC/PR-AUC entirely,
      // those are classification-only and are always N/A for a regression target.
      var bestR2 = null;
      var bestRmse = null;
      var bestNrmse = null;
      var r2Skill = null;
      if (be.best_r2 && be.best_r2.regression_display_metadata) {
        var regMetrics = be.best_r2.regression_display_metadata.regression_metrics || {};
        bestR2 = regMetrics.r2 ? regMetrics.r2.value : null;
        bestRmse = regMetrics.rmse ? regMetrics.rmse.value : null;
        bestNrmse = regMetrics.nrmse ? regMetrics.nrmse.value : null;
        r2Skill = be.best_r2.regression_display_metadata.skill || null;
      }
      var isRegression = bestR2 !== null || bestRmse !== null;

      // Multiclass hero metrics. num_classes/class_labels (once the backend emits them) is
      // the authoritative multiclass signal — a multiclass target still gets a real "auc"
      // (macro one-vs-rest), so "both roc_auc and pr_auc are null" is NOT a reliable test by
      // itself; it's only the fallback for old cards that predate num_classes. Whatever
      // best_epochs entry is available (best_roc_auc included — its classification_metrics
      // carries accuracy/macro_f1 too, not just auc) is fair game as the metrics source.
      var numClasses = mi.num_classes || (Array.isArray(mi.class_labels) ? mi.class_labels.length : null);
      var mcAccuracy = null;
      var mcHeadlineKey = null;
      var mcHeadlineVal = null;
      var isMulticlass = false;
      var wantMulticlass = !isRegression && (numClasses !== null ? numClasses > 2 : (bestRocAuc === null && bestPrAuc === null));
      if (wantMulticlass) {
        var MC_HEADLINE_PREFERENCE = ['macro_f1', 'weighted_f1', 'cross_entropy', 'log_loss', 'macro_auc_ovr'];
        var checkpointMetricMc = (data.training_optimization && data.training_optimization.checkpoint_metric) || null;
        var mcEpochKey = (checkpointMetricMc && be['best_' + checkpointMetricMc]) ? 'best_' + checkpointMetricMc : null;
        if (!mcEpochKey) {
          mcEpochKey = Object.keys(be).filter(function(k) {
            return k.charAt(0) !== '_' && k !== 'best_r2' && be[k];
          })[0] || null;
        }
        if (mcEpochKey && be[mcEpochKey].classification_display_metadata) {
          var mcMetrics = be[mcEpochKey].classification_display_metadata.classification_metrics || {};
          mcAccuracy = mcMetrics.accuracy ? mcMetrics.accuracy.value : null;
          if (checkpointMetricMc && mcMetrics[checkpointMetricMc] && checkpointMetricMc !== 'accuracy') {
            mcHeadlineKey = checkpointMetricMc;
          } else {
            for (var hk = 0; hk < MC_HEADLINE_PREFERENCE.length; hk++) {
              if (mcMetrics[MC_HEADLINE_PREFERENCE[hk]]) { mcHeadlineKey = MC_HEADLINE_PREFERENCE[hk]; break; }
            }
          }
          mcHeadlineVal = mcHeadlineKey && mcMetrics[mcHeadlineKey] ? mcMetrics[mcHeadlineKey].value : null;
          isMulticlass = mcAccuracy !== null || mcHeadlineVal !== null;
        }
      }

      // Map model type to display format. Keyed off target_column_type (authoritative —
      // present whenever there's a target, regardless of exact model_type wording), not on
      // model_type matching a literal "Single Predictor"/"SP" string: production cards say
      // things like "Foundation + Neural Predictor" / "Foundation + Nearest-Neighbor
      // Predictor", which used to fall straight through to the raw-string fallback below and
      // lose the task-type classification entirely. Covers every real target_col_type, not
      // just set/scalar — see targets/registry.py CANONICAL_INPUT_TYPES.
      var TASK_LABELS_BY_TARGET_TYPE = {
        scalar: 'Regression',
        ordinal: 'Ordinal Classifier',
        multi_label: 'Multi-Label Classifier',
        ranking: 'Ranking Model',
        free_string: 'Free-Text Predictor'
      };
      var modelTypeDisplay = 'N/A';
      if (mi.model_type) {
        var modelTypeLower = mi.model_type.toLowerCase();
        var targetTypeLower = (mi.target_column_type || '').toLowerCase();

        if (!targetTypeLower && (modelTypeLower === 'embedding space' || modelTypeLower === 'es' || modelTypeLower === 'foundation')) {
          modelTypeDisplay = 'Foundational Embedding Space';
        } else if (targetTypeLower === 'set' || TASK_LABELS_BY_TARGET_TYPE[targetTypeLower]) {
          // Which predictor head was actually selected (Neural/Linear/XGBoost/Nearest-
          // Neighbor/...) is real, useful info — surface it alongside the task type, not
          // instead of it. Extract "everything after Foundation + " rather than matching a
          // hardcoded list of kind names, so a new predictor kind on the backend doesn't
          // need a matching renderer update to show up correctly.
          var predictorKindMatch = mi.model_type.match(/^Foundation\s*\+\s*(.+)/i);
          var predictorKind = predictorKindMatch ? predictorKindMatch[1].trim() : null;
          var taskLabel;
          if (targetTypeLower === 'set') {
            // 'set' covers both binary and multiclass targets — numClasses (hoisted above,
            // from num_classes/class_labels) decides which; falls back to whether the
            // best_epochs data itself looks multiclass when numClasses is unknown.
            var modelTypeIsMulticlass = numClasses !== null ? numClasses > 2 : isMulticlass;
            taskLabel = modelTypeIsMulticlass ? 'Multiclass Classifier' : 'Binary Classifier';
          } else {
            taskLabel = TASK_LABELS_BY_TARGET_TYPE[targetTypeLower];
          }
          modelTypeDisplay = predictorKind ? (predictorKind + ' • ' + taskLabel) : taskLabel;
        } else {
          modelTypeDisplay = mi.model_type;
        }
      }

      // Format framework - strip "unknown" suffix
      var frameworkDisplay = mi.framework || 'N/A';
      frameworkDisplay = frameworkDisplay.replace(/\s+unknown$/i, '').trim() || 'N/A';

      // Phase-aware rendering
      var training = this.isTraining(data);
      var phase = this.getTrainingPhase(data);
      var hideAucCards = training && phase === 'es';

      // ES-phase hero data: an Embedding Space card has no target/classification metrics at
      // all, so without this the hero row fell through to the classification branch below and
      // showed a permanent "Target Column: N/A, Best ROC-AUC: N/A" even for a finished ES.
      var maEs = data.model_architecture || {};
      var esEs = data.embedding_space || {};
      var tdEs = data.training_dataset || {};
      var dModel = esEs.d_model || maEs.d_model || (data.training_configuration && data.training_configuration.d_model) || null;
      var numColsEs = esEs.num_columns || tdEs.total_features || null;
      var rmh = data.ranking_metrics_history;
      var bestRankAuc = null;
      var bestRecallAt1 = null;
      if (rmh && rmh.entries && rmh.entries.length > 0) {
        rmh.entries.forEach(function(e) {
          if (e.val_auc != null && (bestRankAuc === null || e.val_auc > bestRankAuc)) bestRankAuc = e.val_auc;
          if (e.val_recall_at_1 != null && (bestRecallAt1 === null || e.val_recall_at_1 > bestRecallAt1)) bestRecallAt1 = e.val_recall_at_1;
        });
      }

      // Phase indicator
      var phaseIndicator = '';
      if (training && phase) {
        var phaseDesc = phase === 'es' ? 'Phase 1/2: Training Foundation Model' : 'Phase 2/2: Training Predictor';
        phaseIndicator = '<div style="margin-bottom: 15px; padding: 8px 14px; background: var(--fmc-warn-bg); border-left: 3px solid var(--fmc-warn); border-radius: 0 4px 4px 0; font-size: 13px; color: var(--fmc-warn);">' + phaseDesc + '</div>';
      }

      // User intent callout
      var userIntentHtml = '';
      if (mi.user_intent) {
        var ui = mi.user_intent;
        var objectiveDisplay = (ui.objective || '').replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var sourceDisplay = ui.source ? ui.source.replace(/_/g, ' ') : '';
        userIntentHtml = '<div style="margin-bottom:15px;padding:12px 16px;background:var(--fmc-brass-bg);border-left:3px solid var(--fmc-brass);border-radius:0 4px 4px 0;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">' +
          '<span style="font-family:var(--fmc-mono);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--fmc-brass);font-weight:bold;white-space:nowrap;">Objective</span>' +
          '<span style="font-size:18px;font-weight:bold;color:var(--fmc-brass-strong);">' + objectiveDisplay + '</span>' +
          '<span style="font-size:12px;color:var(--fmc-brass);">' + (ui.task || '') + '</span>' +
          (sourceDisplay ? '<span style="font-family:var(--fmc-mono);font-size:11px;color:var(--fmc-brass);margin-left:auto;">' + sourceDisplay + '</span>' : '') +
          '</div>';
      }

      // Epoch progress indicator (only during training)
      var epochProgress = '';
      if (training) {
        var tc = data.training_configuration || {};
        var currentEpoch = tc.current_epoch || tc.best_epoch || null;
        var plannedEpochs = tc.planned_epochs || null;
        if (currentEpoch !== null) {
          var epochText = 'Epoch ' + currentEpoch;
          var barHtml = '';
          if (plannedEpochs) {
            var pct = Math.min(100, Math.round((currentEpoch / plannedEpochs) * 100));
            epochText += ' / ' + plannedEpochs;
            barHtml = '<div style="display: inline-block; width: 120px; height: 8px; background: var(--fmc-line); border-radius: 4px; vertical-align: middle; margin-left: 10px;">' +
                      '<div style="width: ' + pct + '%; height: 100%; background: var(--fmc-warn); border-radius: 4px;"></div></div>' +
                      ' <span style="font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate);">' + pct + '%</span>';
          }
          epochProgress = '<div style="margin-top: 10px; font-size: 13px; color: var(--fmc-ink-soft);"><strong>' + epochText + '</strong>' + barHtml + '</div>';
        }
      }

      // Hero cards (hidden during ES training): architecture + ranking-quality cards for
      // Embedding Space cards, R²/RMSE for regression targets, Accuracy/[checkpoint metric]
      // for multiclass targets, ROC-AUC/PR-AUC for binary classification targets.
      var aucCards = '';
      if (!hideAucCards && phase === 'es') {
        var rankQualityColor = bestRankAuc !== null ? (bestRankAuc >= 0.999 ? 'var(--fmc-good)' : bestRankAuc >= 0.99 ? 'var(--fmc-warn)' : 'var(--fmc-bad)') : 'var(--fmc-slate)';
        aucCards = `
                <div class="metric">
                    <div class="metric-label">Ports (input columns)</div>
                    <div class="metric-value" style="font-size: 28px;">${numColsEs !== null ? numColsEs.toLocaleString() : 'N/A'}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Dimensions</div>
                    <div class="metric-value" style="font-size: 28px;">${dModel !== null ? dModel : 'N/A'}</div>
                </div>
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);" title="Contrastive ranking AUC — how well the model distinguishes similar from dissimilar records">
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best Ranking AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: ${rankQualityColor};">${bestRankAuc !== null ? (bestRankAuc * 100).toFixed(2) + '%' : 'N/A'}</div>
                </div>
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);" title="Recall@1 — fraction of queries where the top-1 nearest neighbor is the correct match">
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best Recall@1</div>
                    <div class="metric-value" style="font-size: 28px; color: ${rankQualityColor};">${bestRecallAt1 !== null ? (bestRecallAt1 * 100).toFixed(1) + '%' : 'N/A'}</div>
                </div>`;
      } else if (!hideAucCards && isRegression) {
        aucCards = `
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);">
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best R²</div>
                    <div class="metric-value" style="font-size: 28px; color: var(--fmc-brass-strong);">${bestR2 !== null ? bestR2.toFixed(4) : 'N/A'}</div>
                </div>
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);"${bestNrmse !== null ? ' title="NRMSE (RMSE / target σ): ' + bestNrmse.toFixed(3) + '"' : ''}>
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best RMSE</div>
                    <div class="metric-value" style="font-size: 28px; color: var(--fmc-brass-strong);">${bestRmse !== null ? bestRmse.toFixed(4) : 'N/A'}</div>
                </div>`;
      } else if (!hideAucCards && isMulticlass) {
        aucCards = `
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);">
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best Accuracy</div>
                    <div class="metric-value" style="font-size: 28px; color: var(--fmc-brass-strong);">${mcAccuracy !== null ? (mcAccuracy * 100).toFixed(2) + '%' : 'N/A'}</div>
                </div>
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);">
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best ${formatMetricName(mcHeadlineKey)}</div>
                    <div class="metric-value" style="font-size: 28px; color: var(--fmc-brass-strong);">${mcHeadlineVal !== null ? mcHeadlineVal.toFixed(4) : 'N/A'}</div>
                </div>`;
      } else if (!hideAucCards) {
        aucCards = `
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);">
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best ROC-AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: var(--fmc-brass-strong);">${bestRocAuc !== null ? bestRocAuc.toFixed(4) : 'N/A'}</div>
                </div>
                <div class="metric" style="background: var(--fmc-brass-bg); border-color: var(--fmc-brass-border);"${prevalence !== null ? ' title="Random baseline: ' + (prevalence * 100).toFixed(1) + '% (class prevalence)"' : ''}>
                    <div class="metric-label" style="color: var(--fmc-brass-strong);">Best PR-AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: var(--fmc-brass-strong);">${bestPrAuc !== null ? bestPrAuc.toFixed(4) : 'N/A'}${prAucLift !== null ? ' <span style="font-size: 14px; font-weight: normal;">[' + prAucLift.toFixed(1) + 'x]</span>' : ''}</div>
                </div>`;
      }

      // Skill verdict: "Beats raw-XGBoost", "Ties raw-XGBoost", etc. — the headline
      // baseline-relative read on whether this regression model is actually good.
      var skillBadgeHtml = '';
      if (isRegression && r2Skill && r2Skill.text) {
        var skillColor = r2Skill.tier === 'beats_xgb' ? 'var(--fmc-good)' :
          (r2Skill.tier === 'ties_xgb' || r2Skill.tier === 'beats_lr') ? 'var(--fmc-brass-strong)' :
          (r2Skill.tier === 'no_skill' || r2Skill.tier === 'below_baselines') ? 'var(--fmc-bad)' : 'var(--fmc-slate)';
        skillBadgeHtml = '<div style="margin-top: 12px; font-size: 13px; font-weight: 600; color: ' + skillColor + ';">' + r2Skill.text + '</div>';
      }

      return `
    <details class="section" open>
        <summary>MODEL IDENTIFICATION</summary>
        <div class="section-content">
            ${phaseIndicator}
            ${userIntentHtml}
            <div class="grid"${hideAucCards ? ' style="grid-template-columns: repeat(2, 1fr);"' : ''}>
                <div class="metric">
                    <div class="metric-label">Target Column</div>
                    <div class="metric-value" style="font-size: 20px;">${mi.target_column || 'N/A'}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Model Type</div>
                    <div class="metric-value" style="font-size: 20px;">${modelTypeDisplay}</div>
                </div>
                ${aucCards}
            </div>
            ${skillBadgeHtml}
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--fmc-line); font-family: var(--fmc-mono); font-size: 12px; color: var(--fmc-slate); line-height: 2;">
                <span class="status-badge${(mi.status || '').toLowerCase() === 'training' ? ' training' : ''}" style="background-color: ${statusColor}; font-size: 11px; padding: 2px 8px;">${((mi.status || 'N/A').toLowerCase() === 'done' ? 'READY' : (mi.status || 'N/A').toUpperCase())}</span>
                &nbsp;&nbsp;${mi.training_date || 'N/A'}
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Model:</strong> <code style="font-size: 11px;">${modelIdDisplay}</code>
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Cluster:</strong> ${(mi.compute_cluster || 'N/A').toUpperCase()}
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Dims:</strong> ${dModel || 'N/A'}
                ${mi.encoding_intent ? '&nbsp;&nbsp;•&nbsp;&nbsp;<strong>Encoding:</strong> ' + mi.encoding_intent : ''}
                ${epochProgress}
            </div>${sphereSessionId ? `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--fmc-line);">
                <div class="sphere-thumbnail" data-session-id="${sphereSessionId}" title="Click to expand">
                    <div class="sphere-thumbnail-inner" id="featrix-sphere-thumb"></div>
                    <div class="sphere-thumbnail-label">Embedding Space</div>
                </div>
            </div>` : ''}
        </div>
    </details>
      `;
    },

    /**
     * Render model fit section
     */
    renderModelFit: function(data) {
      var mf = data.model_fit;
      if (!mf) return '';

      var INTENT_LABELS = {
        'balanced': 'Balanced',
        'only_alert_when_confident': 'Only alert when confident',
        'catch_everything': 'Catch everything',
        'catch_everything_aggressive': 'Catch everything (aggressive)',
        'minimize_cost': 'Minimize cost',
        'rank': 'Ranking',
        'predict_probabilities': 'Calibrated probabilities'
      };

      function scoreColor(s) {
        return s >= 0.80 ? 'var(--fmc-good)' : s >= 0.50 ? 'var(--fmc-warn)' : 'var(--fmc-slate)';
      }

      function scoreBar(score) {
        var color = scoreColor(score);
        var pct = Math.round(score * 100);
        return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">' +
          '<div style="flex:1;max-width:200px;background:var(--fmc-line);height:8px;border-radius:4px;">' +
          '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;"></div></div>' +
          '<span style="font-size:12px;font-weight:bold;color:' + color + ';min-width:34px;">' + pct + '%</span>' +
          '</div>';
      }

      function renderShapeScoreList(scores) {
        if (!scores || scores.length === 0) return '';
        var top3 = scores.slice(0, 3);
        var rest = scores.slice(3);
        var html = '';
        top3.forEach(function(s) {
          html += '<div style="margin:8px 0;">' +
            '<div style="font-size:13px;color:var(--fmc-ink-soft);">' + s.label + '</div>' +
            scoreBar(s.score) + '</div>';
        });
        if (rest.length > 0) {
          html += '<details class="show-more" style="margin-top:6px;">' +
            '<summary>Show ' + rest.length + ' more</summary>';
          rest.forEach(function(s) {
            html += '<div style="margin:8px 0;">' +
              '<div style="font-size:13px;color:var(--fmc-slate);">' + s.label + '</div>' +
              scoreBar(s.score) + '</div>';
          });
          html += '</details>';
        }
        return html;
      }

      function renderTopFitDetail(tf) {
        if (!tf) return '';
        var html = '';
        if (tf.summary) {
          html += '<div style="font-size:13px;color:var(--fmc-ink-soft);margin:8px 0;">' + tf.summary + '</div>';
        }
        if (tf.good_fit && tf.good_fit.length > 0) {
          html += '<div style="font-size:12px;font-weight:bold;color:var(--fmc-good);margin:6px 0 3px 0;">Good for</div>';
          html += '<ul style="margin:0 0 8px 18px;padding:0;list-style:disc;">';
          tf.good_fit.forEach(function(g) {
            html += '<li style="font-size:12px;color:var(--fmc-ink-soft);margin:2px 0;">' + g + '</li>';
          });
          html += '</ul>';
        }
        if (tf.poor_fit && tf.poor_fit.length > 0) {
          html += '<div style="font-size:12px;font-weight:bold;color:var(--fmc-bad);margin:6px 0 3px 0;">Watch out</div>';
          html += '<ul style="margin:0 0 8px 18px;padding:0;list-style:disc;">';
          tf.poor_fit.forEach(function(p) {
            html += '<li style="font-size:12px;color:var(--fmc-slate);margin:2px 0;">' + p + '</li>';
          });
          html += '</ul>';
        }
        if (tf.target_framing) {
          html += '<div style="font-size:11px;color:var(--fmc-slate);margin-top:6px;font-style:italic;">Positive class framing: ' + tf.target_framing + '</div>';
        }
        return html;
      }

      var html = '<details class="section" open><summary>MODEL FIT<!--HL--></summary><div class="section-content">';

      // ── Primary block ──────────────────────────────────────────────────────
      var primary = mf.primary;
      if (primary && primary.top_fit) {
        var tf = primary.top_fit;
        var score = tf.score != null ? tf.score : 0;
        var color = scoreColor(score);
        var pct = Math.round(score * 100);
        var intentLabel = INTENT_LABELS[primary.intent || ''] || (primary.intent || '');

        if (score >= 0.50) {
          html += '<div style="padding:20px;background:var(--fmc-mist);border-left:4px solid ' + color + ';margin-bottom:20px;">' +
            '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px;">' +
            '<span style="font-size:20px;font-weight:bold;color:var(--fmc-ink);text-transform:uppercase;">' + tf.label + '</span>' +
            '<span style="font-size:16px;font-weight:bold;color:' + color + ';">' + pct + '%</span>' +
            '<span style="font-size:11px;color:var(--fmc-slate);">under ' + intentLabel + ' intent</span>' +
            '</div>' +
            renderTopFitDetail(tf);

          // Other shapes scored — pull from per_intent entry matching primary.intent
          var primaryEntry = null;
          (mf.per_intent || []).forEach(function(e) {
            if (e.intent === primary.intent) primaryEntry = e;
          });
          if (primaryEntry && primaryEntry.shape_scores && primaryEntry.shape_scores.length > 1) {
            html += '<details class="show-more" style="margin-top:14px;">' +
              '<summary>Other shapes scored</summary>' +
              '<div style="margin-top:8px;">' + renderShapeScoreList(primaryEntry.shape_scores.slice(1)) + '</div>' +
              '</details>';
          }
          html += '</div>';
        } else {
          // Low confidence — "no clear fit", show top 3
          var primaryEntry2 = null;
          (mf.per_intent || []).forEach(function(e) {
            if (e.intent === primary.intent) primaryEntry2 = e;
          });
          var topScores = primaryEntry2 && primaryEntry2.shape_scores ? primaryEntry2.shape_scores.slice(0, 3) : [tf];
          html += '<div style="padding:20px;background:var(--fmc-mist);border-left:4px solid var(--fmc-slate);margin-bottom:20px;">' +
            '<div style="font-size:16px;font-weight:bold;color:var(--fmc-ink-soft);margin-bottom:12px;">No single clear use-case fit</div>' +
            renderShapeScoreList(topScores) + '</div>';
        }
      }

      // ── Per-intent fits ────────────────────────────────────────────────────
      if (mf.per_intent && mf.per_intent.length > 0) {
        html += '<h3 class="epoch-title" style="margin-top:10px;">Per-intent fits</h3>';
        html += '<div style="border:1px solid var(--fmc-line);">';
        mf.per_intent.forEach(function(entry, i) {
          var tf2 = entry.top_fit || {};
          var s2 = tf2.score != null ? tf2.score : 0;
          var c2 = scoreColor(s2);
          var p2 = Math.round(s2 * 100);
          var iLabel = INTENT_LABELS[entry.intent || ''] || entry.intent || '—';
          var borderStyle = i < mf.per_intent.length - 1 ? 'border-bottom:1px solid var(--fmc-line);' : '';

          html += '<details style="margin:0;border:none;' + borderStyle + '">' +
            '<summary style="padding:12px 16px;cursor:pointer;background:var(--fmc-paper);display:flex;align-items:center;gap:10px;border:none;font-weight:normal;text-transform:none;font-size:13px;user-select:none;">' +
            '<span style="flex:1;color:var(--fmc-ink-soft);">' + iLabel + '</span>' +
            '<span style="color:var(--fmc-slate);font-size:13px;">' + (tf2.label || '—') + '</span>' +
            '<span style="font-size:12px;font-weight:bold;color:' + c2 + ';min-width:38px;text-align:right;">' + p2 + '%</span>' +
            '</summary>' +
            '<div style="padding:16px 20px;background:var(--fmc-mist);border-top:1px solid var(--fmc-line);">' +
            renderTopFitDetail(tf2) +
            (entry.shape_scores && entry.shape_scores.length > 0
              ? '<div style="margin-top:12px;"><div style="font-size:11px;text-transform:uppercase;color:var(--fmc-slate);font-weight:bold;margin-bottom:8px;">All shapes</div>' + renderShapeScoreList(entry.shape_scores) + '</div>'
              : '') +
            '</div></details>';
        });
        html += '</div>';
      }

      // ── Reference table ────────────────────────────────────────────────────
      if (mf.reference_table && mf.reference_table.length > 0) {
        html += '<details class="show-more" style="margin-top:20px;">' +
          '<summary>What do these shapes mean?</summary>' +
          '<div style="padding:16px 20px;">';
        mf.reference_table.forEach(function(shape, i) {
          if (i > 0) html += '<hr style="margin:16px 0;border:none;border-top:1px solid var(--fmc-line);">';
          html += '<div>' +
            '<div style="font-size:14px;font-weight:bold;color:var(--fmc-ink);margin-bottom:4px;">' + (shape.label || shape.id) + '</div>';
          if (shape.summary) {
            html += '<div style="font-size:13px;color:var(--fmc-ink-soft);margin-bottom:8px;">' + shape.summary + '</div>';
          }
          if (shape.good_fit && shape.good_fit.length > 0) {
            html += '<div style="font-size:12px;font-weight:bold;color:var(--fmc-good);margin-bottom:3px;">Good for</div>' +
              '<ul style="margin:0 0 8px 18px;padding:0;list-style:disc;">';
            shape.good_fit.forEach(function(g) {
              html += '<li style="font-size:12px;color:var(--fmc-ink-soft);margin:2px 0;">' + g + '</li>';
            });
            html += '</ul>';
          }
          if (shape.poor_fit && shape.poor_fit.length > 0) {
            html += '<div style="font-size:12px;font-weight:bold;color:var(--fmc-bad);margin-bottom:3px;">Watch out</div>' +
              '<ul style="margin:0 0 8px 18px;padding:0;list-style:disc;">';
            shape.poor_fit.forEach(function(p) {
              html += '<li style="font-size:12px;color:var(--fmc-slate);margin:2px 0;">' + p + '</li>';
            });
            html += '</ul>';
          }
          if (shape.criteria && shape.criteria.length > 0) {
            html += '<details class="show-more" style="margin-top:6px;">' +
              '<summary>Why this shape? (engineer view)</summary>' +
              '<table style="width:auto;margin-top:8px;font-size:11px;">' +
              '<tr><th>Metric</th><th>Op</th><th>Target</th><th>Tol</th><th>Weight</th></tr>';
            shape.criteria.forEach(function(c) {
              html += '<tr><td style="font-family:var(--fmc-mono);">' + (c.metric || '') + '</td>' +
                '<td>' + (c.op || '') + '</td><td>' + (c.target != null ? c.target : '') + '</td>' +
                '<td>' + (c.tol != null ? c.tol : '') + '</td><td>' + (c.weight != null ? c.weight : '') + '</td></tr>';
            });
            html += '</table></details>';
          }
          html += '</div>';
        });
        html += '</div></details>';
      }

      html += '</div></details>';
      var fitHL = (mf.primary && mf.primary.top_fit)
        ? (mf.primary.top_fit.label + ' • ' + Math.round((mf.primary.top_fit.score || 0) * 100) + '%')
        : '';
      html = html.replace('<!--HL-->', highlightSpan(fitHL));
      return html;
    },

    /**
     * Format large numbers (e.g., 346200000 -> "346.2M")
     */
    formatLargeNumber: function(value) {
      if (value === null || value === undefined) return 'N/A';
      if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
      if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
      if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
      return value.toLocaleString();
    },

    /**
     * Render model stack section
     */
    renderEmbeddingSpace: function(data) {
      var es = data.embedding_space || {};
      var sp = data.single_predictor || data.predictor || {};
      var ma = data.model_architecture || {};
      var ms = (data.model_stack && data.model_stack[0]) || {};
      var ci = data.class_imbalance || {};
      var td = data.training_dataset || {};
      var phase = this.getTrainingPhase(data);

      // Need at least embedding_space or model_architecture to render
      var hasEs = !!data.embedding_space;
      var hasMa = !!(ma.transformer_layers || ma.d_model || ma.attention_heads || ma.total_parameters);
      if (!hasEs && !hasMa) return '';

      var html = '<details class="section" open><summary>MODEL STACK<!--HL--></summary><div class="section-content">';

      if (phase === 'sp' && hasEs) {
        // SP card with full ES + predictor stack
        var spRows = ci.total_samples || ms.rows || sp.num_rows || 0;
        var spLayers = ms.layers || ma.predictor_layers || sp.num_layers || 0;
        var spParams = ms.parameters || ma.predictor_parameters || sp.num_parameters || 0;
        html += `
            <table>
                <tr>
                    <th style="width: 150px;"></th>
                    <th>Labeled?</th>
                    <th>Rows</th>
                    <th>Layers</th>
                    <th>Parameters</th>
                </tr>
                <tr>
                    <td style="font-weight: bold; white-space: nowrap;">Predictor</td>
                    <td style="color: var(--fmc-good); font-weight: bold; white-space: nowrap;">Yes</td>
                    <td style="font-size: 18px; font-weight: bold;">${spRows.toLocaleString()}</td>
                    <td style="font-size: 18px; font-weight: bold;">${spLayers ? this.formatLargeNumber(spLayers) : 'N/A'}</td>
                    <td style="font-size: 18px; font-weight: bold;">${spParams ? this.formatLargeNumber(spParams) : 'N/A'}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold; white-space: nowrap;">Foundation</td>
                    <td style="color: var(--fmc-slate); white-space: nowrap;">No</td>
                    <td style="font-size: 18px; font-weight: bold;">${(es.num_rows || 0).toLocaleString()}</td>
                    <td style="font-size: 18px; font-weight: bold;">${this.formatLargeNumber(es.num_layers)}</td>
                    <td style="font-size: 18px; font-weight: bold;">${this.formatLargeNumber(es.num_parameters)}</td>
                </tr>
            </table>
        `;
      } else {
        // Pure ES card — no predictor stacked on top, so a Predictor/Foundation table would
        // show a bogus "Predictor: Yes, 0 rows" row. Show architecture details instead.
        var dModelStack = es.d_model || ma.d_model || null;
        var numLayers = es.num_layers || ma.transformer_layers || null;
        var numParams = es.num_parameters || ma.total_parameters || null;
        var numRows = es.num_rows || td.total_rows || null;
        var numCols = es.num_columns || td.total_features || null;
        var attentionHeads = ma.attention_heads || null;
        var lossFunction = (data.technical_details && data.technical_details.loss_function) || ma.loss_function || null;
        var normalization = (data.technical_details && data.technical_details.normalization) || null;

        var cells = [
          numCols !== null    ? ['Ports (input columns)', numCols.toLocaleString()] : null,
          dModelStack !== null ? ['Dimensions', dModelStack.toLocaleString()] : null,
          numLayers !== null  ? ['Transformer layers', numLayers.toLocaleString()] : null,
          attentionHeads      ? ['Attention heads', attentionHeads.toLocaleString()] : null,
          numParams !== null  ? ['Parameters', this.formatLargeNumber(numParams)] : null,
          numRows !== null    ? ['Training rows', numRows.toLocaleString()] : null,
        ].filter(Boolean);

        html += '<div class="grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 20px;">';
        cells.forEach(function(c) {
          html += '<div class="metric"><div class="metric-label">' + c[0] + '</div>' +
            '<div class="metric-value" style="font-size: 24px;">' + c[1] + '</div></div>';
        });
        html += '</div>';

        // Technical details strip
        var techParts = [];
        if (lossFunction) techParts.push('<strong>Loss:</strong> ' + lossFunction);
        if (normalization) techParts.push('<strong>Normalization:</strong> ' + normalization);
        if (data.technical_details && data.technical_details.device) techParts.push('<strong>Device:</strong> ' + data.technical_details.device);
        if (data.technical_details && data.technical_details.pytorch_version) techParts.push('<strong>PyTorch:</strong> ' + data.technical_details.pytorch_version);
        if (techParts.length > 0) {
          html += '<div style="font-size: 12px; color: var(--fmc-slate); border-top: 1px solid var(--fmc-line); padding-top: 12px; line-height: 2;">' + techParts.join('&nbsp;&nbsp;•&nbsp;&nbsp;') + '</div>';
        }

        // Feature list (collapsed)
        var featureNames = (data.training_dataset && data.training_dataset.feature_names) || [];
        if (featureNames.length > 0) {
          html += '<details class="show-more" style="margin-top: 14px;">' +
            '<summary>Show ' + featureNames.length + ' input columns</summary>' +
            '<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">';
          featureNames.forEach(function(f) {
            html += '<span style="font-size: 11px; font-family: var(--fmc-mono); background: var(--fmc-mist-2); padding: 2px 7px; border-radius: 2px;">' + f + '</span>';
          });
          html += '</div></details>';
        }
      }

      html += '</div></details>';
      var stackHL = spRows
        ? (spRows.toLocaleString() + ' rows • ' + this.formatLargeNumber(spParams) + ' params')
        : (numRows ? (numRows.toLocaleString() + ' rows • ' + this.formatLargeNumber(numParams) + ' params') : '');
      html = html.replace('<!--HL-->', highlightSpan(stackHL));
      return html;
    },

    /**
     * Render ranking quality metrics for ES models
     * (ranking_metrics_history + test_set_monitoring)
     */
    renderRankingMetrics: function(data) {
      var rmh = data.ranking_metrics_history;
      var tsm = data.test_set_monitoring;
      if (!rmh && !tsm) return '';

      var entries = (rmh && rmh.entries) || [];
      var testEntries = (tsm && tsm.entries) || [];

      // Find best epoch
      var bestAuc = null, bestRecall = null, bestEpoch = null;
      entries.forEach(function(e) {
        if (bestAuc === null || e.val_auc > bestAuc) {
          bestAuc = e.val_auc; bestRecall = e.val_recall_at_1; bestEpoch = e.epoch;
        }
      });

      var html = '<details class="section" open><summary>EMBEDDING QUALITY<!--HL--></summary><div class="section-content">';

      // Hero metrics
      var aucColor = bestAuc !== null ? (bestAuc >= 0.999 ? 'var(--fmc-good)' : bestAuc >= 0.99 ? 'var(--fmc-warn)' : 'var(--fmc-bad)') : 'var(--fmc-slate)';
      html += '<div style="margin-bottom:20px;">' +
        '<p style="font-size:13px;color:var(--fmc-ink-soft);margin-bottom:14px;">These metrics measure how well the embedding space organises records — ' +
        'whether similar records land near each other. They are <em>not</em> classification metrics; ' +
        'they reflect the quality of the foundation for any predictor built on top.</p>' +
        '<div class="grid" style="grid-template-columns: repeat(4, 1fr);">';

      if (bestAuc !== null) {
        html += '<div class="metric" style="border-color:' + aucColor + ';">' +
          '<div class="metric-label">Best Val AUC <span style="font-weight:normal;text-transform:none;">(epoch ' + bestEpoch + ')</span></div>' +
          '<div class="metric-value" style="font-size:28px;color:' + aucColor + ';">' + (bestAuc * 100).toFixed(3) + '%</div>' +
          '</div>';
        html += '<div class="metric" style="border-color:' + aucColor + ';">' +
          '<div class="metric-label">Best Recall@1</div>' +
          '<div class="metric-value" style="font-size:28px;color:' + aucColor + ';">' + (bestRecall !== null ? (bestRecall * 100).toFixed(1) + '%' : 'N/A') + '</div>' +
          '</div>';
      }
      if (testEntries.length > 0) {
        var te = testEntries[testEntries.length - 1];
        var testColor = te.test_auc >= 0.999 ? 'var(--fmc-good)' : te.test_auc >= 0.99 ? 'var(--fmc-warn)' : 'var(--fmc-bad)';
        html += '<div class="metric" style="border-color:' + testColor + ';" title="Held-out test set — never used during training">' +
          '<div class="metric-label">Test AUC <span style="font-weight:normal;text-transform:none;">(epoch ' + te.epoch + ')</span></div>' +
          '<div class="metric-value" style="font-size:28px;color:' + testColor + ';">' + (te.test_auc * 100).toFixed(3) + '%</div>' +
          '</div>';
        if (te.test_recall_at_1 != null) {
          html += '<div class="metric" style="border-color:' + testColor + ';">' +
            '<div class="metric-label">Test Recall@1</div>' +
            '<div class="metric-value" style="font-size:28px;color:' + testColor + ';">' + (te.test_recall_at_1 * 100).toFixed(1) + '%</div>' +
            '</div>';
        }
      }
      html += '</div></div>';

      // Epoch history table (collapsed)
      if (entries.length > 0) {
        html += '<details class="show-more">' +
          '<summary>Training history (' + entries.length + ' epochs)</summary>' +
          '<table style="margin-top:10px;width:auto;">' +
          '<tr><th>Epoch</th><th style="text-align:right;">Val AUC</th><th style="text-align:right;">Recall@1</th></tr>';
        entries.forEach(function(e) {
          var isBest = e.epoch === bestEpoch;
          html += '<tr' + (isBest ? ' style="background:var(--fmc-mist-2);"' : '') + '>' +
            '<td>' + e.epoch + (isBest ? ' ★' : '') + '</td>' +
            '<td style="text-align:right;font-family:var(--fmc-mono);">' + (e.val_auc != null ? (e.val_auc * 100).toFixed(3) + '%' : '—') + '</td>' +
            '<td style="text-align:right;font-family:var(--fmc-mono);">' + (e.val_recall_at_1 != null ? (e.val_recall_at_1 * 100).toFixed(1) + '%' : '—') + '</td>' +
            '</tr>';
        });
        html += '</table></details>';
      }

      html += '</div></details>';
      var eqHL = bestAuc !== null ? ((bestAuc * 100).toFixed(2) + '% AUC (epoch ' + bestEpoch + ')') : '';
      html = html.replace('<!--HL-->', highlightSpan(eqHL));
      return html;
    },

    /**
     * Render probes table — predictors built on this embedding space
     * Populated via options.probes: [{name, target_column, auc, model_card_url, status}]
     */
    renderProbes: function(data, probes) {
      var phase = this.getTrainingPhase(data);
      if (phase !== 'es') return '';
      if (!probes || probes.length === 0) {
        return '<details class="section" open><summary>BUILT-IN PROBES</summary>' +
          '<div class="section-content" style="color:var(--fmc-slate);font-size:13px;">No probes registered for this embedding space.</div></details>';
      }
      var html = '<details class="section" open><summary>BUILT-IN PROBES' + highlightSpan(probes.length + ' probe' + (probes.length !== 1 ? 's' : '')) + '</summary><div class="section-content">' +
        '<p style="font-size:13px;color:var(--fmc-ink-soft);margin-bottom:14px;">Predictors trained on top of this embedding space. Each probe is a binary classifier targeting a specific column.</p>' +
        '<table><tr><th>Target column</th><th style="text-align:right;">ROC-AUC</th><th style="text-align:right;">PR-AUC</th><th>Status</th><th></th></tr>';
      probes.forEach(function(p) {
        var aucStr = p.auc != null ? (p.auc * 100).toFixed(2) + '%' : '—';
        var prStr = p.pr_auc != null ? (p.pr_auc * 100).toFixed(2) + '%' : '—';
        var statusColor = p.status === 'done' || p.status === 'ready' ? 'var(--fmc-good)' : p.status === 'training' ? 'var(--fmc-warn)' : 'var(--fmc-slate)';
        var linkHtml = p.model_card_url ? '<a href="' + p.model_card_url + '" style="font-size:12px;">View card →</a>' : '';
        html += '<tr>' +
          '<td style="font-family:var(--fmc-mono);">' + (p.target_column || p.name || '—') + '</td>' +
          '<td style="text-align:right;font-weight:bold;">' + aucStr + '</td>' +
          '<td style="text-align:right;">' + prStr + '</td>' +
          '<td><span style="background:' + statusColor + ';color:#fff;font-size:10px;padding:2px 7px;font-weight:bold;">' + (p.status || 'unknown').toUpperCase() + '</span></td>' +
          '<td>' + linkHtml + '</td>' +
          '</tr>';
      });
      html += '</table></div></details>';
      return html;
    },

    /**
     * Render training dataset section
     */
    renderTrainingDataset: function(data) {
      var td = data.training_dataset || {};
      var ci = data.class_imbalance || {};

      if (td.total_rows === undefined && !ci.class_distribution && !ci.train_distribution) return '';

      var tdHL = (td.total_rows !== undefined)
        ? (td.total_rows.toLocaleString() + ' rows' + (td.total_features !== undefined ? ' • ' + td.total_features + ' features' : ''))
        : '';

      var html = `
    <details class="section" open>
        <summary>TRAINING DATASET${highlightSpan(tdHL)}</summary>
        <div class="section-content">
      `;

      // Base row/feature counts -- always present (ES, SP, regression,
      // multiclass alike), unlike the class-imbalance breakdown below,
      // which only exists for classification SP cards. An Embedding Space
      // card has no class_imbalance at all, so without this the whole
      // section used to render nothing even though total_rows/train_rows/
      // etc. were sitting right there in training_dataset the whole time.
      if (td.total_rows !== undefined) {
        html += '<div class="grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">';
        html += '<div class="metric"><div class="metric-label">Total Rows</div><div class="metric-value">' + (td.total_rows || 0).toLocaleString() + '</div></div>';
        html += '<div class="metric"><div class="metric-label">Train Rows</div><div class="metric-value">' + (td.train_rows || 0).toLocaleString() + '</div></div>';
        html += '<div class="metric"><div class="metric-label">Val Rows</div><div class="metric-value">' + (td.val_rows || 0).toLocaleString() + '</div></div>';
        html += '<div class="metric"><div class="metric-label">Features</div><div class="metric-value">' + (td.total_features !== undefined ? td.total_features : 'N/A') + '</div></div>';
        html += '</div>';
        if (td.validation_notes && td.validation_notes.length > 0) {
          html += '<ul style="margin: 0 0 15px 0; padding-left: 20px; color: var(--fmc-slate); font-size: 13px;">';
          for (var vni = 0; vni < td.validation_notes.length; vni++) {
            html += '<li>' + td.validation_notes[vni] + '</li>';
          }
          html += '</ul>';
        }
      }

      if (Array.isArray(ci.class_distribution) && ci.class_distribution.length > 0) {
        // N-class distribution table — one column per class, driven by class_distribution
        // rather than assuming exactly two (minority/majority). Array shape only: some existing
        // cards already send class_distribution as a legacy {label: count} dict, which the
        // branch below still handles exactly as before.
        var classes = ci.class_distribution;
        var trainDist = ci.train_distribution || {};
        var valDist = ci.val_distribution || {};
        var totalTrain = 0, totalVal = 0, totalAll = 0;

        html += '<table><tr><th style="width: 150px;"></th>';
        classes.forEach(function(c) {
          var label = c.display_name ? (c.label + ' — ' + c.display_name) : c.label;
          html += '<th style="text-align: right;">' + label + '</th>';
        });
        html += '<th style="text-align: right;">Total</th></tr>';

        html += '<tr><td><strong>Train</strong></td>';
        classes.forEach(function(c) {
          var v = trainDist[c.label] || 0;
          totalTrain += v;
          html += '<td style="text-align: right;">' + v.toLocaleString() + '</td>';
        });
        html += '<td style="text-align: right; font-weight: bold;">' + totalTrain.toLocaleString() + '</td></tr>';

        html += '<tr><td><strong>Validation</strong></td>';
        classes.forEach(function(c) {
          var v = valDist[c.label] || 0;
          totalVal += v;
          html += '<td style="text-align: right;">' + v.toLocaleString() + '</td>';
        });
        html += '<td style="text-align: right; font-weight: bold;">' + totalVal.toLocaleString() + '</td></tr>';

        html += '<tr><td style="border-top: 2px solid var(--fmc-ink);"><strong>Total</strong></td>';
        classes.forEach(function(c) {
          var v = c.count != null ? c.count : ((trainDist[c.label] || 0) + (valDist[c.label] || 0));
          totalAll += v;
          html += '<td style="text-align: right; font-weight: bold; border-top: 2px solid var(--fmc-ink);">' + v.toLocaleString() + '</td>';
        });
        html += '<td style="text-align: right; font-weight: bold; border-top: 2px solid var(--fmc-ink);">' + totalAll.toLocaleString() + '</td></tr></table>';

        var pctKnown = classes.every(function(c) { return c.pct != null; });
        if (pctKnown && classes.length > 0) {
          var minC = classes.reduce(function(a, b) { return b.pct < a.pct ? b : a; });
          var maxC = classes.reduce(function(a, b) { return b.pct > a.pct ? b : a; });
          html += '<div style="margin-top: 15px; color: var(--fmc-slate); font-size: 13px;">' +
            'Class balance: <strong>' + minC.label + '</strong> is ' + minC.pct.toFixed(1) + '% of data, <strong>' + maxC.label + '</strong> is ' + maxC.pct.toFixed(1) + '%</div>';
        }
      } else if (ci.class_distribution || ci.train_distribution) {
        // Legacy binary distribution table (also covers the legacy dict-shaped class_distribution).
        var minClass = ci.minority_class || '1';
        var majClass = ci.majority_class || '0';
        var train0 = (ci.train_distribution && (ci.train_distribution[majClass] || ci.train_distribution['0'])) || 0;
        var train1 = (ci.train_distribution && (ci.train_distribution[minClass] || ci.train_distribution['1'])) || 0;
        var val0 = (ci.val_distribution && (ci.val_distribution[majClass] || ci.val_distribution['0'])) || 0;
        var val1 = (ci.val_distribution && (ci.val_distribution[minClass] || ci.val_distribution['1'])) || 0;
        var totalTrainBin = train0 + train1;
        var totalValBin = val0 + val1;
        var totalSamples = ci.total_samples || td.train_rows || (totalTrainBin + totalValBin) || 0;

        html += `
            <table>
                <tr>
                    <th style="width: 150px;"></th>
                    <th style="text-align: right;">Class "${ci.minority_class || '1'}"</th>
                    <th style="text-align: right;">Class "${ci.majority_class || '0'}"</th>
                    <th style="text-align: right;">Total</th>
                </tr>
                <tr>
                    <td><strong>Train</strong></td>
                    <td style="text-align: right;">${train1.toLocaleString()}</td>
                    <td style="text-align: right;">${train0.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold;">${totalTrainBin.toLocaleString()}</td>
                </tr>
                <tr>
                    <td><strong>Validation</strong></td>
                    <td style="text-align: right;">${val1.toLocaleString()}</td>
                    <td style="text-align: right;">${val0.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold;">${totalValBin.toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="border-top: 2px solid var(--fmc-ink);"><strong>Total</strong></td>
                    <td style="text-align: right; font-weight: bold; border-top: 2px solid var(--fmc-ink);">${(ci.minority_class_count || (train1 + val1)).toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold; border-top: 2px solid var(--fmc-ink);">${(ci.majority_class_count || (train0 + val0)).toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold; border-top: 2px solid var(--fmc-ink);">${totalSamples.toLocaleString()}</td>
                </tr>
            </table>
            <div style="margin-top: 15px; color: var(--fmc-slate); font-size: 13px;">
                Imbalance ratio: <strong>${ci.imbalance_ratio || 'N/A'}:1</strong> (minority class is ${((ci.minority_class_count || 0) / totalSamples * 100).toFixed(1)}% of data)
            </div>
        `;
      }

      html += '</div></details>';
      return html;
    },

    /**
     * Render per-column feature inventory + statistics. feature_inventory
     * (name/type/encoder/unique values) and column_statistics
     * (predictability/mutual information) exist on every card -- ES and
     * SP alike -- but neither was wired into renderHTML before this, so
     * this data was computed and written by the backend and then silently
     * never shown.
     */
    renderFeatureInventory: function(data) {
      var fi = data.feature_inventory;
      if (!fi || fi.length === 0) return '';
      var stats = data.column_statistics || {};
      var fiExcludedCount = fi.filter(function(f) { return f.column_importance && f.column_importance.weight === 0; }).length;
      var fiHL = fi.length + ' column' + (fi.length !== 1 ? 's' : '') + (fiExcludedCount > 0 ? ' • ' + fiExcludedCount + ' excluded' : '');

      var html = `
    <details class="section" open>
        <summary>FEATURES${highlightSpan(fiHL)}</summary>
        <div class="section-content">
            <table>
                <tr>
                    <th style="text-align: left;">Column</th>
                    <th style="text-align: left;">Type</th>
                    <th style="text-align: left;">Encoder</th>
                    <th style="text-align: right;">Unique Values</th>
                    <th style="text-align: right;">Predictability</th>
                </tr>
      `;

      var excludedLabels = {
        random_strings_detected: 'RANDOM/ID',
        structural_junk_detected: 'JUNK COLUMN',
        pruned_during_training: 'PRUNED'
      };

      for (var i = 0; i < fi.length; i++) {
        var f = fi[i] || {};
        var s = stats[f.name] || {};
        var typeDisplay = (f.type || 'N/A').replace(/^ColumnType\./, '');
        var predictability = (typeof s.predictability_pct === 'number') ? s.predictability_pct.toFixed(1) + '%' : 'N/A';
        var ci = f.column_importance;
        var isExcluded = !!ci && ci.weight === 0;
        var excludedBadge = '';
        if (isExcluded) {
          var badgeLabel = excludedLabels[ci.reason] || 'EXCLUDED';
          var badgeTitle = (ci.description || '').replace(/"/g, '&quot;');
          excludedBadge = ' <span class="fmc-excluded-badge" title="' + badgeTitle + '">' + badgeLabel + '</span>';
        }
        html += '<tr' + (isExcluded ? ' style="opacity: 0.65;"' : '') + '>';
        html += '<td style="font-family: var(--fmc-mono);">' + (f.name || 'N/A') + excludedBadge + '</td>';
        html += '<td>' + typeDisplay + '</td>';
        html += '<td>' + (f.encoder_type || 'N/A') + '</td>';
        html += '<td style="text-align: right;">' + (f.unique_values !== undefined && f.unique_values !== null ? f.unique_values.toLocaleString() : 'N/A') + '</td>';
        html += '<td style="text-align: right; font-weight: bold;">' + predictability + '</td>';
        html += '</tr>';
      }

      html += '</table></div></details>';
      return html;
    },

    /**
     * Render model architecture + training configuration. Both exist on ES
     * and SP cards but were never rendered before this -- MODEL STACK only
     * shows aggregate layer/parameter counts, not the underlying
     * hyperparameters or the reasoning behind them.
     */
    renderModelArchitecture: function(data) {
      var ma = data.model_architecture;
      var tc = data.training_configuration;
      if (!ma && !tc) return '';

      var maHL = (ma && ma.d_model !== undefined)
        ? (ma.d_model + 'd' + (ma.transformer_layers !== undefined ? ' × ' + ma.transformer_layers + 'L' : '') + (ma.attention_heads !== undefined ? ' × ' + ma.attention_heads + 'H' : ''))
        : '';

      var html = `
    <details class="section" open>
        <summary>MODEL ARCHITECTURE${highlightSpan(maHL)}</summary>
        <div class="section-content">
      `;

      if (ma) {
        html += '<div class="grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 15px;">';
        html += '<div class="metric"><div class="metric-label">d_model</div><div class="metric-value">' + (ma.d_model !== undefined ? ma.d_model : 'N/A') + '</div></div>';
        html += '<div class="metric"><div class="metric-label">Transformer Layers</div><div class="metric-value">' + (ma.transformer_layers !== undefined ? ma.transformer_layers : 'N/A') + '</div></div>';
        html += '<div class="metric"><div class="metric-label">Attention Heads</div><div class="metric-value">' + (ma.attention_heads !== undefined ? ma.attention_heads : 'N/A') + '</div></div>';
        html += '<div class="metric"><div class="metric-label">FFN Factor</div><div class="metric-value">' + (ma.dim_feedforward_factor !== undefined ? ma.dim_feedforward_factor : 'N/A') + '</div></div>';
        html += '</div>';
        if (ma.loss_function) {
          html += '<div style="margin-bottom: 10px; font-size: 13px;"><strong>Loss Function:</strong> ' + ma.loss_function + '</div>';
        }
        if (ma.architecture_reasoning && ma.architecture_reasoning.length > 0) {
          html += '<details class="show-more"><summary>Architecture reasoning</summary><ul style="margin: 10px 0 0 0; padding-left: 20px; color: var(--fmc-slate); font-size: 13px;">';
          for (var ari = 0; ari < ma.architecture_reasoning.length; ari++) {
            html += '<li>' + ma.architecture_reasoning[ari] + '</li>';
          }
          html += '</ul></details>';
        }
      }

      if (tc) {
        html += '<table style="margin-top: 15px;">';
        html += '<tr><td style="width: 200px;"><strong>Epochs</strong></td><td>' + formatEpochNum(tc.best_epoch) + ' best of ' + (tc.epochs_total !== undefined ? tc.epochs_total : 'N/A') + '</td></tr>';
        html += '<tr><td><strong>Optimizer</strong></td><td>' + (tc.optimizer || 'N/A') + '</td></tr>';
        if (tc.batch_size !== undefined && tc.batch_size !== null) {
          html += '<tr><td><strong>Batch Size</strong></td><td>' + tc.batch_size + '</td></tr>';
        }
        if (tc.learning_rate !== undefined && tc.learning_rate !== null) {
          html += '<tr><td><strong>Learning Rate</strong></td><td>' + tc.learning_rate + '</td></tr>';
        }
        if (tc.dropout_schedule) {
          var ds = tc.dropout_schedule;
          html += '<tr><td><strong>Dropout Schedule</strong></td><td>' + (ds.initial !== undefined ? ds.initial : 'N/A') + ' → ' + (ds.final !== undefined ? ds.final : 'N/A') + '</td></tr>';
        }
        html += '</table>';
      }

      html += '</div></details>';
      return html;
    },

    /**
     * Render training metrics section
     */
    renderTrainingMetrics: function(data) {
      var tm = data.training_metrics || {};
      var modelType = (data.model_identification || {}).model_type || '';
      
      var html = `
    <details class="section" open>
        <summary>MODEL PERFORMANCE METRICS</summary>
      `;
      
      // Classification metrics (Single Predictor)
      if (modelType === 'Single Predictor' && tm.classification_metrics) {
        var cm = tm.classification_metrics;
        html += `
        <div class="grid">
            <div class="metric">
                <div class="metric-label" title="How often we are correct when we raise an alert">Precision</div>
                <div class="metric-value">${cm.precision !== null && cm.precision !== undefined ? cm.precision.toFixed(4) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label" title="How many true rare events we catch">Recall</div>
                <div class="metric-value">${cm.recall !== null && cm.recall !== undefined ? cm.recall.toFixed(4) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">F1 Score</div>
                <div class="metric-value">${cm.f1 !== null && cm.f1 !== undefined ? cm.f1.toFixed(4) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">AUC</div>
                <div class="metric-value">${cm.auc !== null && cm.auc !== undefined ? cm.auc.toFixed(4) : 'N/A'}</div>
            </div>
        </div>
        `;
      }
      
      html += `
    </details>
      `;
      
      return html;
    },

    /**
     * Render model quality section
     */
    renderModelQuality: function(data) {
      var mq = data.model_quality || {};
      var html = `
    <details class="section" open>
        <summary>MODEL QUALITY</summary>
      `;
      
      if (mq.assessment) {
        var qualityColor = this.getQualityColor(mq.assessment);
        html += `
        <table>
            <tr>
                <th style="width: 250px;">Assessment</th>
                <td><span class="quality-badge" style="background-color: ${qualityColor}">${mq.assessment}</span></td>
            </tr>
        </table>
        `;
      }
      
      if (mq.warnings && mq.warnings.length > 0) {
        html += '<h3 style="margin: 15px 0 10px 0; font-size: 16px;">Warnings</h3><div class="warnings-list">';
        for (var i = 0; i < mq.warnings.length; i++) {
          var warning = mq.warnings[i];
          var severityColor = this.getSeverityColor(warning.severity);
          html += `
            <div class="warning-item">
                <div class="warning-header">
                    <span class="severity-badge" style="background-color: ${severityColor}">${warning.severity || 'UNKNOWN'}</span>
                    <strong>${warning.type || 'N/A'}</strong>
                </div>
                <div class="warning-message">${warning.message || 'N/A'}</div>
            </div>
          `;
        }
        html += '</div>';
      }
      
      html += `
    </details>
      `;

      return html;
    },

    /**
     * Render best epochs section (Best PR-AUC and Best ROC-AUC)
     */
    renderBestEpochs: function(data) {
      var be = data.best_epochs;
      if (!be) return '';
      // Hide during ES training (no predictor metrics yet)
      if (this.isTraining(data) && this.getTrainingPhase(data) === 'es') return '';

      var self = this;
      var mdTo = data.training_optimization || {};
      var mdHL = (mdTo.checkpoint_value != null)
        ? (formatMetricName(mdTo.checkpoint_metric || '') + '=' + mdTo.checkpoint_value.toFixed(4))
        : '';

      function renderMetricsTable(metrics) {
        if (!metrics) return '';
        var html = '<table>';
        html += '<tr><th>Metric</th><th>Value</th></tr>';

        var metricOrder = ['accuracy', 'auc', 'pr_auc', 'f1', 'macro_f1', 'weighted_f1', 'macro_auc_ovr', 'log_loss'];
        var METRIC_LABELS = { macro_f1: 'Macro F1', weighted_f1: 'Weighted F1', macro_auc_ovr: 'Macro AUC (OvR)', log_loss: 'Log Loss' };
        for (var i = 0; i < metricOrder.length; i++) {
          var key = metricOrder[i];
          var m = metrics[key];
          if (!m) continue;
          html += '<tr>';
          html += '<td style="text-transform: uppercase; font-weight: bold;">' + (METRIC_LABELS[key] || key.replace('_', ' ')) + '</td>';
          var displayVal = 'N/A';
          if (typeof m.value === 'number') {
            displayVal = key === 'accuracy' ? (m.value * 100).toFixed(2) + '%' : m.value.toFixed(4);
          }
          html += '<td style="font-size: 18px; font-weight: bold;">' + displayVal + '</td>';
          html += '</tr>';
        }
        html += '</table>';
        return html;
      }

      function fmt3(v) { return (typeof v === 'number') ? v.toFixed(3) : '—'; }

      function renderPerClassMetrics(cmetrics) {
        if (!cmetrics || !cmetrics.per_class || !cmetrics.per_class.length) return '';
        var html = '<p class="confusion-title" style="margin-top: 0;">Per-Class Metrics</p>';
        html += '<table><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr>';
        cmetrics.per_class.forEach(function(c) {
          var name = c.display_name ? (c.label + ' — ' + c.display_name) : c.label;
          html += '<tr><td>' + name + '</td>' +
            '<td>' + fmt3(c.precision) + '</td>' +
            '<td>' + fmt3(c.recall) + '</td>' +
            '<td>' + fmt3(c.f1) + '</td>' +
            '<td>' + (c.support != null ? c.support.toLocaleString() : '—') + '</td></tr>';
        });
        var avg = cmetrics.averaging;
        if (avg) {
          var support = (avg.support != null) ? avg.support.toLocaleString() : '—';
          if (avg.macro) {
            html += '<tr style="border-top: 1px solid var(--fmc-line);">' +
              '<td style="font-weight: bold; color: var(--fmc-ink-soft);">Macro avg</td>' +
              '<td style="font-weight: bold;">' + fmt3(avg.macro.precision) + '</td>' +
              '<td style="font-weight: bold;">' + fmt3(avg.macro.recall) + '</td>' +
              '<td style="font-weight: bold;">' + fmt3(avg.macro.f1) + '</td>' +
              '<td style="font-weight: bold;">' + support + '</td></tr>';
          }
          if (avg.weighted) {
            html += '<tr><td style="font-weight: bold; color: var(--fmc-ink-soft);">Weighted avg</td>' +
              '<td style="font-weight: bold;">' + fmt3(avg.weighted.precision) + '</td>' +
              '<td style="font-weight: bold;">' + fmt3(avg.weighted.recall) + '</td>' +
              '<td style="font-weight: bold;">' + fmt3(avg.weighted.f1) + '</td>' +
              '<td style="font-weight: bold;">' + support + '</td></tr>';
          }
        }
        html += '</table>';
        return html;
      }

      function renderPerClassAuc(cmetrics) {
        if (!cmetrics || !cmetrics.per_class_auc_ovr || !cmetrics.per_class_auc_ovr.length) return '';
        var html = '<details class="show-more" style="margin-top: 14px;">';
        html += '<summary>Show per-class AUC (one-vs-rest)</summary>';
        html += '<div style="margin-top: 10px; max-width: 320px;"><table>';
        html += '<tr><th>Class</th><th>AUC (OvR)</th></tr>';
        cmetrics.per_class_auc_ovr.forEach(function(c) {
          html += '<tr><td>' + c.label + '</td><td>' + (c.auc != null ? c.auc.toFixed(4) : '—') + '</td></tr>';
        });
        var macroAuc = cmetrics.macro_auc_ovr && typeof cmetrics.macro_auc_ovr.value === 'number' ? cmetrics.macro_auc_ovr.value : null;
        if (macroAuc != null) {
          html += '<tr style="border-top: 1px solid var(--fmc-line);">' +
            '<td style="font-weight: bold; color: var(--fmc-ink-soft);">Macro AUC</td>' +
            '<td style="font-weight: bold;">' + macroAuc.toFixed(4) + '</td></tr>';
        }
        html += '</table></div></details>';
        return html;
      }

      // per_class_precision/recall/f1 on the confusion-matrix payload are dicts
      // keyed by label (no support counts emitted yet) -- reshape into the
      // {per_class: [{label, precision, recall, f1}]} array renderPerClassMetrics
      // expects. Returns null when the producer didn't emit any per-class data,
      // so the caller can skip the side panel entirely rather than show an
      // empty table.
      function buildPerClassMetricsFromCm(labels, cm) {
        if (!cm || !labels || !labels.length) return null;
        var p = cm.per_class_precision || {};
        var r = cm.per_class_recall || {};
        var f = cm.per_class_f1 || {};
        var hasAny = false;
        var perClass = labels.map(function(label) {
          if (p[label] != null || r[label] != null || f[label] != null) hasAny = true;
          return { label: String(label), precision: p[label], recall: r[label], f1: f[label] };
        });
        return hasAny ? { per_class: perClass } : null;
      }

      function renderConfusionMatrixNxN(labels, matrix, cm, classificationMetrics) {
        var html = '<div class="confusion-wrapper">';
        html += '<h4 class="confusion-title">Confusion Matrix</h4>';
        html += '<div class="confusion-layout">';

        html += renderMatrixGrid(labels, matrix);

        var sideHtml = renderPerClassMetrics(buildPerClassMetricsFromCm(labels, cm));
        if (sideHtml) {
          html += '<div style="flex: 1; min-width: 300px;">' + sideHtml + renderPerClassAuc(classificationMetrics) + '</div>';
        }

        html += '</div></div>';
        return html;
      }

      function renderConfusionMatrix(cm, classificationMetrics) {
        if (!cm) return '';
        if (cm.class_labels && cm.matrix) {
          return renderConfusionMatrixNxN(cm.class_labels, cm.matrix, cm, classificationMetrics);
        }
        var tn = cm.tn || 0, fp = cm.fp || 0, fn = cm.fn || 0, tp = cm.tp || 0;
        var totalPos = tp + fn;
        var totalNeg = tn + fp;
        var hitRate = totalPos > 0 ? (tp / totalPos) : 0;
        var missRate = totalPos > 0 ? (fn / totalPos) : 0;
        var specificity = totalNeg > 0 ? (tn / totalNeg) : 0;
        var falseAlarmRate = totalNeg > 0 ? (fp / totalNeg) : 0;
        var precision = (tp + fp) > 0 ? (tp / (tp + fp)) : 0;

        var html = '<div class="confusion-wrapper">';
        html += '<h4 class="confusion-title">Confusion Matrix</h4>';
        html += '<div class="confusion-layout">';

        // Matrix - POS first (standard convention) - pure inline styles, no table
        var cmLabel = 'font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate);';
        html += '<div style="display: inline-block;">';
        html += '<div style="text-align: center; margin-left: 80px; margin-bottom: 4px; ' + cmLabel + '">Predicted</div>';
        html += '<div style="display: flex; margin-left: 80px; margin-bottom: 3px;"><div style="width: 70px; text-align: center; ' + cmLabel + '">Pos</div><div style="width: 70px; text-align: center; ' + cmLabel + '">Neg</div></div>';
        html += '<div style="display: flex; align-items: center; margin-bottom: 2px;">';
        html += '<div style="width: 40px; text-align: center; writing-mode: vertical-lr; transform: rotate(180deg); ' + cmLabel + '">Actual</div>';
        html += '<div style="width: 38px; text-align: right; padding-right: 4px; font-weight: 600; ' + cmLabel + '">Pos</div>';
        html += '<div class="cm-cell cm-correct" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + tp + '</div>';
        html += '<div class="cm-cell cm-error" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + fn + '</div>';
        html += '</div>';
        html += '<div style="display: flex; align-items: center;">';
        html += '<div style="width: 40px;"></div>';
        html += '<div style="width: 38px; text-align: right; padding-right: 4px; font-weight: 600; ' + cmLabel + '">Neg</div>';
        html += '<div class="cm-cell cm-error" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + fp + '</div>';
        html += '<div class="cm-cell cm-correct" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + tn + '</div>';
        html += '</div>';
        html += '</div>';

        // Derived metrics
        html += '<table class="derived-metrics">';
        html += '<tr><td><strong>Hit Rate</strong> (Recall)</td><td class="dm-value">' + hitRate.toFixed(4) + '</td><td class="dm-formula">TP / (TP+FN)</td></tr>';
        html += '<tr><td><strong>Miss Rate</strong></td><td class="dm-value">' + missRate.toFixed(4) + '</td><td class="dm-formula">FN / (TP+FN)</td></tr>';
        html += '<tr><td><strong>Specificity</strong> (TNR)</td><td class="dm-value">' + specificity.toFixed(4) + '</td><td class="dm-formula">TN / (TN+FP)</td></tr>';
        html += '<tr><td><strong>False Alarm</strong> (FPR)</td><td class="dm-value">' + falseAlarmRate.toFixed(4) + '</td><td class="dm-formula">FP / (TN+FP)</td></tr>';
        html += '<tr><td><strong>Precision</strong> (PPV)</td><td class="dm-value">' + precision.toFixed(4) + '</td><td class="dm-formula">TP / (TP+FP)</td></tr>';
        html += '</table>';

        html += '</div></div>';
        return html;
      }

      var REGRESSION_METRIC_ORDER = ['r2', 'nrmse', 'rmse', 'mae', 'spearman', 'smape', 'median_ae', 'max_error'];
      var REGRESSION_METRIC_LABELS = {
        r2: 'R²', nrmse: 'NRMSE (σ-normalized error)', rmse: 'RMSE', mae: 'MAE',
        spearman: 'Spearman ρ (rank correlation)', smape: 'sMAPE', median_ae: 'Median AE', max_error: 'Max Error'
      };

      function renderRegressionMetricsTable(regMetrics, skill) {
        if (!regMetrics) return '';
        var html = '<table>';
        html += '<tr><th>Metric</th><th>Value</th><th>Quality</th></tr>';
        for (var i = 0; i < REGRESSION_METRIC_ORDER.length; i++) {
          var key = REGRESSION_METRIC_ORDER[i];
          var m = regMetrics[key];
          if (!m || typeof m.value !== 'number') continue;
          var displayVal = key === 'smape' ? m.value.toFixed(2) + '%' : m.value.toFixed(4);
          html += '<tr>';
          html += '<td style="font-weight: bold;">' + (REGRESSION_METRIC_LABELS[key] || key) + '</td>';
          html += '<td style="font-size: 18px; font-weight: bold;">' + displayVal + '</td>';
          html += '<td>' + (m.quality ? '<span class="quality-badge" style="background-color: ' + self.getQualityColor(m.quality) + '; font-size: 11px; padding: 2px 8px;">' + m.quality + '</span>' : '—') + '</td>';
          html += '</tr>';
        }
        html += '</table>';
        if (skill && skill.text) {
          var skillColor = skill.tier === 'beats_xgb' ? 'var(--fmc-good)' :
            (skill.tier === 'ties_xgb' || skill.tier === 'beats_lr') ? 'var(--fmc-brass-strong)' :
            (skill.tier === 'no_skill' || skill.tier === 'below_baselines') ? 'var(--fmc-bad)' : 'var(--fmc-slate)';
          html += '<div style="margin-top: 12px; font-size: 13px; font-weight: 600; color: ' + skillColor + ';">' + skill.text + '</div>';
        }
        return html;
      }

      function renderEpochSection(title, epochData) {
        if (!epochData) return '';

        // Regression (scalar target): R²/RMSE/MAE table + skill verdict — no confusion
        // matrix, no per-row correct/wrong (that tracking is classification-only today).
        if (epochData.regression_display_metadata) {
          var rdm = epochData.regression_display_metadata;
          var rHtml = '<div class="epoch-section">';
          rHtml += '<h3 class="epoch-title">' + title + ' — ' + formatEpochPhrase(epochData.epoch != null ? epochData.epoch : rdm.epoch) + '</h3>';
          rHtml += renderRegressionMetricsTable(rdm.regression_metrics, rdm.skill);
          rHtml += '</div>';
          return rHtml;
        }

        var cdm = epochData.classification_display_metadata || {};
        var html = '<div class="epoch-section">';
        html += '<h3 class="epoch-title">' + title + ' — ' + formatEpochPhrase(epochData.epoch != null ? epochData.epoch : cdm.epoch) + '</h3>';
        html += renderMetricsTable(cdm.classification_metrics);
        html += renderConfusionMatrix(cdm.confusion_matrix, cdm.classification_metrics);

        // Per-row tracking summary
        var prt = cdm.per_row_tracking;
        if (prt && (prt.this_epoch || prt.cumulative_categories)) {
          html += '<details class="show-more">';
          html += '<summary>Show per-row tracking</summary>';
          if (prt.this_epoch) {
            html += '<h4 style="margin: 15px 0 10px 0; font-family: var(--fmc-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: bold; color: var(--fmc-ink-soft);">This Epoch</h4>';
            html += '<table style="width: auto;">';
            html += '<tr><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr>';
            html += '<tr><td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 18px; font-weight: bold; color: var(--fmc-good);">' + prt.this_epoch.correct + '</td>';
            html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 18px; font-weight: bold; color: var(--fmc-bad);">' + prt.this_epoch.wrong + '</td>';
            html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 18px; font-weight: bold;">' + prt.this_epoch.accuracy_pct.toFixed(1) + '%</td></tr>';
            html += '</table>';
          }
        }
        if (prt && prt.cumulative_categories) {
          var cc = prt.cumulative_categories;
          html += '<h4 style="margin: 15px 0 10px 0; font-family: var(--fmc-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: bold; color: var(--fmc-ink-soft);">Cumulative</h4>';
          html += '<table style="width: auto;">';
          html += '<tr><th>Never Wrong</th><th>Rarely</th><th>Sometimes</th><th>Frequently</th><th>Always Wrong</th></tr>';
          html += '<tr>';
          html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-weight: bold; color: var(--fmc-good);">' + cc.never_wrong + '</td>';
          html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-weight: bold; color: #6b8f2e;">' + cc.rarely_wrong + '</td>';
          html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-weight: bold; color: var(--fmc-warn);">' + cc.sometimes_wrong + '</td>';
          html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-weight: bold; color: #c2660c;">' + cc.frequently_wrong + '</td>';
          html += '<td style="font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-weight: bold; color: var(--fmc-bad);">' + cc.always_wrong + '</td>';
          html += '</tr></table>';
        }
        if (prt && (prt.this_epoch || prt.cumulative_categories)) {
          html += '</details>';
        }
        html += '</div>';
        return html;
      }

      // Epoch tabs are generated from whatever best_epochs.* keys are actually present —
      // not hardcoded to PR-AUC/ROC-AUC — so multiclass models (best_macro_f1, best_log_loss, ...)
      // get their own tabs automatically. training_optimization.checkpoint_metric decides which
      // tab opens by default; PR-AUC/ROC-AUC keep their historical left-to-right order for old cards.
      var epochKeys = Object.keys(be).filter(function(k) {
        return k.charAt(0) !== '_' && be[k] && typeof be[k] === 'object';
      });
      if (epochKeys.length === 0) return '';

      var ORDER_PREFERENCE = ['best_pr_auc', 'best_roc_auc'];
      epochKeys.sort(function(a, b) {
        var ia = ORDER_PREFERENCE.indexOf(a), ib = ORDER_PREFERENCE.indexOf(b);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      var checkpointMetric = (data.training_optimization && data.training_optimization.checkpoint_metric) || null;
      var preferredKey = checkpointMetric ? ('best_' + checkpointMetric) : null;
      var activeKey = (preferredKey && be[preferredKey]) ? preferredKey : (be.best_roc_auc ? 'best_roc_auc' : epochKeys[0]);

      var html = '<details class="section" open><summary>MODEL DETAILS' + highlightSpan(mdHL) + '</summary><div class="section-content">';

      if (checkpointMetric) {
        html += '<div class="opt-strip"><span class="opt-label">Optimized for</span> <span class="fmc-badge-brass">' + formatMetricName(checkpointMetric).toUpperCase() + '</span></div>';
      }

      html += '<div class="epoch-tabs">';
      epochKeys.forEach(function(key) {
        var label = 'Best ' + formatMetricName(key.replace(/^best_/, ''));
        html += '<button class="epoch-tab' + (key === activeKey ? ' active' : '') + '" data-tab="' + key + '">' + label + '</button>';
      });
      html += '</div>';

      epochKeys.forEach(function(key) {
        var label = 'Best ' + formatMetricName(key.replace(/^best_/, ''));
        html += '<div class="epoch-tab-content' + (key === activeKey ? ' active' : '') + '" data-tab="' + key + '">';
        html += renderEpochSection(label, be[key]);
        html += '</div>';
      });

      html += '</div></details>';
      return html;
    },

    /**
     * Render training optimization section
     */
    renderTrainingOptimization: function(data) {
      var to = data.training_optimization;
      if (!to) return '';

      var toHL = (to.checkpoint_value != null)
        ? (formatMetricName(to.checkpoint_metric || '') + '=' + to.checkpoint_value.toFixed(4))
        : '';

      var html = `
    <details class="section" open>
        <summary>TRAINING OPTIMIZATION${highlightSpan(toHL)}</summary>
        <div class="section-content">
      `;

      // Main description if available
      if (to.optimization_description) {
        html += '<div style="margin-bottom: 20px; padding: 12px 15px; background: var(--fmc-brass-bg); border-left: 3px solid var(--fmc-brass); border-radius: 0 4px 4px 0; font-size: 14px;">';
        html += '<strong>Strategy:</strong> ' + to.optimization_description;
        html += '</div>';
      }

      // Key metrics grid
      html += '<div class="grid" style="grid-template-columns: repeat(3, 1fr);">';

      html += '<div class="metric">';
      html += '<div class="metric-label">Loss Function</div>';
      html += '<div class="metric-value" style="font-size: 18px;">' + (to.loss_function || 'N/A') + '</div>';
      html += '</div>';

      html += '<div class="metric">';
      html += '<div class="metric-label">Optimization Priority</div>';
      html += '<div class="metric-value" style="font-size: 18px; text-transform: capitalize;">' + (to.optimization_priority || 'N/A') + '</div>';
      html += '</div>';

      html += '<div class="metric">';
      html += '<div class="metric-label">Checkpoint Metric</div>';
      var checkpointMetric = to.checkpoint_metric;
      var checkpointDisplay = (!checkpointMetric || checkpointMetric.toLowerCase() === 'none') ? 'Default' : checkpointMetric.toUpperCase().replace('_', '-');
      html += '<div class="metric-value" style="font-size: 18px;">' + checkpointDisplay + '</div>';
      html += '</div>';

      html += '</div>';

      // Details table
      html += '<table style="margin-top: 20px;">';

      if (to.focal_gamma !== undefined || to.focal_alpha !== undefined) {
        html += '<tr><td style="width: 200px;"><strong>Focal Loss Parameters</strong></td>';
        html += '<td>γ=' + (to.focal_gamma || 'N/A') + ', α=' + (to.focal_alpha || 'N/A') + '</td></tr>';
      }

      if (to.class_weights && to.class_weights.length > 0) {
        html += '<tr><td><strong>Class Weights</strong></td>';
        html += '<td>[' + to.class_weights.join(', ') + ']</td></tr>';
      }

      if (to.cost_sensitive) {
        var cs = to.cost_sensitive;
        html += '<tr><td><strong>Cost-Sensitive</strong></td>';
        html += '<td>FP cost: ' + (cs.cost_false_positive || 1.0) + ', FN cost: ' + (cs.cost_false_negative || 1.0) + '</td></tr>';
      }

      if (to.adaptive_loss !== undefined) {
        html += '<tr><td><strong>Adaptive Loss</strong></td>';
        html += '<td>' + (to.adaptive_loss ? 'Yes' : 'No');
        if (to.gamma_adjustments) html += ' (' + to.gamma_adjustments + ' adjustments)';
        html += '</td></tr>';
      }

      if (to.checkpoint_value !== undefined) {
        html += '<tr><td><strong>Best Checkpoint</strong></td>';
        html += '<td>' + to.checkpoint_value.toFixed(4) +
          (to.checkpoint_epoch === -1 ? ' — Warm Start (pre-training; no fine-tuning epoch beat it)' : ' at epoch ' + formatEpochNum(to.checkpoint_epoch)) +
          '</td></tr>';
      }

      if (to.positive_class !== undefined) {
        html += '<tr><td><strong>Positive Class</strong></td>';
        html += '<td>"' + to.positive_class + '"</td></tr>';
      }

      html += '</table>';
      html += '</div></details>';
      return html;
    },

    /**
     * Attach event listeners to expand/collapse buttons
     * Call this after inserting HTML into the DOM
     */
    /**
     * Render data processing notes section
     */
    renderDataProcessingNotes: function(data) {
      var notes = data.data_processing_notes;
      if (!notes || notes.length === 0) return '';

      var severityColor = { info: 'var(--fmc-brass)', warning: 'var(--fmc-warn)', critical: 'var(--fmc-bad)' };
      var severityBg   = { info: 'var(--fmc-brass-bg)', warning: 'var(--fmc-warn-bg)', critical: 'var(--fmc-bad-bg)' };
      var severityBorder = { info: 'var(--fmc-brass-border)', warning: 'var(--fmc-warn-border)', critical: 'var(--fmc-bad-border)' };

      var categoryLabel = {
        column_dropped:   'Column Dropped',
        rows_filtered:    'Rows Filtered',
        type_detection:   'Type Detection',
        data_transform:   'Data Transform',
        csv_parsing:      'CSV Parsing',
        dataset_sampling: 'Dataset Sampling'
      };

      var dpnCounts = {};
      notes.forEach(function(n) {
        var s = (n.severity || 'info').toLowerCase();
        dpnCounts[s] = (dpnCounts[s] || 0) + 1;
      });
      var dpnParts = [];
      if (dpnCounts.critical) dpnParts.push(dpnCounts.critical + ' critical');
      if (dpnCounts.warning) dpnParts.push(dpnCounts.warning + ' warning' + (dpnCounts.warning > 1 ? 's' : ''));
      if (dpnCounts.info) dpnParts.push(dpnCounts.info + ' info');
      var dpnHL = dpnParts.join(', ') || (notes.length + ' note' + (notes.length !== 1 ? 's' : ''));

      var html = '<details class="section" open><summary>DATA PROCESSING NOTES' + highlightSpan(dpnHL) + '</summary><div class="section-content">';
      html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
      html += '<thead><tr style="border-bottom:2px solid var(--fmc-ink);">';
      html += '<th style="text-align:left; padding:6px 10px; width:110px;">Severity</th>';
      html += '<th style="text-align:left; padding:6px 10px; width:140px;">Category</th>';
      html += '<th style="text-align:left; padding:6px 10px;">Message</th>';
      html += '<th style="text-align:left; padding:6px 10px; width:180px;">Affected</th>';
      html += '</tr></thead><tbody>';

      notes.forEach(function(note) {
        var sev = (note.severity || 'info').toLowerCase();
        var cat = (note.category || '').toLowerCase();
        var color  = severityColor[sev]  || 'var(--fmc-slate)';
        var bg     = severityBg[sev]     || 'var(--fmc-mist-2)';
        var border = severityBorder[sev] || 'var(--fmc-line)';
        var catText = categoryLabel[cat] || note.category || 'Note';

        var affected = [];
        if (note.columns && note.columns.length > 0) {
          affected.push(note.columns.map(function(c) {
            return '<code style="font-size:11px; background:var(--fmc-mist-2); padding:1px 4px; border-radius:3px;">' + c + '</code>';
          }).join(' '));
        }
        if (note.rows_affected != null) {
          affected.push(note.rows_affected.toLocaleString() + ' rows');
        }

        html += '<tr style="border-bottom:1px solid var(--fmc-line-soft); background:' + bg + ';">';
        html += '<td style="padding:8px 10px; vertical-align:top;">';
        html += '<span style="background:' + color + '; color:#fff; font-family:var(--fmc-mono); font-size:10px; font-weight:bold; padding:2px 7px; border-radius:3px; text-transform:uppercase; letter-spacing:0.03em;">' + sev + '</span>';
        html += '</td>';
        html += '<td style="padding:8px 10px; vertical-align:top; color:var(--fmc-ink-soft); font-size:12px;">' + catText + '</td>';
        html += '<td style="padding:8px 10px; vertical-align:top;">' + (note.message || '') + '</td>';
        html += '<td style="padding:8px 10px; vertical-align:top; font-size:12px;">' + (affected.join('<br>') || '—') + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table></div></details>';
      return html;
    },

    /**
     * Render selective prediction section
     */
    renderSelectivePrediction: function(data) {
      // Support both new key ('coverage') and legacy key ('selective_prediction')
      var sp = data.coverage || data.selective_prediction;
      if (!sp) return '';

      var INTENT_DISPLAY = {
        'balanced': 'Balanced (default)',
        'only_alert_when_confident': 'Only alert when confident',
        'catch_everything': 'Catch everything',
        'minimize_cost': 'Minimize expected cost',
        'rank': 'Ranking \u2014 no operating point',
        'predict_probabilities': 'Calibrated probabilities \u2014 no operating point'
      };

      // Strategy tabs are generated from whatever keys are actually present under sp.strategies —
      // not a fixed set — so per-class strategies (detect_class_P0, ...) show up automatically.
      // Legacy key names get their historical labels and left-to-right order; anything else falls
      // back to entry.label (if the backend supplied one) or a humanized version of the key.
      var LEGACY_STRATEGY_LABELS = {
        everything: 'Always answer', best_always_answers: 'Always answer',
        only_when_sure: 'Balanced demur', best_balanced_may_demur: 'Balanced demur',
        only_on_strong_positives: 'Detect positives', best_detects_positives_may_demur: 'Detect positives',
        only_on_strong_negatives: 'Rule out negatives', best_rules_out_negatives_may_demur: 'Rule out negatives'
      };
      var LEGACY_STRATEGY_ORDER = [
        'everything', 'best_always_answers',
        'only_when_sure', 'best_balanced_may_demur',
        'only_on_strong_positives', 'best_detects_positives_may_demur',
        'only_on_strong_negatives', 'best_rules_out_negatives_may_demur'
      ];
      function humanizeKey(key) {
        return key.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }

      function pickPrimaryMetric(entry) {
        if (entry.target_class && entry.covered_recall_target_class != null) {
          return { label: 'Recall (' + entry.target_class + ')', covered: entry.covered_recall_target_class, full: entry.full_recall_target_class, lift: null };
        }
        if (entry.covered_macro_f1 != null || entry.full_macro_f1 != null) {
          return { label: 'Macro-F1', covered: entry.covered_macro_f1, full: entry.full_macro_f1, lift: entry.macro_f1_lift };
        }
        return { label: 'AUC', covered: entry.covered_auc, full: entry.full_auc, lift: entry.auc_lift };
      }

      function getDemurBadge(value, baseline) {
        if (value === null || value === undefined) return { text: 'N/A \u2014 answers everything', bg: 'var(--fmc-slate)', fg: 'white' };
        if (value === 1.0) return { text: 'PERFECT \u2713', bg: 'var(--fmc-good)', fg: 'white' };
        if (value > baseline + 0.05) return { text: 'BETTER THAN RANDOM', bg: 'var(--fmc-good)', fg: 'white' };
        if (Math.abs(value - baseline) <= 0.05) return { text: '\u2248 RANDOM', bg: 'var(--fmc-warn)', fg: 'white' };
        return { text: 'ANTI-ALIGNED \u26a0', bg: 'var(--fmc-bad)', fg: 'white' };
      }

      function fmtAuc(v) { return (v != null) ? v.toFixed(4) : '\u2014'; }
      function fmtPct(v) { return (v != null) ? (v * 100).toFixed(1) + '%' : '\u2014'; }
      function fmtThreshold(v) { return (v != null) ? v.toFixed(2) : '\u2014'; }

      function renderSPEntry(entry) {
        if (!entry) return '';
        if (entry.coverage === null || entry.coverage === undefined) return '';

        var dec = entry.demur_error_capture;
        var baseline = entry.demur_random_baseline || 0;
        var intent = entry.intent || null;
        var source = entry.source || null;
        var calMethod = entry.calibration_method || null;
        var isNoop = intent === 'rank' || intent === 'predict_probabilities';

        var n_covered = entry.n_covered || 0;
        var n_total = entry.n_total || 0;
        var n_demurred = entry.n_demurred || 0;
        var coverage = entry.coverage || 0;
        var tp = entry.n_demurred_true_positives || 0;
        var fp = entry.n_demurred_false_positives || 0;
        var fn = entry.n_demurred_false_negatives || 0;
        var tn = entry.n_demurred_true_negatives || 0;

        // isAlwaysAnswers is really "did this strategy decline anything" — n_demurred is the
        // ground truth for that. demur_error_capture is a binary-only headline metric on top;
        // its absence (e.g. per-class "detect X" strategies) doesn't mean nothing was declined.
        var isAlwaysAnswers = n_demurred === 0;
        var hasDemurBadge = dec !== null && dec !== undefined;
        var badge = (isAlwaysAnswers || hasDemurBadge) ? getDemurBadge(hasDemurBadge ? dec : null, baseline) : null;

        var pm = pickPrimaryMetric(entry);
        var liftColor = (pm.lift == null || pm.lift >= 0) ? 'var(--fmc-good)' : 'var(--fmc-bad)';

        var covered_precision = entry.covered_precision != null ? entry.covered_precision : null;
        var covered_recall = entry.covered_recall != null ? entry.covered_recall : null;
        var extraMetricLabel = null;
        var extraMetricValue = null;
        if (intent === 'only_alert_when_confident' && covered_precision !== null) {
          extraMetricLabel = 'Covered Precision';
          extraMetricValue = covered_precision.toFixed(4);
        } else if ((intent === 'catch_everything' || intent === 'catch_everything_aggressive') && covered_recall !== null) {
          extraMetricLabel = 'Covered Recall';
          extraMetricValue = covered_recall.toFixed(4);
        }

        var intentLabel = INTENT_DISPLAY[intent || ''] || (intent ? intent.replace(/_/g, ' ') : 'Balanced (default)');
        var CONTRACT_INTENTS = ['only_alert_when_confident', 'catch_everything', 'catch_everything_aggressive'];
        var showFallbackBanner = entry.intent_feasible === false && CONTRACT_INTENTS.indexOf(intent || '') !== -1;
        var sourceTag = '';
        if (source) {
          var sourceColor = source === 'per_epoch' ? 'var(--fmc-warn)' : 'var(--fmc-good)';
          var sourceBg = source === 'per_epoch' ? 'var(--fmc-warn-bg)' : 'var(--fmc-good-bg)';
          var sourceBorder = source === 'per_epoch' ? 'var(--fmc-warn-border)' : 'var(--fmc-good-border)';
          sourceTag = ' <span style="padding:2px 6px;background:' + sourceBg + ';border:1px solid ' + sourceBorder + ';border-radius:3px;font-family:var(--fmc-mono);font-size:11px;color:' + sourceColor + ';">' +
            source.replace(/_/g, ' ') + (calMethod ? ' \u00b7 ' + calMethod : '') + '</span>';
        }

        var html = '<div class="opt-strip"><span class="opt-label">Optimized for</span> <strong>' + intentLabel + '</strong>' + sourceTag + '</div>';

        if (showFallbackBanner) {
          html += '<div style="margin-bottom:15px;padding:12px 16px;background:var(--fmc-warn-bg);border-left:4px solid var(--fmc-warn);border-radius:0 4px 4px 0;font-size:13px;">' +
            '<div style="font-weight:bold;margin-bottom:6px;color:var(--fmc-ink-soft);">\u26a0 Operating point fell back to max-AUC</div>' +
            '<div style="margin-bottom:8px;color:var(--fmc-ink-soft);">This model was trained with intent=<strong>' + (intent || '') + '</strong>, but no operating point in the validation sweep could meet that floor. The framework returned the highest-AUC fallback instead.</div>' +
            '<div style="margin-bottom:8px;color:var(--fmc-ink-soft);"><strong>What this means for production:</strong><ul style="margin:4px 0 0 18px;padding:0;">' +
            '<li>The headline metrics describe the fallback point, not the contract you asked for.</li>' +
            '<li>Deploying this model will not deliver the requested floor.</li>' +
            '<li>To honor your contract: lower your floor, retrain, or accept that the data does not support it.</li>' +
            '</ul></div>' +
            (entry.intent_feasibility_reason ? '<div style="color:var(--fmc-ink-soft);font-style:italic;">' + entry.intent_feasibility_reason + '</div>' : '') +
            '</div>';
        }

        if (source === 'per_epoch') {
          html += '<div style="margin-bottom:12px;padding:8px 12px;background:var(--fmc-warn-bg);border-left:3px solid var(--fmc-warn);border-radius:0 4px 4px 0;font-size:12px;color:var(--fmc-warn);">' +
            'Operating point computed on uncalibrated probabilities \u2014 calibration did not run.</div>';
        }

        if (isNoop) {
          return html + '<div style="padding:15px;background:var(--fmc-mist-2);border:1px solid var(--fmc-line);border-radius:4px;font-size:13px;color:var(--fmc-ink-soft);">' +
            'This model is meant for scoring, not operating-point decisions \u2014 use raw <code>predict_proba()</code> output.</div>';
        }

        // Demur headline
        var headlineHtml = '';
        if (isAlwaysAnswers) {
          headlineHtml = '<span class="quality-badge" style="background-color:' + badge.bg + ';color:' + badge.fg + ';">' + badge.text + '</span>';
        } else if (hasDemurBadge) {
          headlineHtml = '<span style="font-family:var(--fmc-mono);font-variant-numeric:tabular-nums;font-size:22px;font-weight:bold;">' + dec.toFixed(4) + '</span>' +
            ' <span class="quality-badge" style="background-color:' + badge.bg + ';color:' + badge.fg + ';">' + badge.text + '</span>' +
            ' <span style="color:var(--fmc-slate);font-family:var(--fmc-mono);font-size:12px;">vs ' + baseline.toFixed(2) + ' random</span>';
        } else if (pm.lift != null) {
          headlineHtml = '<span style="font-family:var(--fmc-mono);font-variant-numeric:tabular-nums;font-size:22px;font-weight:bold;color:' + liftColor + ';">' +
            (pm.lift >= 0 ? '+' : '') + pm.lift.toFixed(4) + '</span>' +
            ' <span style="color:var(--fmc-slate);font-size:12px;">' + pm.label + ' lift vs full</span>';
        }
        if (headlineHtml) {
          html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:15px;">' + headlineHtml + '</div>';
        }

        // Metrics grid
        var gridCols = extraMetricLabel ? 6 : 5;
        var liftDisplay = pm.lift != null ? ((pm.lift >= 0 ? '+' : '') + pm.lift.toFixed(4)) : '\u2014';
        html += '<div class="grid" style="grid-template-columns:repeat(' + gridCols + ',1fr);margin-bottom:' + (entry.confidence_threshold_basis ? '4px' : '15px') + ';">' +
          '<div class="metric"><div class="metric-label">Covered ' + pm.label + '</div><div class="metric-value" style="font-size:18px;">' + fmtAuc(pm.covered) + '</div></div>' +
          (extraMetricLabel ? '<div class="metric"><div class="metric-label">' + extraMetricLabel + '</div><div class="metric-value" style="font-size:18px;">' + extraMetricValue + '</div></div>' : '') +
          '<div class="metric"><div class="metric-label">Full ' + pm.label + '</div><div class="metric-value" style="font-size:18px;">' + fmtAuc(pm.full) + '</div></div>' +
          '<div class="metric"><div class="metric-label">' + pm.label + ' Lift</div><div class="metric-value" style="font-size:18px;color:' + liftColor + ';">' + liftDisplay + '</div></div>' +
          '<div class="metric"><div class="metric-label">Coverage</div><div class="metric-value" style="font-size:18px;">' + fmtPct(coverage) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Threshold</div><div class="metric-value" style="font-size:18px;">' + fmtThreshold(entry.confidence_threshold) + '</div></div>' +
          '</div>';

        if (entry.confidence_threshold_basis === 'max_softmax_probability') {
          html += '<p style="font-size:11.5px;color:var(--fmc-slate);margin:0 0 15px;">Threshold is on max predicted-class probability (top-1 confidence) \u2014 a single &ldquo;positive-class score&rdquo; doesn\u2019t exist once there are more than two classes.</p>';
        }

        // Declined rows — reuse the shared N×N matrix when the backend supplies one; otherwise
        // fall back to the legacy binary 2×2.
        if (!isAlwaysAnswers && entry.declined_matrix && entry.declined_matrix.class_labels && entry.declined_matrix.matrix) {
          html += '<div style="margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0;font-family:var(--fmc-mono);font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;color:var(--fmc-ink-soft);">Declined rows — what they would have been</h4>' +
            renderMatrixGrid(entry.declined_matrix.class_labels, entry.declined_matrix.matrix) +
            '</div>';
        } else if (!isAlwaysAnswers && n_demurred > 0) {
          var colH = 'style="color:var(--fmc-slate);font-family:var(--fmc-mono);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:0.04em;padding:4px 12px;text-align:center;"';
          var rowL = 'style="color:var(--fmc-slate);font-family:var(--fmc-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:0.04em;padding:4px 12px;white-space:nowrap;"';
          var cellNorm = 'style="border:1px solid var(--fmc-line);background:var(--fmc-mist-2);padding:10px 18px;text-align:center;font-family:var(--fmc-mono);font-variant-numeric:tabular-nums;font-weight:bold;font-size:16px;min-width:80px;"';
          var cellHl = 'style="border:1px solid var(--fmc-good-border);background:var(--fmc-good-bg);padding:10px 18px;text-align:center;font-family:var(--fmc-mono);font-variant-numeric:tabular-nums;font-weight:bold;font-size:16px;color:var(--fmc-good);min-width:80px;"';
          html += '<div style="margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0;font-family:var(--fmc-mono);font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;color:var(--fmc-ink-soft);">Declined rows \u2014 what they would have been</h4>' +
            '<table style="width:auto;">' +
            '<tr><th></th><th ' + colH + '>Actual +</th><th ' + colH + '>Actual \u2212</th></tr>' +
            '<tr><td ' + rowL + '>Would predict +</td>' +
            '<td ' + cellNorm + '>' + tp + '<br><span style="font-family:var(--fmc-sans);font-size:10px;font-weight:normal;color:var(--fmc-slate);">thrown away</span></td>' +
            '<td ' + cellHl + '>' + fp + '<br><span style="font-family:var(--fmc-sans);font-size:10px;font-weight:normal;color:var(--fmc-good);">error hidden \u2713</span></td></tr>' +
            '<tr><td ' + rowL + '>Would predict \u2212</td>' +
            '<td ' + cellHl + '>' + fn + '<br><span style="font-family:var(--fmc-sans);font-size:10px;font-weight:normal;color:var(--fmc-good);">error hidden \u2713</span></td>' +
            '<td ' + cellNorm + '>' + tn + '<br><span style="font-family:var(--fmc-sans);font-size:10px;font-weight:normal;color:var(--fmc-slate);">thrown away</span></td></tr>' +
            '</table></div>';
        }

        html += '<div style="color:var(--fmc-ink-soft);font-size:13px;">Answered ' +
          '<span style="font-family:var(--fmc-mono);font-variant-numeric:tabular-nums;">' + n_covered.toLocaleString() + '/' + n_total.toLocaleString() +
          ' (' + fmtPct(coverage) + ')</span> \u2014 declined <span style="font-family:var(--fmc-mono);font-variant-numeric:tabular-nums;">' + n_demurred.toLocaleString() + '</span></div>';

        return html;
      }

      var spHL = (sp.summary && sp.summary.coverage != null) ? (Math.round(sp.summary.coverage * 100) + '% coverage') : '';
      var html = '<details class="section" open><summary>SELECTIVE PREDICTION' + highlightSpan(spHL) + '</summary><div class="section-content">';

      if (sp.summary) {
        html += '<h3 class="epoch-title">Summary</h3>' + renderSPEntry(sp.summary);
      }

      // Strategy tabs — generated from whatever keys are actually present under sp.strategies.
      if (sp.strategies) {
        var stratKeys = Object.keys(sp.strategies).filter(function(k) {
          return k.charAt(0) !== '_' && sp.strategies[k];
        });
        stratKeys.sort(function(a, b) {
          var ia = LEGACY_STRATEGY_ORDER.indexOf(a), ib = LEGACY_STRATEGY_ORDER.indexOf(b);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        var availableGroups = stratKeys.map(function(key) {
          var label = sp.strategies[key].label || LEGACY_STRATEGY_LABELS[key] || humanizeKey(key);
          return { label: label, key: key };
        });

        if (availableGroups.length > 0) {
          if (sp.summary) html += '<div style="margin-top:25px;">';
          html += '<h3 class="epoch-title">Strategies</h3>';
          html += '<div class="epoch-tabs">';
          availableGroups.forEach(function(g, i) {
            html += '<button class="epoch-tab sp-strategy-tab' + (i === 0 ? ' active' : '') + '" data-sp-tab="' + g.key + '">' + g.label + '</button>';
          });
          html += '</div>';
          availableGroups.forEach(function(g, i) {
            html += '<div class="epoch-tab-content sp-strategy-content' + (i === 0 ? ' active' : '') + '" data-sp-tab="' + g.key + '">';
            html += '<div class="epoch-section">' + renderSPEntry(sp.strategies[g.key]) + '</div></div>';
          });
          if (sp.summary) html += '</div>';
        }
      }

      // History table
      if (sp.history && sp.history.length > 0) {
        html += '<div style="margin-top:25px;"><h3 class="epoch-title">History</h3>';
        html += '<table><thead><tr><th>Epoch</th><th>Coverage</th><th>Covered AUC</th><th>Demur Error Capture</th><th>vs Random</th></tr></thead><tbody>';
        sp.history.forEach(function(h, i) {
          html += '<tr>' +
            '<td>' + (h.epoch != null ? h.epoch : i) + '</td>' +
            '<td>' + (h.coverage != null ? (h.coverage * 100).toFixed(1) + '%' : '\u2014') + '</td>' +
            '<td>' + (h.covered_auc != null ? h.covered_auc.toFixed(4) : '\u2014') + '</td>' +
            '<td>' + (h.demur_error_capture != null ? h.demur_error_capture.toFixed(4) : 'N/A') + '</td>' +
            '<td style="color:var(--fmc-slate);font-family:var(--fmc-mono);font-size:12px;">' + (h.demur_random_baseline != null ? h.demur_random_baseline.toFixed(2) : '\u2014') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
      }

      html += '</div></details>';
      return html;
    },

    /**
     * Load an external script if not already present
     */
    _loadScript: function(src, checkGlobal) {
      return new Promise(function(resolve, reject) {
        if (checkGlobal && window[checkGlobal]) { resolve(); return; }
        var script = document.createElement('script');
        script.src = src;
        if (src.indexOf('unpkg.com') !== -1) script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = function() { reject(new Error('Failed to load: ' + src)); };
        document.head.appendChild(script);
      });
    },

    /**
     * Initialize sphere viewer (thumbnail + click-to-expand)
     */
    _initSphere: function(modelCard) {
      var thumb = modelCard.querySelector('.sphere-thumbnail');
      if (!thumb) return;

      var sessionId = thumb.getAttribute('data-session-id');
      if (!sessionId) return;

      var self = this;
      var backdrop = modelCard.querySelector('.sphere-modal-backdrop');
      var modalClose = modelCard.querySelector('.sphere-modal-close');
      var fullViewer = null;

      // Load required scripts then init thumbnail
      Promise.resolve()
        .then(function() { return self._loadScript('https://unpkg.com/react@18/umd/react.production.min.js', 'React'); })
        .then(function() { return self._loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', 'ReactDOM'); })
        .then(function() { return self._loadScript('https://bits.featrix.com/sv/sphere-viewer.js', 'FeatrixSphereViewer'); })
        .then(function() {
          // Init thumbnail
          new FeatrixSphereViewer().init({
            sessionId: sessionId,
            containerId: 'featrix-sphere-thumb',
            isRotating: true,
            pointSize: 0.03,
            pointOpacity: 0.6,
            mode: 'thumbnail'
          });
        })
        .catch(function(err) {
          console.warn('FeatrixModelCard: Could not load sphere viewer:', err.message);
          thumb.style.display = 'none';
        });

      // Click thumbnail to open modal
      thumb.addEventListener('click', function() {
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (!fullViewer) {
          fullViewer = true;
          new FeatrixSphereViewer().init({
            sessionId: sessionId,
            containerId: 'featrix-sphere-full',
            isRotating: true,
            pointSize: 0.02,
            pointOpacity: 0.6,
            width: '100%',
            height: '100%',
            mode: 'full'
          });
        }
      });

      // Close modal
      function closeModal() {
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
      }
      if (modalClose) modalClose.addEventListener('click', closeModal);
      backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) closeModal();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && backdrop.classList.contains('active')) closeModal();
      });
    },

    attachEventListeners: function(containerElement) {
      containerElement = containerElement || document;
      
      // Find the model card container
      var modelCard = containerElement.querySelector ? 
        containerElement.querySelector('.featrix-model-card') :
        (containerElement.classList && containerElement.classList.contains('featrix-model-card') ? containerElement : null);
      
      if (!modelCard && containerElement.querySelector) {
        modelCard = containerElement.querySelector('.featrix-model-card');
      }
      if (!modelCard) {
        modelCard = containerElement;
      }
      
      var expandBtn = modelCard.querySelector('.featrix-expand-all');
      var collapseBtn = modelCard.querySelector('.featrix-collapse-all');
      
      if (expandBtn) {
        expandBtn.addEventListener('click', function() {
          var details = modelCard.querySelectorAll('details');
          details.forEach(function(detail) {
            detail.open = true;
          });
        });
      }
      
      if (collapseBtn) {
        collapseBtn.addEventListener('click', function() {
          var details = modelCard.querySelectorAll('details');
          details.forEach(function(detail) {
            detail.open = false;
          });
        });
      }

      // Epoch tab switching — scoped to exclude .sp-strategy-tab, which shares the .epoch-tab
      // class for styling but has its own data-sp-tab attribute and its own handler below.
      var epochTabs = modelCard.querySelectorAll('.epoch-tab:not(.sp-strategy-tab)');
      epochTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var tabId = this.getAttribute('data-tab');
          var container = this.closest('.section-content');

          // Deactivate all tabs and content
          container.querySelectorAll('.epoch-tab:not(.sp-strategy-tab)').forEach(function(t) { t.classList.remove('active'); });
          container.querySelectorAll('.epoch-tab-content:not(.sp-strategy-content)').forEach(function(c) { c.classList.remove('active'); });

          // Activate clicked tab and corresponding content
          this.classList.add('active');
          var target = container.querySelector('.epoch-tab-content:not(.sp-strategy-content)[data-tab="' + tabId + '"]');
          if (target) target.classList.add('active');
        });
      });

      var rawJsonBtn = modelCard.querySelector('.featrix-raw-json');
      var rawJsonPanel = modelCard.querySelector('.featrix-raw-json-panel');

      if (rawJsonBtn && rawJsonPanel) {
        rawJsonBtn.addEventListener('click', function() {
          if (rawJsonPanel.style.display === 'none') {
            rawJsonPanel.style.display = 'block';
            rawJsonBtn.textContent = 'Hide JSON';
          } else {
            rawJsonPanel.style.display = 'none';
            rawJsonBtn.textContent = 'Raw JSON';
          }
        });
      }

      var copyJsonBtn = modelCard.querySelector('.featrix-copy-json');
      if (copyJsonBtn && rawJsonPanel) {
        copyJsonBtn.addEventListener('click', function() {
          var jsonText = rawJsonPanel.querySelector('pre').textContent;
          navigator.clipboard.writeText(jsonText).then(function() {
            var origText = copyJsonBtn.textContent;
            copyJsonBtn.textContent = 'Copied!';
            setTimeout(function() {
              copyJsonBtn.textContent = origText;
            }, 1500);
          });
        });
      }

      // Strategy tabs for selective prediction
      var strategyTabs = modelCard.querySelectorAll('.sp-strategy-tab');
      strategyTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var tabId = this.getAttribute('data-sp-tab');
          var container = this.closest('.section-content');
          container.querySelectorAll('.sp-strategy-tab').forEach(function(t) { t.classList.remove('active'); });
          container.querySelectorAll('.sp-strategy-content').forEach(function(c) { c.classList.remove('active'); });
          this.classList.add('active');
          var target = container.querySelector('.sp-strategy-content[data-sp-tab="' + tabId + '"]');
          if (target) target.classList.add('active');
        });
      });

      // Initialize sphere viewer if thumbnail is present
      this._initSphere(modelCard);
    },

    /**
     * Start polling for model card updates during training.
     * Stops automatically when status changes away from TRAINING.
     *
     * @param {Object} options
     * @param {HTMLElement} options.container - DOM element that holds the rendered card
     * @param {Function} options.fetchModelCard - async function returning the model card JSON
     * @param {number} [options.intervalMs=15000] - polling interval in ms
     * @param {Object} [options.renderOptions] - options passed to renderHTML
     * @returns {Function} stop - call to cancel polling
     */
    startTrainingPoll: function(options) {
      var self = this;
      var container = options.container;
      var fetchModelCard = options.fetchModelCard;
      var intervalMs = options.intervalMs || 15000;
      var renderOptions = options.renderOptions || {};
      var timerId = null;

      function poll() {
        fetchModelCard().then(function(json) {
          if (!json) return;
          container.innerHTML = self.renderHTML(json, renderOptions);
          self.attachEventListeners(container);

          var status = ((json.model_identification || {}).status || '').toLowerCase();
          if (status === 'training') {
            timerId = setTimeout(poll, intervalMs);
          }
        }).catch(function(err) {
          console.warn('FeatrixModelCard: poll error:', err.message);
          timerId = setTimeout(poll, intervalMs);
        });
      }

      timerId = setTimeout(poll, intervalMs);

      return function stop() {
        if (timerId) { clearTimeout(timerId); timerId = null; }
      };
    },

    /**
     * Render complete HTML model card
     */
    renderGenerating: function(modelCardJson) {
      var message = modelCardJson.message || 'Model card is being generated.';
      var MAX_RETRIES = 5;
      var RELOAD_SECS = 30;
      var storageKey = 'featrix_mc_retries_' + (modelCardJson.session_id || 'default');

      return `
<div class="featrix-model-card">
  <style>
    .featrix-mc-generating { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 40px; text-align: center; }
    .featrix-mc-spinner { width: 48px; height: 48px; border: 4px solid #dde0e5; border-top-color: #8a5a1e; border-radius: 50%; animation: featrix-spin 0.9s linear infinite; margin-bottom: 24px; }
    @keyframes featrix-spin { to { transform: rotate(360deg); } }
    .featrix-mc-generating h2 { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Menlo, Consolas, monospace; font-size: 17px; font-weight: 700; color: #14171c; margin-bottom: 8px; }
    .featrix-mc-generating p { font-size: 14px; color: #454b56; margin-bottom: 4px; }
    .featrix-mc-countdown { font-size: 13px; color: #6b7280; margin-top: 16px; }
    .featrix-mc-giveup { font-size: 13px; color: #6b7280; margin-top: 16px; }
  </style>
  <div class="featrix-mc-generating" id="featrix-generating-state">
    <div class="featrix-mc-spinner"></div>
    <h2>Model Card Generating</h2>
    <p>${message}</p>
    <div class="featrix-mc-countdown" id="featrix-countdown"></div>
    <div class="featrix-mc-giveup" id="featrix-giveup" style="display:none;">
      Still generating &mdash; <a href="" onclick="location.reload();return false;">reload manually</a>
    </div>
  </div>
  <script>
    (function() {
      var MAX_RETRIES = ${MAX_RETRIES};
      var RELOAD_SECS = ${RELOAD_SECS};
      var key = '${storageKey}';
      var retries = parseInt(sessionStorage.getItem(key) || '0', 10);
      var countdownEl = document.getElementById('featrix-countdown');
      var giveupEl = document.getElementById('featrix-giveup');

      if (retries >= MAX_RETRIES) {
        if (countdownEl) countdownEl.style.display = 'none';
        if (giveupEl) giveupEl.style.display = '';
        return;
      }

      sessionStorage.setItem(key, retries + 1);
      var remaining = RELOAD_SECS;
      function tick() {
        if (countdownEl) countdownEl.textContent = 'Refreshing in ' + remaining + 's\u2026 (attempt ' + (retries + 1) + ' of ' + MAX_RETRIES + ')';
        if (remaining <= 0) { location.reload(); return; }
        remaining--;
        setTimeout(tick, 1000);
      }
      tick();
    })();
  </script>
</div>`;
    },

    renderBadInput: function(modelCardJson) {
      var EXPECTED_KEYS = [
        'model_identification', 'best_epochs', 'class_imbalance', 'embedding_space',
        'coverage', 'selective_prediction', 'training_optimization', 'data_processing_notes',
        'model_fit', 'disk_usage', 'training_dataset', 'model_architecture'
      ];
      var OLD_SCHEMA_KEYS = ['training_metrics', 'model_quality', 'feature_inventory', 'column_statistics'];

      var foundKeys = modelCardJson ? Object.keys(modelCardJson) : [];

      // Case 1: model card buried inside a wrapper object
      var buriedKey = null;
      var buriedCard = null;
      for (var i = 0; i < foundKeys.length; i++) {
        var val = modelCardJson[foundKeys[i]];
        if (val && typeof val === 'object' && !Array.isArray(val) && val.model_identification) {
          buriedKey = foundKeys[i];
          buriedCard = val;
          break;
        }
      }

      // Case 2: looks like old/wrong backend schema
      var oldSchemaMatches = foundKeys.filter(function(k) { return OLD_SCHEMA_KEYS.indexOf(k) >= 0; });
      var expectedMatches = foundKeys.filter(function(k) { return EXPECTED_KEYS.indexOf(k) >= 0; });

      var css = '<style>' +
        '.featrix-mc-err { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px 40px; max-width: 900px; margin: 0 auto; }' +
        '.featrix-mc-err h2 { font-size: 18px; font-weight: 700; margin: 0 0 8px 0; }' +
        '.featrix-mc-err p { font-size: 14px; color: #444; margin: 6px 0; }' +
        '.featrix-mc-err code { background: #f0f0f0; padding: 2px 6px; font-size: 12px; border-radius: 2px; }' +
        '.featrix-mc-err .banner { padding: 16px 20px; border-left: 4px solid #e65100; background: #fff3e0; margin-bottom: 20px; }' +
        '.featrix-mc-err .banner.buried { border-color: #1565c0; background: #e3f2fd; }' +
        '.featrix-mc-err .key-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }' +
        '.featrix-mc-err .key { padding: 3px 8px; font-size: 12px; border-radius: 3px; font-family: monospace; }' +
        '.featrix-mc-err .key.known { background: #e8f5e9; color: #1b5e20; }' +
        '.featrix-mc-err .key.unknown { background: #fce4ec; color: #880e4f; }' +
        '.featrix-mc-err .key.old { background: #fff3e0; color: #e65100; }' +
        '.featrix-mc-err .schema { margin-top: 20px; border: 1px solid #ddd; padding: 16px 20px; background: #fafafa; }' +
        '.featrix-mc-err .schema h3 { font-size: 13px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; color: #555; }' +
        '.featrix-mc-err table { border-collapse: collapse; font-size: 13px; width: 100%; }' +
        '.featrix-mc-err th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #000; font-size: 12px; text-transform: uppercase; }' +
        '.featrix-mc-err td { padding: 6px 10px; border-bottom: 1px solid #eee; vertical-align: top; }' +
        '.featrix-mc-err td:first-child { font-family: monospace; font-size: 12px; white-space: nowrap; }' +
        '.featrix-mc-err .try-btn { margin-top: 16px; padding: 8px 16px; background: #1565c0; color: #fff; border: none; cursor: pointer; font-size: 13px; font-family: inherit; }' +
        '.featrix-mc-err .try-btn:hover { background: #0d47a1; }' +
        '</style>';

      var html = '<div class="featrix-model-card">' + css + '<div class="featrix-mc-err">';

      if (buriedCard) {
        // Case 1: found it buried — offer to render it
        html += '<div class="banner buried">' +
          '<h2>&#128269; Found a model card buried inside <code>' + buriedKey + '</code></h2>' +
          '<p>The top-level object isn\'t a model card, but <code>' + buriedKey + '.model_identification</code> exists. ' +
          'Pass <code>data.' + buriedKey + '</code> to <code>FeatrixModelCard.renderHTML()</code> instead.</p>' +
          '</div>';
        html += '<p>Rendering the buried card now:</p>';
        html += '</div></div>';
        // Actually render the buried card
        return html + this.renderHTML(buriedCard, {});
      }

      if (oldSchemaMatches.length >= 2 && expectedMatches.length <= 1) {
        // Case 2: old/different backend schema
        html += '<div class="banner">' +
          '<h2>&#9888;&#65039; Wrong JSON schema — this looks like raw backend model data, not a rendered model card</h2>' +
          '<p>Found old/internal keys: ' + oldSchemaMatches.map(function(k) { return '<code>' + k + '</code>'; }).join(', ') + '</p>' +
          '<p>The renderer expects a model card JSON produced by <code>_create_model_card_json()</code> in <code>single_predictor.py</code>. ' +
          'This looks like a different (possibly older) format.</p>' +
          '</div>';
      } else {
        html += '<div class="banner">' +
          '<h2>&#9888;&#65039; Unrecognized JSON — cannot render model card</h2>' +
          '<p>No <code>model_identification</code> key found at the top level.</p>' +
          '</div>';
      }

      // Show what keys were found vs expected
      html += '<p><strong>Keys found in your JSON:</strong></p><div class="key-list">';
      foundKeys.forEach(function(k) {
        var cls = EXPECTED_KEYS.indexOf(k) >= 0 ? 'known' : (OLD_SCHEMA_KEYS.indexOf(k) >= 0 ? 'old' : 'unknown');
        html += '<span class="key ' + cls + '">' + k + '</span>';
      });
      html += '</div>';
      html += '<p style="font-size:12px;color:#666;margin-top:4px;">' +
        '<span style="background:#e8f5e9;padding:1px 5px;font-size:11px;">green</span> = recognized &nbsp; ' +
        '<span style="background:#fff3e0;padding:1px 5px;font-size:11px;">orange</span> = old/wrong schema &nbsp; ' +
        '<span style="background:#fce4ec;padding:1px 5px;font-size:11px;">red</span> = unknown' +
        '</p>';

      // Schema reference table
      html += '<div class="schema"><h3>Expected top-level keys</h3><table>' +
        '<tr><th>Key</th><th>Required?</th><th>What it contains</th></tr>' +
        '<tr><td>model_identification</td><td>Yes</td><td>name, status, target_column, training_date, model_type, session_id</td></tr>' +
        '<tr><td>best_epochs</td><td>Recommended</td><td>best_roc_auc / best_pr_auc — each with classification_display_metadata.classification_metrics</td></tr>' +
        '<tr><td>class_imbalance</td><td>Recommended</td><td>total_samples, minority_class_count, imbalance_ratio, train/val_distribution</td></tr>' +
        '<tr><td>embedding_space</td><td>If ES model</td><td>num_parameters, num_layers, d_model, num_rows</td></tr>' +
        '<tr><td>coverage <em>or</em> selective_prediction</td><td>If SP model</td><td>strategies dict, summary, history</td></tr>' +
        '<tr><td>training_optimization</td><td>Optional</td><td>loss_function, focal_gamma, class_weights, optimization_priority</td></tr>' +
        '<tr><td>data_processing_notes</td><td>Optional</td><td>Array of {severity, category, message, columns, rows_affected}</td></tr>' +
        '<tr><td>model_fit</td><td>Optional</td><td>primary, per_intent, reference_table — model shape scores</td></tr>' +
        '<tr><td>disk_usage</td><td>Optional</td><td>best_model_path (used to extract session ID)</td></tr>' +
        '</table></div>';

      html += '</div></div>';
      return html;
    },

    renderHTML: function(modelCardJson, options) {
      options = options || {};

      // Detect "still generating" API response — render spinner + auto-reload
      if (modelCardJson && !modelCardJson.model_identification &&
          (modelCardJson.status === 'generating' || modelCardJson.message)) {
        return this.renderGenerating(modelCardJson);
      }

      // Detect bad/wrong/buried input and show a helpful diagnostic
      if (modelCardJson && !modelCardJson.model_identification) {
        return this.renderBadInput(modelCardJson);
      }

      var _mi = modelCardJson.model_identification || {};
      var modelName = _mi.name || _mi.target_column || 'Model Card';
      var now = new Date();
      var dateStr = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0') + ':' +
                    String(now.getSeconds()).padStart(2, '0');

      // Resolve session ID for sphere viewer
      var sphereSessionId = null;
      if (options.showSphere) {
        var mi = modelCardJson.model_identification || {};
        var du = modelCardJson.disk_usage || {};
        sphereSessionId = options.sessionId || mi.session_id || null;
        // If we have a best_model_path, try to extract the full predictor folder name
        if (!sphereSessionId && du.best_model_path) {
          var parts = du.best_model_path.split('/');
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].indexOf('predictor-') === 0) {
              sphereSessionId = parts[i];
              break;
            }
          }
        }
      }

      // Debug: log any expected fields that are missing/null so backend can see what's not being sent
      var mi2 = modelCardJson.model_identification || {};
      var du2 = modelCardJson.disk_usage || {};
      var missing = [];
      var check = function(label, path, value) {
        if (value === null || value === undefined) missing.push('  ' + label + ' (' + path + ')');
      };
      check('model_id / session_id', 'model_identification.model_id / session_id / disk_usage.best_model_path',
        mi2.model_id || mi2.session_id || du2.best_model_path);
      check('user_intent', 'model_identification.user_intent', mi2.user_intent);
      check('encoding_intent', 'model_identification.encoding_intent', mi2.encoding_intent);
      check('best_epochs', 'best_epochs', modelCardJson.best_epochs);
      check('class_imbalance', 'class_imbalance', modelCardJson.class_imbalance);
      check('training_optimization', 'training_optimization', modelCardJson.training_optimization);
      check('selective_prediction', 'coverage / selective_prediction', modelCardJson.coverage || modelCardJson.selective_prediction);
      check('embedding_space', 'embedding_space', modelCardJson.embedding_space);
      check('data_processing_notes', 'data_processing_notes',
        (modelCardJson.data_processing_notes && modelCardJson.data_processing_notes.length) ? true : null);
      if (missing.length > 0) {
        console.warn('[FeatrixModelCard] Missing/null fields in model card JSON (paste to backend for debugging):\n' + missing.join('\n'));
      }

      // Warn if there are unrecognized top-level keys alongside suspiciously missing sections
      var KNOWN_KEYS = [
        'model_identification', 'best_epochs', 'class_imbalance', 'embedding_space',
        'coverage', 'selective_prediction', 'training_optimization', 'data_processing_notes',
        'model_fit', 'disk_usage', 'training_dataset', 'model_architecture', 'model_stack',
        'single_predictor', 'training_configuration', 'provenance', 'technical_details'
      ];
      var OLD_SCHEMA_SIGNAL_KEYS = ['training_metrics', 'model_quality', 'feature_inventory', 'column_statistics'];
      var CARD_SIGNAL_KEYS = ['best_epochs', 'embedding_space', 'coverage', 'selective_prediction', 'class_imbalance'];
      var topKeys = Object.keys(modelCardJson);
      var unknownKeys = topKeys.filter(function(k) { return KNOWN_KEYS.indexOf(k) < 0; });
      var oldSignalKeys = topKeys.filter(function(k) { return OLD_SCHEMA_SIGNAL_KEYS.indexOf(k) >= 0; });
      // A valid modern card can legitimately carry legacy debug keys (training_metrics,
      // column_statistics, etc.) as extra siblings — only warn when the top level does NOT
      // already look like a real card, otherwise this fires on cards that render fine.
      var looksLikeValidCard = !!modelCardJson.model_identification &&
        CARD_SIGNAL_KEYS.some(function(k) { return modelCardJson[k] != null; });
      var schemaWarning = '';
      if (oldSignalKeys.length >= 1 && !looksLikeValidCard) {
        // Check if a better model card is buried inside one of the top-level keys
        var buriedKey = null;
        var buriedCard = null;
        for (var bk = 0; bk < topKeys.length; bk++) {
          var bval = modelCardJson[topKeys[bk]];
          if (bval && typeof bval === 'object' && !Array.isArray(bval) && bval.model_identification) {
            var bMatches = CARD_SIGNAL_KEYS.filter(function(k) { return bval[k] != null; });
            if (bMatches.length > 0) { buriedKey = topKeys[bk]; buriedCard = bval; break; }
          }
        }
        if (buriedCard) {
          var buriedBanner = '<div style="margin:0 0 20px 0;padding:14px 18px;background:#e3f2fd;border-left:4px solid #1565c0;font-size:13px;">' +
            '<strong style="color:#1565c0;">ℹ Found a more complete model card inside <code style="font-size:12px;">' + buriedKey + '</code></strong> — ' +
            'rendering that instead. Pass <code style="font-size:12px;">data.' + buriedKey + '</code> directly to avoid this.' +
            '</div>';
          var buriedRendered = this.renderHTML(buriedCard, options);
          // Inject banner right after the opening <div class="page"> so it appears at the top
          return buriedRendered.replace('<div class="page">', '<div class="page">' + buriedBanner);
        }
        var warnKeys = oldSignalKeys.length ? oldSignalKeys : unknownKeys.slice(0, 6);
        schemaWarning = '<div style="margin:0 0 20px 0;padding:14px 18px;background:#fff8e1;border-left:4px solid #f9a825;font-size:13px;">' +
          '<strong style="color:#e65100;">⚠ Unexpected JSON shape</strong> — ' +
          (oldSignalKeys.length
            ? 'This looks like raw backend model data rather than a model card. Found internal keys: <code style="font-size:12px;">' + oldSignalKeys.join('</code>, <code style="font-size:12px;">') + '</code>. '
            : 'Found ' + unknownKeys.length + ' unrecognized top-level keys: <code style="font-size:12px;">' + warnKeys.join('</code>, <code style="font-size:12px;">') + (unknownKeys.length > 6 ? '…' : '') + '</code>. ') +
          'Expected keys like <code style="font-size:12px;">model_identification</code>, <code style="font-size:12px;">best_epochs</code>, <code style="font-size:12px;">class_imbalance</code>. ' +
          'You may be passing the full model object instead of the model card JSON.' +
          '</div>';
      }

      var sections = [
        this.renderModelIdentification(modelCardJson, sphereSessionId),
        this.renderModelFit(modelCardJson),
        this.renderEmbeddingSpace(modelCardJson),
        this.renderRankingMetrics(modelCardJson),
        this.renderProbes(modelCardJson, options.probes || null),
        this.renderBestEpochs(modelCardJson),
        this.renderSelectivePrediction(modelCardJson),
        this.renderTrainingOptimization(modelCardJson),
        this.renderTrainingDataset(modelCardJson),
        this.renderFeatureInventory(modelCardJson),
        this.renderModelArchitecture(modelCardJson),
        this.renderDataProcessingNotes(modelCardJson)
      ].join('');

      // Return a fragment wrapped in a scoped container, not a full HTML document
      return `
<div class="featrix-model-card">
    <style>
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
        .featrix-model-card .page { max-width: 1400px; margin: 0 auto; padding: 20px 40px; color: var(--fmc-ink); }

        .featrix-model-card .header { border-bottom: 2px solid var(--fmc-ink); padding-bottom: 10px; margin-bottom: 15px; color: var(--fmc-ink); }
        .featrix-model-card .header h1 { font-family: var(--fmc-mono); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--fmc-ink); margin-bottom: 4px; }
        .featrix-model-card .header .meta { font-family: var(--fmc-mono); font-size: 12px; color: var(--fmc-slate); }

        .featrix-model-card details { margin: 20px 0; border: 1px solid var(--fmc-line); border-radius: 5px; background: var(--fmc-paper); overflow: hidden; page-break-inside: avoid; color: var(--fmc-ink); }
        .featrix-model-card details summary { padding: 10px 20px; cursor: pointer; font-weight: 700; background: var(--fmc-mist-2); border-bottom: 1px solid var(--fmc-line); user-select: none; text-transform: uppercase; font-family: var(--fmc-mono); font-size: 11.5px; letter-spacing: 0.06em; color: var(--fmc-ink-soft); }
        .featrix-model-card details summary:hover { color: var(--fmc-ink); }
        .featrix-model-card details[open] summary { border-bottom: 1px solid var(--fmc-line); color: var(--fmc-ink-soft); }
        .featrix-model-card .fmc-summary-highlights { float: right; text-transform: none; font-weight: 400; letter-spacing: normal; color: var(--fmc-slate); font-size: 11.5px; font-family: var(--fmc-sans); white-space: nowrap; max-width: 60%; overflow: hidden; text-overflow: ellipsis; }
        .featrix-model-card details.section[open] > summary > .fmc-summary-highlights { display: none; }
        .featrix-model-card .section-content { padding: 22px; }

        .featrix-model-card .section { margin: 28px 0; page-break-inside: avoid; color: var(--fmc-ink); }
        .featrix-model-card .section-title { font-family: var(--fmc-mono); font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--fmc-ink); padding-bottom: 5px; margin-bottom: 15px; color: var(--fmc-ink); }

        .featrix-model-card .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--fmc-line); border: 1px solid var(--fmc-line); border-radius: 4px; overflow: hidden; color: var(--fmc-ink); }
        .featrix-model-card .metric { padding: 14px 15px; color: var(--fmc-ink); background: var(--fmc-paper); border: none; }
        .featrix-model-card .metric-label { font-family: var(--fmc-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; color: var(--fmc-slate); }
        .featrix-model-card .metric-value { font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 700; color: var(--fmc-ink); }

        .featrix-model-card table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--fmc-ink); }
        .featrix-model-card th { color: var(--fmc-slate); padding: 8px 12px; text-align: left; font-weight: 600; font-family: var(--fmc-mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 1px solid var(--fmc-line); }
        .featrix-model-card td { padding: 9px 12px; color: var(--fmc-ink); font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--fmc-line-soft); }
        .featrix-model-card tr:last-child td { border-bottom: none; }

        .featrix-model-card .epoch-tabs { display: flex; gap: 6px; margin-bottom: 0; border-bottom: 1px solid var(--fmc-line); flex-wrap: wrap; }
        .featrix-model-card .epoch-tab { padding: 8px 16px; background: none; border: 1px solid var(--fmc-line); border-bottom: none; cursor: pointer; font-size: 12px; font-weight: 700; font-family: var(--fmc-mono); margin-bottom: -1px; border-radius: 4px 4px 0 0; color: var(--fmc-slate); }
        .featrix-model-card .epoch-tab:hover { color: var(--fmc-ink); }
        .featrix-model-card .epoch-tab.active { background: var(--fmc-paper); color: var(--fmc-ink); border-color: var(--fmc-line); border-bottom: 1px solid var(--fmc-paper); position: relative; }
        .featrix-model-card .epoch-tab-content { display: none; }
        .featrix-model-card .epoch-tab-content.active { display: block; }
        .featrix-model-card .epoch-section { padding: 20px; background: var(--fmc-paper); border: 1px solid var(--fmc-line); border-top: none; }
        .featrix-model-card .epoch-title { margin: 0 0 15px 0; font-family: var(--fmc-mono); font-size: 13.5px; font-weight: 700; color: var(--fmc-ink); }
        .featrix-model-card .epoch-title .fmc-epoch-num { color: var(--fmc-slate); font-weight: 400; }

        .featrix-model-card .opt-strip { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .featrix-model-card .opt-label { font-size: 12.5px; color: var(--fmc-slate); }
        .featrix-model-card .fmc-badge-brass { display: inline-flex; align-items: center; font-family: var(--fmc-mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; padding: 4px 10px; border-radius: 3px; background: var(--fmc-brass-bg); color: var(--fmc-brass-strong); border: 1px solid var(--fmc-brass-border); }
        .featrix-model-card .fmc-tag { font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate); border: 1px solid var(--fmc-line); background: var(--fmc-mist); padding: 2px 7px; border-radius: 3px; }

        .featrix-model-card .confusion-wrapper { margin-top: 20px; }
        .featrix-model-card .confusion-title { margin: 0 0 15px 0; font-family: var(--fmc-mono); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--fmc-ink-soft); }
        .featrix-model-card .confusion-layout { display: flex; gap: 36px; align-items: flex-start; flex-wrap: wrap; }
        .featrix-model-card .cm-cell { border: 1px solid var(--fmc-paper); outline: 1px solid var(--fmc-line-soft); font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; font-size: 16px; font-weight: 700; }
        .featrix-model-card .cm-correct { background: var(--fmc-good-bg); color: var(--fmc-good); }
        .featrix-model-card .cm-error { background: var(--fmc-bad-bg); color: var(--fmc-bad); }
        .featrix-model-card .derived-metrics { width: auto !important; display: inline-table; font-size: 13px; }
        .featrix-model-card .derived-metrics td { padding: 6px 12px; border: none; font-family: var(--fmc-mono); font-variant-numeric: tabular-nums; }
        .featrix-model-card .dm-value { text-align: right; }
        .featrix-model-card .dm-formula { color: var(--fmc-slate); }

        .featrix-model-card .show-more { margin-top: 15px; border: none; background: none; }
        .featrix-model-card .show-more summary { padding: 5px 0; cursor: pointer; font-size: 12px; color: var(--fmc-brass); background: none; border: none; font-weight: 600; text-transform: none; }
        .featrix-model-card .show-more summary:hover { color: var(--fmc-brass-strong); text-decoration: underline; }

        .featrix-model-card .controls {
            margin-bottom: 15px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .featrix-model-card .btn {
            padding: 6px 13px;
            background: var(--fmc-paper);
            color: var(--fmc-ink);
            border: 1px solid var(--fmc-line);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: var(--fmc-mono);
        }

        .featrix-model-card .btn:hover {
            border-color: var(--fmc-slate);
            color: var(--fmc-ink);
        }

        .featrix-model-card .btn-secondary {
            background: var(--fmc-paper);
            color: var(--fmc-ink-soft);
        }

        .featrix-model-card .btn-secondary:hover {
            border-color: var(--fmc-slate);
        }

        @keyframes featrix-training-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
        }
        .featrix-model-card .status-badge, .featrix-model-card .quality-badge, .featrix-model-card .severity-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 3px;
            color: white;
            font-family: var(--fmc-mono);
            font-size: 11.5px;
            font-weight: 700;
            letter-spacing: 0.02em;
        }
        .featrix-model-card .status-badge.training {
            animation: featrix-training-pulse 2s ease-in-out infinite;
        }
        .featrix-model-card .fmc-excluded-badge {
            display: inline-block;
            padding: 1px 7px;
            margin-left: 6px;
            border-radius: 3px;
            background: var(--fmc-warn-bg);
            color: var(--fmc-warn);
            border: 1px solid var(--fmc-warn);
            font-family: var(--fmc-mono);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.02em;
            cursor: help;
        }

        .featrix-model-card .warning-item {
            padding: 15px;
            margin-bottom: 15px;
            background: var(--fmc-warn-bg);
            border-left: 4px solid var(--fmc-warn);
            border-radius: 0 4px 4px 0;
            color: var(--fmc-ink);
        }

        .featrix-model-card .warning-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            color: var(--fmc-ink);
        }

        .featrix-model-card .warning-message {
            color: var(--fmc-ink);
        }

        .featrix-model-card code {
            background: var(--fmc-mist-2);
            padding: 2px 6px;
            border: 1px solid var(--fmc-line);
            border-radius: 3px;
            font-family: var(--fmc-mono);
            font-size: 12.5px;
            color: var(--fmc-ink);
        }

        .featrix-model-card h3 {
            color: var(--fmc-ink);
        }

        .featrix-model-card strong {
            color: var(--fmc-ink);
        }

        .featrix-model-card em {
            color: var(--fmc-ink);
        }

        .featrix-model-card .sphere-thumbnail {
            display: inline-block;
            width: 220px;
            height: 165px;
            background: #0a0515;
            border-radius: 6px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
            transition: box-shadow 0.2s;
        }
        .featrix-model-card .sphere-thumbnail:hover {
            box-shadow: 0 0 12px rgba(100, 100, 255, 0.4);
        }
        .featrix-model-card .sphere-thumbnail-inner {
            width: 100%;
            height: 100%;
        }
        .featrix-model-card .sphere-thumbnail-label {
            position: absolute;
            bottom: 6px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            pointer-events: none;
        }

        .featrix-model-card .sphere-modal-backdrop {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 99999;
            justify-content: center;
            align-items: center;
        }
        .featrix-model-card .sphere-modal-backdrop.active {
            display: flex;
        }
        .featrix-model-card .sphere-modal {
            width: 90vw;
            height: 80vh;
            background: #0a0515;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
        }
        .featrix-model-card .sphere-modal-close {
            position: absolute;
            top: 10px;
            right: 15px;
            z-index: 100000;
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.7);
            font-size: 28px;
            cursor: pointer;
            padding: 5px 10px;
            line-height: 1;
        }
        .featrix-model-card .sphere-modal-close:hover {
            color: #fff;
        }
        .featrix-model-card .sphere-modal-inner {
            width: 100%;
            height: 100%;
        }

        @media print {
            .featrix-model-card .page { padding: 0; max-width: 100%; }
            .featrix-model-card .section { page-break-inside: avoid; }
            .featrix-model-card .header { page-break-after: always; }
            .featrix-model-card .controls { display: none; }
            .featrix-model-card .sphere-thumbnail { display: none; }
            .featrix-model-card table { font-size: 10pt; }
            .featrix-model-card .grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
    </style>
    <div class="page">
        <div class="header">
            <h1>MODEL CARD: ${modelName.toUpperCase()}</h1>
            <div class="meta">
                <strong>Generated:</strong> ${dateStr} UTC
            </div>
        </div>
        
        <div class="controls">
            <button class="btn featrix-expand-all">Expand All</button>
            <button class="btn btn-secondary featrix-collapse-all">Collapse All</button>
            <button class="btn btn-secondary featrix-raw-json">Raw JSON</button>
        </div>

        <div class="featrix-raw-json-panel" style="display: none; margin: 20px 0; padding: 20px; background: var(--fmc-mist-2); border: 1px solid var(--fmc-line); border-radius: 5px; overflow: auto; max-height: 600px;">
            <div style="margin-bottom: 10px;"><button class="btn btn-secondary featrix-copy-json">Copy to Clipboard</button></div>
            <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: var(--fmc-mono); font-size: 12px;">${JSON.stringify(modelCardJson, null, 2)}</pre>
        </div>

        ${schemaWarning}${sections}
        <div class="sphere-modal-backdrop">
            <div class="sphere-modal">
                <button class="sphere-modal-close">&times;</button>
                <div class="sphere-modal-inner" id="featrix-sphere-full"></div>
            </div>
        </div>
        <div style="text-align: right; padding: 10px 0 5px 0; font-family: var(--fmc-mono); font-size: 11px; color: var(--fmc-slate);">FeatrixModelCard v${FeatrixModelCard.VERSION} (${FeatrixModelCard.BUILD})</div>
    </div>
</div>`;
    }
  };

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeatrixModelCard;
  } else {
    global.FeatrixModelCard = FeatrixModelCard;
  }
})(typeof window !== 'undefined' ? window : this);

