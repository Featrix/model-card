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

  const FeatrixModelCard = {
    VERSION: '0.3.1',

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
      return (value * 100).toFixed(2) + '%';
    },

    /**
     * Get color for status
     */
    getStatusColor: function(status) {
      var statusLower = (status || '').toLowerCase();
      if (statusLower === 'done' || statusLower === 'ready') return '#28a745';
      if (statusLower === 'training') return '#ffc107';
      if (statusLower === 'failed') return '#dc3545';
      return '#6c757d';
    },

    /**
     * Get color for quality assessment
     */
    getQualityColor: function(assessment) {
      if (!assessment) return '#6c757d';
      var assessmentLower = assessment.toLowerCase();
      if (assessmentLower === 'excellent') return '#28a745';
      if (assessmentLower === 'good') return '#007bff';
      if (assessmentLower === 'fair') return '#fff';
      if (assessmentLower === 'poor') return '#fd7e14';
      return '#6c757d';
    },

    getQualityStyle: function(assessment) {
      if (!assessment) return 'background-color: #6c757d;';
      var assessmentLower = assessment.toLowerCase();
      if (assessmentLower === 'fair') return 'background-color: #fff; color: #000; border: 1px solid #000;';
      return 'background-color: ' + this.getQualityColor(assessment) + ';';
    },

    /**
     * Get color for warning severity
     */
    getSeverityColor: function(severity) {
      var severityLower = (severity || '').toLowerCase();
      if (severityLower === 'high') return '#dc3545';
      if (severityLower === 'moderate') return '#ffc107';
      if (severityLower === 'low') return '#007bff';
      return '#6c757d';
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
    renderModelIdentification: function(data) {
      var mi = data.model_identification || {};
      var statusColor = this.getStatusColor(mi.status);

      // Try to get model ID from disk_usage.best_model_path first
      var du = data.disk_usage || {};
      var parsed = this.parseModelPath(du.best_model_path);
      var modelIdDisplay = parsed.sessionId || (mi.session_id ? mi.session_id.substring(0, 20) : 'N/A');
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

      // Map model type to display format
      var modelTypeDisplay = 'N/A';
      if (mi.model_type) {
        var modelTypeLower = mi.model_type.toLowerCase();
        var targetTypeLower = (mi.target_column_type || '').toLowerCase();

        if (modelTypeLower === 'embedding space' || modelTypeLower === 'es') {
          modelTypeDisplay = 'Foundational Embedding Space';
        } else if (modelTypeLower === 'single predictor' || modelTypeLower === 'sp') {
          if (targetTypeLower === 'set') {
            modelTypeDisplay = 'Binary Classifier';
          } else if (targetTypeLower === 'scalar') {
            modelTypeDisplay = 'Regression';
          } else {
            modelTypeDisplay = 'Single Predictor';
          }
        } else {
          modelTypeDisplay = mi.model_type;
        }
      }

      // Format framework - strip "unknown" suffix
      var frameworkDisplay = mi.framework || 'N/A';
      frameworkDisplay = frameworkDisplay.replace(/\s+unknown$/i, '').trim() || 'N/A';

      return `
    <details class="section" open>
        <summary>MODEL IDENTIFICATION</summary>
        <div class="section-content">
            <div class="grid">
                <div class="metric">
                    <div class="metric-label">Target Column</div>
                    <div class="metric-value" style="font-size: 20px;">${mi.target_column || 'N/A'}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Model Type</div>
                    <div class="metric-value" style="font-size: 20px;">${modelTypeDisplay}</div>
                </div>
                <div class="metric" style="background: #e3f2fd; border-color: #90caf9;">
                    <div class="metric-label" style="color: #1976d2;">Best ROC-AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: #1565c0;">${bestRocAuc !== null ? (bestRocAuc * 100).toFixed(1) + '%' : 'N/A'}</div>
                </div>
                <div class="metric" style="background: #e8f5e9; border-color: #a5d6a7;"${prevalence !== null ? ' title="Random baseline: ' + (prevalence * 100).toFixed(1) + '% (class prevalence)"' : ''}>
                    <div class="metric-label" style="color: #388e3c;">Best PR-AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: #2e7d32;">${bestPrAuc !== null ? (bestPrAuc * 100).toFixed(1) + '%' : 'N/A'}${prAucLift !== null ? ' <span style="font-size: 14px; font-weight: normal;">[' + prAucLift.toFixed(1) + 'x]</span>' : ''}</div>
                </div>
            </div>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; line-height: 2;">
                <span class="status-badge" style="background-color: ${statusColor}; font-size: 11px; padding: 2px 8px;">${((mi.status || 'N/A').toLowerCase() === 'done' ? 'READY' : (mi.status || 'N/A').toUpperCase())}</span>
                &nbsp;&nbsp;${mi.training_date || 'N/A'}
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Model:</strong> <code style="font-size: 11px;">${modelIdDisplay}</code>
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Cluster:</strong> ${(mi.compute_cluster || 'N/A').toUpperCase()}
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Dims:</strong> ${(data.embedding_space && data.embedding_space.d_model) || 'N/A'}
            </div>
        </div>
    </details>
      `;
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
      var es = data.embedding_space;
      var sp = data.single_predictor || data.predictor || {};
      var ma = data.model_architecture || {};
      var ms = (data.model_stack && data.model_stack[0]) || {};
      var ci = data.class_imbalance || {};
      if (!es) return '';

      var spRows = ci.total_samples || ms.rows || sp.num_rows || 0;
      var spLayers = ms.layers || ma.predictor_layers || sp.num_layers || 0;
      var spParams = ms.parameters || ma.predictor_parameters || sp.num_parameters || 0;

      var html = `
    <details class="section" open>
        <summary>MODEL STACK</summary>
        <div class="section-content">
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
                    <td style="color: #388e3c; font-weight: bold; white-space: nowrap;">Yes</td>
                    <td style="font-size: 18px; font-weight: bold;">${spRows.toLocaleString()}</td>
                    <td style="font-size: 18px; font-weight: bold;">${spLayers ? this.formatLargeNumber(spLayers) : 'N/A'}</td>
                    <td style="font-size: 18px; font-weight: bold;">${spParams ? this.formatLargeNumber(spParams) : 'N/A'}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold; white-space: nowrap;">Foundation</td>
                    <td style="color: #666; white-space: nowrap;">No</td>
                    <td style="font-size: 18px; font-weight: bold;">${(es.num_rows || 0).toLocaleString()}</td>
                    <td style="font-size: 18px; font-weight: bold;">${this.formatLargeNumber(es.num_layers)}</td>
                    <td style="font-size: 18px; font-weight: bold;">${this.formatLargeNumber(es.num_parameters)}</td>
                </tr>
            </table>
      `;

      // Top relationships - commented out for SP cards, use for ES cards only
      // if (es.top_relationships && es.top_relationships.length > 0) {
      //   html += '<h3 style="margin: 25px 0 15px 0; font-size: 14px; text-transform: uppercase; color: #666;">Top Relationships</h3>';
      //   html += '<table><tr><th>Direction</th><th>Type</th><th>Lift Score</th><th>Samples</th></tr>';
      //   for (var i = 0; i < es.top_relationships.length; i++) {
      //     var rel = es.top_relationships[i];
      //     html += '<tr>';
      //     html += '<td style="font-family: monospace;">' + (rel.direction || (rel.source_col + ' → ' + rel.target_col)) + '</td>';
      //     html += '<td>' + (rel.relationship_type || 'N/A') + '</td>';
      //     html += '<td>' + (typeof rel.lift_score === 'number' ? rel.lift_score.toFixed(4) : 'N/A') + '</td>';
      //     html += '<td>' + (rel.sample_count || 'N/A') + '</td>';
      //     html += '</tr>';
      //   }
      //   html += '</table>';
      // }

      html += '</div></details>';
      return html;
    },

    /**
     * Render training dataset section
     */
    renderTrainingDataset: function(data) {
      var td = data.training_dataset || {};
      var ci = data.class_imbalance || {};

      var train0 = (ci.train_distribution && ci.train_distribution['0']) || 0;
      var train1 = (ci.train_distribution && ci.train_distribution['1']) || 0;
      var val0 = (ci.val_distribution && ci.val_distribution['0']) || 0;
      var val1 = (ci.val_distribution && ci.val_distribution['1']) || 0;
      var totalTrain = train0 + train1;
      var totalVal = val0 + val1;
      var totalSamples = ci.total_samples || td.train_rows || (totalTrain + totalVal) || 0;

      var html = `
    <details class="section" open>
        <summary>TRAINING DATASET</summary>
        <div class="section-content">
      `;

      // Class distribution table
      if (ci.class_distribution || ci.train_distribution) {
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
                    <td style="text-align: right; font-weight: bold;">${totalTrain.toLocaleString()}</td>
                </tr>
                <tr>
                    <td><strong>Validation</strong></td>
                    <td style="text-align: right;">${val1.toLocaleString()}</td>
                    <td style="text-align: right;">${val0.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold;">${totalVal.toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="border-top: 2px solid #333;"><strong>Total</strong></td>
                    <td style="text-align: right; font-weight: bold; border-top: 2px solid #333;">${(ci.minority_class_count || (train1 + val1)).toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold; border-top: 2px solid #333;">${(ci.majority_class_count || (train0 + val0)).toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold; border-top: 2px solid #333;">${totalSamples.toLocaleString()}</td>
                </tr>
            </table>
            <div style="margin-top: 15px; color: #666; font-size: 13px;">
                Imbalance ratio: <strong>${ci.imbalance_ratio || 'N/A'}:1</strong> (minority class is ${((ci.minority_class_count || 0) / totalSamples * 100).toFixed(1)}% of data)
            </div>
        `;
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
                <div class="metric-value">${cm.precision !== null && cm.precision !== undefined ? cm.precision.toFixed(3) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label" title="How many true rare events we catch">Recall</div>
                <div class="metric-value">${cm.recall !== null && cm.recall !== undefined ? cm.recall.toFixed(3) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">F1 Score</div>
                <div class="metric-value">${cm.f1 !== null && cm.f1 !== undefined ? cm.f1.toFixed(3) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">AUC</div>
                <div class="metric-value">${cm.auc !== null && cm.auc !== undefined ? cm.auc.toFixed(3) : 'N/A'}</div>
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

      var self = this;

      function renderMetricsTable(metrics) {
        if (!metrics) return '';
        var html = '<table>';
        html += '<tr><th>Metric</th><th>Value</th></tr>';

        var metricOrder = ['accuracy', 'auc', 'pr_auc', 'f1', 'precision', 'recall', 'specificity'];
        for (var i = 0; i < metricOrder.length; i++) {
          var key = metricOrder[i];
          var m = metrics[key];
          if (!m) continue;
          html += '<tr>';
          html += '<td style="text-transform: uppercase; font-weight: bold;">' + key.replace('_', ' ') + '</td>';
          html += '<td style="font-size: 18px; font-weight: bold;">' + (typeof m.value === 'number' ? (m.value * 100).toFixed(2) + '%' : 'N/A') + '</td>';
          html += '</tr>';
        }
        html += '</table>';
        return html;
      }

      function renderConfusionMatrix(cm) {
        if (!cm) return '';
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
        html += '<div style="display: inline-block;">';
        html += '<div style="text-align: center; font-size: 11px; color: #666; margin-left: 80px; margin-bottom: 2px;">Predicted</div>';
        html += '<div style="display: flex; margin-left: 80px; margin-bottom: 2px;"><div style="width: 70px; text-align: center; font-size: 11px; color: #666;">Pos</div><div style="width: 70px; text-align: center; font-size: 11px; color: #666;">Neg</div></div>';
        html += '<div style="display: flex; align-items: center; margin-bottom: 2px;">';
        html += '<div style="width: 40px; font-size: 11px; color: #666; text-align: center; writing-mode: vertical-lr; transform: rotate(180deg);">Actual</div>';
        html += '<div style="width: 38px; font-size: 11px; color: #666; text-align: right; padding-right: 4px;">Pos</div>';
        html += '<div class="cm-cell cm-correct" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + tp + '</div>';
        html += '<div class="cm-cell cm-error" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + fn + '</div>';
        html += '</div>';
        html += '<div style="display: flex; align-items: center;">';
        html += '<div style="width: 40px;"></div>';
        html += '<div style="width: 38px; font-size: 11px; color: #666; text-align: right; padding-right: 4px;">Neg</div>';
        html += '<div class="cm-cell cm-error" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + fp + '</div>';
        html += '<div class="cm-cell cm-correct" style="width: 70px; height: 55px; display: flex; align-items: center; justify-content: center;">' + tn + '</div>';
        html += '</div>';
        html += '</div>';

        // Derived metrics
        html += '<table class="derived-metrics">';
        html += '<tr><td><strong>Hit Rate</strong> (Recall)</td><td class="dm-value">' + (hitRate * 100).toFixed(1) + '%</td><td class="dm-formula">TP / (TP+FN)</td></tr>';
        html += '<tr><td><strong>Miss Rate</strong></td><td class="dm-value">' + (missRate * 100).toFixed(1) + '%</td><td class="dm-formula">FN / (TP+FN)</td></tr>';
        html += '<tr><td><strong>Specificity</strong> (TNR)</td><td class="dm-value">' + (specificity * 100).toFixed(1) + '%</td><td class="dm-formula">TN / (TN+FP)</td></tr>';
        html += '<tr><td><strong>False Alarm</strong> (FPR)</td><td class="dm-value">' + (falseAlarmRate * 100).toFixed(1) + '%</td><td class="dm-formula">FP / (TN+FP)</td></tr>';
        html += '<tr><td><strong>Precision</strong> (PPV)</td><td class="dm-value">' + (precision * 100).toFixed(1) + '%</td><td class="dm-formula">TP / (TP+FP)</td></tr>';
        html += '</table>';

        html += '</div></div>';
        return html;
      }

      function renderEpochSection(title, epochData) {
        if (!epochData) return '';
        var cdm = epochData.classification_display_metadata || {};
        var html = '<div class="epoch-section">';
        html += '<h3 class="epoch-title">' + title + ' — Epoch ' + (epochData.epoch || cdm.epoch || 'N/A') + '</h3>';
        html += renderMetricsTable(cdm.classification_metrics);
        html += renderConfusionMatrix(cdm.confusion_matrix);

        // Per-row tracking summary
        var prt = cdm.per_row_tracking;
        if (prt && (prt.this_epoch || prt.cumulative_categories)) {
          html += '<details class="show-more">';
          html += '<summary>Show per-row tracking</summary>';
          if (prt.this_epoch) {
            html += '<h4 style="margin: 15px 0 10px 0; font-size: 13px; font-weight: bold; color: #333;">This Epoch</h4>';
            html += '<table style="width: auto;">';
            html += '<tr><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr>';
            html += '<tr><td style="font-size: 18px; font-weight: bold; color: #388e3c;">' + prt.this_epoch.correct + '</td>';
            html += '<td style="font-size: 18px; font-weight: bold; color: #d32f2f;">' + prt.this_epoch.wrong + '</td>';
            html += '<td style="font-size: 18px; font-weight: bold;">' + prt.this_epoch.accuracy_pct.toFixed(1) + '%</td></tr>';
            html += '</table>';
          }
        }
        if (prt && prt.cumulative_categories) {
          var cc = prt.cumulative_categories;
          html += '<h4 style="margin: 15px 0 10px 0; font-size: 13px; font-weight: bold; color: #333;">Cumulative</h4>';
          html += '<table style="width: auto;">';
          html += '<tr><th>Never Wrong</th><th>Rarely</th><th>Sometimes</th><th>Frequently</th><th>Always Wrong</th></tr>';
          html += '<tr>';
          html += '<td style="font-weight: bold; color: #388e3c;">' + cc.never_wrong + '</td>';
          html += '<td style="font-weight: bold; color: #689f38;">' + cc.rarely_wrong + '</td>';
          html += '<td style="font-weight: bold; color: #ffa000;">' + cc.sometimes_wrong + '</td>';
          html += '<td style="font-weight: bold; color: #f57c00;">' + cc.frequently_wrong + '</td>';
          html += '<td style="font-weight: bold; color: #d32f2f;">' + cc.always_wrong + '</td>';
          html += '</tr></table>';
        }
        if (prt && (prt.this_epoch || prt.cumulative_categories)) {
          html += '</details>';
        }
        html += '</div>';
        return html;
      }

      var html = `
    <details class="section" open>
        <summary>MODEL DETAILS</summary>
        <div class="section-content">
            <div class="epoch-tabs">
                <button class="epoch-tab" data-tab="pr-auc">Best PR-AUC</button>
                <button class="epoch-tab active" data-tab="roc-auc">Best ROC-AUC</button>
            </div>
            <div class="epoch-tab-content" data-tab="pr-auc">
      `;

      html += renderEpochSection('Best PR-AUC', be.best_pr_auc);

      html += `
            </div>
            <div class="epoch-tab-content active" data-tab="roc-auc">
      `;

      html += renderEpochSection('Best ROC-AUC', be.best_roc_auc);

      html += '</div></div></details>';
      return html;
    },

    /**
     * Render training optimization section
     */
    renderTrainingOptimization: function(data) {
      var to = data.training_optimization;
      if (!to) return '';

      var html = `
    <details class="section" open>
        <summary>TRAINING OPTIMIZATION</summary>
        <div class="section-content">
      `;

      // Main description if available
      if (to.optimization_description) {
        html += '<div style="margin-bottom: 20px; padding: 12px 15px; background: #e3f2fd; border-left: 3px solid #1976d2; font-size: 14px;">';
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
        html += '<td>' + (to.checkpoint_value * 100).toFixed(2) + '% at epoch ' + (to.checkpoint_epoch || 'N/A') + '</td></tr>';
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

      // Epoch tab switching
      var epochTabs = modelCard.querySelectorAll('.epoch-tab');
      epochTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var tabId = this.getAttribute('data-tab');
          var container = this.closest('.section-content');

          // Deactivate all tabs and content
          container.querySelectorAll('.epoch-tab').forEach(function(t) { t.classList.remove('active'); });
          container.querySelectorAll('.epoch-tab-content').forEach(function(c) { c.classList.remove('active'); });

          // Activate clicked tab and corresponding content
          this.classList.add('active');
          container.querySelector('.epoch-tab-content[data-tab="' + tabId + '"]').classList.add('active');
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
    },

    /**
     * Render complete HTML model card
     */
    renderHTML: function(modelCardJson) {
      var modelName = (modelCardJson.model_identification || {}).name || 'Model Card';
      var now = new Date();
      var dateStr = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0') + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0') + ':' +
                    String(now.getSeconds()).padStart(2, '0');
      
      var sections = [
        this.renderModelIdentification(modelCardJson),
        this.renderEmbeddingSpace(modelCardJson),
        this.renderBestEpochs(modelCardJson),
        this.renderTrainingOptimization(modelCardJson),
        this.renderTrainingDataset(modelCardJson)
      ].join('');
      
      // Return a fragment wrapped in a scoped container, not a full HTML document
      return `
<div class="featrix-model-card">
    <style>
        .featrix-model-card * { margin: 0; padding: 0; box-sizing: border-box; color: #000; }
        .featrix-model-card { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #000; line-height: 1.5; }
        .featrix-model-card .page { max-width: 1400px; margin: 0 auto; padding: 20px 40px; color: #000; }

        .featrix-model-card .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; color: #000; }
        .featrix-model-card .header h1 { font-size: 24px; font-weight: bold; color: #000; margin-bottom: 4px; }
        .featrix-model-card .header .meta { font-size: 12px; color: #666; }

        .featrix-model-card details { margin: 20px 0; border: 1px solid #ccc; background: white; page-break-inside: avoid; color: #000; }
        .featrix-model-card details summary { padding: 12px 20px; cursor: pointer; font-weight: bold; background: #f5f5f5; border-bottom: 1px solid #ccc; user-select: none; text-transform: uppercase; font-size: 13px; color: #333; }
        .featrix-model-card details summary:hover { background: #eee; color: #000; }
        .featrix-model-card details[open] summary { border-bottom: 1px solid #ccc; color: #333; }
        .featrix-model-card .section-content { padding: 20px; }

        .featrix-model-card .section { margin: 30px 0; page-break-inside: avoid; color: #000; }
        .featrix-model-card .section-title { font-size: 18px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; color: #000; }

        .featrix-model-card .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; color: #000; }
        .featrix-model-card .metric { padding: 15px; color: #000; background: #fff; border: 1px solid #ddd; }
        .featrix-model-card .metric-label { font-size: 11px; text-transform: uppercase; margin-bottom: 6px; color: #666; }
        .featrix-model-card .metric-value { font-size: 24px; font-weight: bold; color: #000; }

        .featrix-model-card table { width: 100%; border-collapse: collapse; font-size: 14px; color: #000; }
        .featrix-model-card th { color: #666; padding: 10px 12px; text-align: left; font-weight: normal; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #ddd; }
        .featrix-model-card td { padding: 10px 12px; color: #000; border-bottom: 1px solid #eee; }
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
        .featrix-model-card .confusion-layout { display: flex; gap: 30px; align-items: flex-start; flex-wrap: wrap; }
        .featrix-model-card .cm-cell { border: 1px solid #ccc; font-size: 18px; font-weight: bold; }
        .featrix-model-card .cm-correct { background: #e8f5e9; }
        .featrix-model-card .cm-error { background: #ffebee; }
        .featrix-model-card .derived-metrics { width: auto !important; display: inline-table; font-size: 13px; }
        .featrix-model-card .derived-metrics td { padding: 6px 12px; border: none; }
        .featrix-model-card .dm-value { text-align: right; }
        .featrix-model-card .dm-formula { color: #666; }

        .featrix-model-card .show-more { margin-top: 15px; border: none; background: none; }
        .featrix-model-card .show-more summary { padding: 5px 0; cursor: pointer; font-size: 12px; color: #1976d2; background: none; border: none; font-weight: normal; text-transform: none; }
        .featrix-model-card .show-more summary:hover { color: #1565c0; text-decoration: underline; }
        
        .featrix-model-card .controls {
            margin-bottom: 15px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .featrix-model-card .btn {
            padding: 6px 12px;
            background: #fff;
            color: #000;
            border: 1px solid #999;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
        }

        .featrix-model-card .btn:hover {
            background: #f0f0f0;
        }
        
        .featrix-model-card .btn-secondary {
            background: #fff;
            color: #000;
        }
        
        .featrix-model-card .btn-secondary:hover {
            background: #f5f5f5;
        }
        
        .featrix-model-card .status-badge, .featrix-model-card .quality-badge, .featrix-model-card .severity-badge {
            display: inline-block;
            padding: 4px 12px;
            color: white;
            font-size: 12px;
            font-weight: 600;
        }
        
        .featrix-model-card .warning-item {
            padding: 15px;
            margin-bottom: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            color: #000;
        }
        
        .featrix-model-card .warning-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            color: #000;
        }
        
        .featrix-model-card .warning-message {
            color: #000;
        }
        
        .featrix-model-card code {
            background: #fff;
            padding: 2px 6px;
            border: 1px solid #000;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #000;
        }
        
        .featrix-model-card h3 {
            color: #000;
        }
        
        .featrix-model-card strong {
            color: #000;
        }
        
        .featrix-model-card em {
            color: #000;
        }
        
        @media print { 
            .featrix-model-card .page { padding: 0; max-width: 100%; }
            .featrix-model-card .section { page-break-inside: avoid; }
            .featrix-model-card .header { page-break-after: always; }
            .featrix-model-card .controls { display: none; }
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

        <div class="featrix-raw-json-panel" style="display: none; margin: 20px 0; padding: 20px; background: #f5f5f5; border: 2px solid #000; overflow: auto; max-height: 600px;">
            <div style="margin-bottom: 10px;"><button class="btn btn-secondary featrix-copy-json">Copy to Clipboard</button></div>
            <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${JSON.stringify(modelCardJson, null, 2)}</pre>
        </div>

        ${sections}
        <div style="text-align: right; padding: 10px 0 5px 0; font-size: 11px; color: #ccc;">FeatrixModelCard v${FeatrixModelCard.VERSION}</div>
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

