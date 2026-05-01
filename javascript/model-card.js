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
    VERSION: '1.15',
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

      // Phase-aware rendering
      var training = this.isTraining(data);
      var phase = this.getTrainingPhase(data);
      var hideAucCards = training && phase === 'es';

      // Phase indicator
      var phaseIndicator = '';
      if (training && phase) {
        var phaseDesc = phase === 'es' ? 'Phase 1/2: Training Foundation Model' : 'Phase 2/2: Training Predictor';
        phaseIndicator = '<div style="margin-bottom: 15px; padding: 8px 14px; background: #fff8e1; border-left: 3px solid #ffc107; font-size: 13px; color: #6d4c00;">' + phaseDesc + '</div>';
      }

      // User intent callout
      var userIntentHtml = '';
      if (mi.user_intent) {
        var ui = mi.user_intent;
        var objectiveDisplay = (ui.objective || '').replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var sourceDisplay = ui.source ? ui.source.replace(/_/g, ' ') : '';
        userIntentHtml = '<div style="margin-bottom:15px;padding:12px 16px;background:#ede7f6;border-left:3px solid #7b1fa2;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">' +
          '<span style="font-size:11px;text-transform:uppercase;color:#7b1fa2;font-weight:bold;white-space:nowrap;">Objective</span>' +
          '<span style="font-size:18px;font-weight:bold;color:#4a148c;">' + objectiveDisplay + '</span>' +
          '<span style="font-size:12px;color:#7b1fa2;">' + (ui.task || '') + '</span>' +
          (sourceDisplay ? '<span style="font-size:11px;color:#9c4dcc;margin-left:auto;">' + sourceDisplay + '</span>' : '') +
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
            barHtml = '<div style="display: inline-block; width: 120px; height: 8px; background: #e0e0e0; border-radius: 4px; vertical-align: middle; margin-left: 10px;">' +
                      '<div style="width: ' + pct + '%; height: 100%; background: #ffc107; border-radius: 4px;"></div></div>' +
                      ' <span style="font-size: 11px; color: #999;">' + pct + '%</span>';
          }
          epochProgress = '<div style="margin-top: 10px; font-size: 13px; color: #555;"><strong>' + epochText + '</strong>' + barHtml + '</div>';
        }
      }

      // AUC hero cards (hidden during ES training)
      var aucCards = '';
      if (!hideAucCards) {
        aucCards = `
                <div class="metric" style="background: #e3f2fd; border-color: #90caf9;">
                    <div class="metric-label" style="color: #1976d2;">Best ROC-AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: #1565c0;">${bestRocAuc !== null ? bestRocAuc.toFixed(4) : 'N/A'}</div>
                </div>
                <div class="metric" style="background: #e8f5e9; border-color: #a5d6a7;"${prevalence !== null ? ' title="Random baseline: ' + (prevalence * 100).toFixed(1) + '% (class prevalence)"' : ''}>
                    <div class="metric-label" style="color: #388e3c;">Best PR-AUC</div>
                    <div class="metric-value" style="font-size: 28px; color: #2e7d32;">${bestPrAuc !== null ? bestPrAuc.toFixed(4) : 'N/A'}${prAucLift !== null ? ' <span style="font-size: 14px; font-weight: normal;">[' + prAucLift.toFixed(1) + 'x]</span>' : ''}</div>
                </div>`;
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
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; line-height: 2;">
                <span class="status-badge${(mi.status || '').toLowerCase() === 'training' ? ' training' : ''}" style="background-color: ${statusColor}; font-size: 11px; padding: 2px 8px;">${((mi.status || 'N/A').toLowerCase() === 'done' ? 'READY' : (mi.status || 'N/A').toUpperCase())}</span>
                &nbsp;&nbsp;${mi.training_date || 'N/A'}
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Model:</strong> <code style="font-size: 11px;">${modelIdDisplay}</code>
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Cluster:</strong> ${(mi.compute_cluster || 'N/A').toUpperCase()}
                &nbsp;&nbsp;•&nbsp;&nbsp;<strong>Dims:</strong> ${(data.embedding_space && data.embedding_space.d_model) || 'N/A'}
                ${mi.encoding_intent ? '&nbsp;&nbsp;•&nbsp;&nbsp;<strong>Encoding:</strong> ' + mi.encoding_intent : ''}
                ${epochProgress}
            </div>${sphereSessionId ? `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
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

      var minClass = ci.minority_class || '1';
      var majClass = ci.majority_class || '0';
      var train0 = (ci.train_distribution && (ci.train_distribution[majClass] || ci.train_distribution['0'])) || 0;
      var train1 = (ci.train_distribution && (ci.train_distribution[minClass] || ci.train_distribution['1'])) || 0;
      var val0 = (ci.val_distribution && (ci.val_distribution[majClass] || ci.val_distribution['0'])) || 0;
      var val1 = (ci.val_distribution && (ci.val_distribution[minClass] || ci.val_distribution['1'])) || 0;
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

      function renderMetricsTable(metrics) {
        if (!metrics) return '';
        var html = '<table>';
        html += '<tr><th>Metric</th><th>Value</th></tr>';

        var metricOrder = ['accuracy', 'auc', 'pr_auc', 'f1'];
        for (var i = 0; i < metricOrder.length; i++) {
          var key = metricOrder[i];
          var m = metrics[key];
          if (!m) continue;
          html += '<tr>';
          html += '<td style="text-transform: uppercase; font-weight: bold;">' + key.replace('_', ' ') + '</td>';
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
        html += '<tr><td><strong>Hit Rate</strong> (Recall)</td><td class="dm-value">' + hitRate.toFixed(4) + '</td><td class="dm-formula">TP / (TP+FN)</td></tr>';
        html += '<tr><td><strong>Miss Rate</strong></td><td class="dm-value">' + missRate.toFixed(4) + '</td><td class="dm-formula">FN / (TP+FN)</td></tr>';
        html += '<tr><td><strong>Specificity</strong> (TNR)</td><td class="dm-value">' + specificity.toFixed(4) + '</td><td class="dm-formula">TN / (TN+FP)</td></tr>';
        html += '<tr><td><strong>False Alarm</strong> (FPR)</td><td class="dm-value">' + falseAlarmRate.toFixed(4) + '</td><td class="dm-formula">FP / (TN+FP)</td></tr>';
        html += '<tr><td><strong>Precision</strong> (PPV)</td><td class="dm-value">' + precision.toFixed(4) + '</td><td class="dm-formula">TP / (TP+FP)</td></tr>';
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
        html += '<td>' + to.checkpoint_value.toFixed(4) + ' at epoch ' + (to.checkpoint_epoch || 'N/A') + '</td></tr>';
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

      var severityColor = { info: '#1976d2', warning: '#f57c00', critical: '#c62828' };
      var severityBg   = { info: '#e3f2fd', warning: '#fff3e0', critical: '#ffebee' };
      var severityBorder = { info: '#90caf9', warning: '#ffcc02', critical: '#ef9a9a' };

      var categoryLabel = {
        column_dropped:   'Column Dropped',
        rows_filtered:    'Rows Filtered',
        type_detection:   'Type Detection',
        data_transform:   'Data Transform',
        csv_parsing:      'CSV Parsing',
        dataset_sampling: 'Dataset Sampling'
      };

      var html = '<details class="section" open><summary>DATA PROCESSING NOTES</summary><div class="section-content">';
      html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
      html += '<thead><tr style="border-bottom:2px solid #000;">';
      html += '<th style="text-align:left; padding:6px 10px; width:110px;">Severity</th>';
      html += '<th style="text-align:left; padding:6px 10px; width:140px;">Category</th>';
      html += '<th style="text-align:left; padding:6px 10px;">Message</th>';
      html += '<th style="text-align:left; padding:6px 10px; width:180px;">Affected</th>';
      html += '</tr></thead><tbody>';

      notes.forEach(function(note) {
        var sev = (note.severity || 'info').toLowerCase();
        var cat = (note.category || '').toLowerCase();
        var color  = severityColor[sev]  || '#555';
        var bg     = severityBg[sev]     || '#f5f5f5';
        var border = severityBorder[sev] || '#ccc';
        var catText = categoryLabel[cat] || note.category || 'Note';

        var affected = [];
        if (note.columns && note.columns.length > 0) {
          affected.push(note.columns.map(function(c) {
            return '<code style="font-size:11px; background:#eee; padding:1px 4px; border-radius:3px;">' + c + '</code>';
          }).join(' '));
        }
        if (note.rows_affected != null) {
          affected.push(note.rows_affected.toLocaleString() + ' rows');
        }

        html += '<tr style="border-bottom:1px solid #eee; background:' + bg + ';">';
        html += '<td style="padding:8px 10px; vertical-align:top;">';
        html += '<span style="background:' + color + '; color:#fff; font-size:10px; font-weight:bold; padding:2px 7px; border-radius:3px; text-transform:uppercase;">' + sev + '</span>';
        html += '</td>';
        html += '<td style="padding:8px 10px; vertical-align:top; color:#444; font-size:12px;">' + catText + '</td>';
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
      var sp = data.selective_prediction;
      if (!sp) return '';

      function getDemurBadge(value, baseline) {
        if (value === null || value === undefined) return { text: 'N/A \u2014 answers everything', bg: '#6c757d', fg: 'white' };
        if (value === 1.0) return { text: 'PERFECT \u2713', bg: '#28a745', fg: 'white' };
        if (value > baseline + 0.05) return { text: 'BETTER THAN RANDOM', bg: '#28a745', fg: 'white' };
        if (Math.abs(value - baseline) <= 0.05) return { text: '\u2248 RANDOM', bg: '#ffc107', fg: '#000' };
        return { text: 'ANTI-ALIGNED \u26a0', bg: '#dc3545', fg: 'white' };
      }

      function renderSPEntry(entry) {
        if (!entry) return '';
        var dec = entry.demur_error_capture;
        var baseline = entry.demur_random_baseline;
        var isAlwaysAnswers = dec === null || dec === undefined;
        var badge = getDemurBadge(dec, baseline);
        var n_covered = entry.n_covered || 0;
        var n_total = entry.n_total || 0;
        var n_demurred = entry.n_demurred || 0;
        var coverage = entry.coverage || 0;
        var tp = entry.n_demurred_true_positives || 0;
        var fp = entry.n_demurred_false_positives || 0;
        var fn = entry.n_demurred_false_negatives || 0;
        var tn = entry.n_demurred_true_negatives || 0;

        var headlineHtml;
        if (isAlwaysAnswers) {
          headlineHtml = '<span class="quality-badge" style="background-color:#6c757d;color:white;">' + badge.text + '</span>';
        } else {
          headlineHtml = '<span style="font-size:22px;font-weight:bold;">' + dec.toFixed(4) + '</span>' +
            ' <span class="quality-badge" style="background-color:' + badge.bg + ';color:' + badge.fg + ';">' + badge.text + '</span>' +
            ' <span style="color:#666;font-size:12px;">vs ' + baseline.toFixed(2) + ' random</span>';
        }

        var auc_lift = entry.auc_lift || 0;
        var liftColor = auc_lift >= 0 ? '#28a745' : '#dc3545';
        var metricsHtml = '<div class="grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:15px;">' +
          '<div class="metric"><div class="metric-label">Covered AUC</div><div class="metric-value" style="font-size:18px;">' + (entry.covered_auc || 0).toFixed(4) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Full AUC</div><div class="metric-value" style="font-size:18px;">' + (entry.full_auc || 0).toFixed(4) + '</div></div>' +
          '<div class="metric"><div class="metric-label">AUC Lift</div><div class="metric-value" style="font-size:18px;color:' + liftColor + ';">' + (auc_lift >= 0 ? '+' : '') + auc_lift.toFixed(4) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Coverage</div><div class="metric-value" style="font-size:18px;">' + (coverage * 100).toFixed(1) + '%</div></div>' +
          '<div class="metric"><div class="metric-label">Threshold</div><div class="metric-value" style="font-size:18px;">' + (entry.confidence_threshold || 0).toFixed(2) + '</div></div>' +
          '</div>';

        var tableHtml = '';
        if (!isAlwaysAnswers && n_demurred > 0) {
          var colH = 'style="color:#666;font-weight:normal;font-size:11px;text-transform:uppercase;padding:4px 12px;text-align:center;"';
          var rowL = 'style="color:#666;font-size:11px;text-transform:uppercase;padding:4px 12px;white-space:nowrap;"';
          var cellNorm = 'style="border:1px solid #ddd;background:#f5f5f5;padding:10px 18px;text-align:center;font-weight:bold;font-size:16px;min-width:80px;"';
          var cellHl = 'style="border:1px solid #c8e6c9;background:#e8f5e9;padding:10px 18px;text-align:center;font-weight:bold;font-size:16px;color:#2e7d32;min-width:80px;"';
          tableHtml = '<div style="margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0;font-size:13px;font-weight:bold;color:#333;">Declined rows \u2014 what they would have been</h4>' +
            '<table style="width:auto;">' +
            '<tr><th></th><th ' + colH + '>Actual +</th><th ' + colH + '>Actual \u2212</th></tr>' +
            '<tr><td ' + rowL + '>Would predict +</td>' +
            '<td ' + cellNorm + '>' + tp + '<br><span style="font-size:10px;font-weight:normal;color:#888;">thrown away</span></td>' +
            '<td ' + cellHl + '>' + fp + '<br><span style="font-size:10px;font-weight:normal;color:#388e3c;">error hidden \u2713</span></td></tr>' +
            '<tr><td ' + rowL + '>Would predict \u2212</td>' +
            '<td ' + cellHl + '>' + fn + '<br><span style="font-size:10px;font-weight:normal;color:#388e3c;">error hidden \u2713</span></td>' +
            '<td ' + cellNorm + '>' + tn + '<br><span style="font-size:10px;font-weight:normal;color:#888;">thrown away</span></td></tr>' +
            '</table></div>';
        }

        var contextHtml = '<div style="color:#555;font-size:13px;">Answered ' +
          n_covered.toLocaleString() + '/' + n_total.toLocaleString() +
          ' (' + (coverage * 100).toFixed(1) + '%) \u2014 declined ' + n_demurred.toLocaleString() + '</div>';

        return '<div style="margin-bottom:15px;">' + headlineHtml + '</div>' + metricsHtml + tableHtml + contextHtml;
      }

      var strategyOrder = ['best_always_answers', 'best_balanced_may_demur', 'best_detects_positives_may_demur', 'best_rules_out_negatives_may_demur'];
      var strategyLabels = {
        best_always_answers: 'Always Answers',
        best_balanced_may_demur: 'Balanced',
        best_detects_positives_may_demur: 'Detect Positives',
        best_rules_out_negatives_may_demur: 'Rule Out Negatives'
      };

      var html = '<details class="section" open><summary>SELECTIVE PREDICTION</summary><div class="section-content">';

      if (sp.summary) {
        html += '<h3 class="epoch-title">Summary</h3>';
        html += renderSPEntry(sp.summary);
      }

      if (sp.strategies) {
        var available = strategyOrder.filter(function(k) { return sp.strategies[k]; });
        if (available.length > 0) {
          if (sp.summary) html += '<div style="margin-top:25px;">';
          html += '<h3 class="epoch-title">Strategies</h3>';
          html += '<div class="epoch-tabs">';
          available.forEach(function(key, i) {
            html += '<button class="epoch-tab sp-strategy-tab' + (i === 0 ? ' active' : '') + '" data-sp-tab="' + key + '">' + strategyLabels[key] + '</button>';
          });
          html += '</div>';
          available.forEach(function(key, i) {
            html += '<div class="epoch-tab-content sp-strategy-content' + (i === 0 ? ' active' : '') + '" data-sp-tab="' + key + '">';
            html += '<div class="epoch-section">' + renderSPEntry(sp.strategies[key]) + '</div>';
            html += '</div>';
          });
          if (sp.summary) html += '</div>';
        }
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
    .featrix-mc-spinner { width: 48px; height: 48px; border: 4px solid #e0e0e0; border-top-color: #1565c0; border-radius: 50%; animation: featrix-spin 0.9s linear infinite; margin-bottom: 24px; }
    @keyframes featrix-spin { to { transform: rotate(360deg); } }
    .featrix-mc-generating h2 { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px; }
    .featrix-mc-generating p { font-size: 14px; color: #666; margin-bottom: 4px; }
    .featrix-mc-countdown { font-size: 13px; color: #999; margin-top: 16px; }
    .featrix-mc-giveup { font-size: 13px; color: #999; margin-top: 16px; }
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

    renderHTML: function(modelCardJson, options) {
      options = options || {};

      // Detect "still generating" API response — render spinner + auto-reload
      if (modelCardJson && !modelCardJson.model_identification &&
          (modelCardJson.status === 'generating' || modelCardJson.message)) {
        return this.renderGenerating(modelCardJson);
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

      var sections = [
        this.renderModelIdentification(modelCardJson, sphereSessionId),
        this.renderEmbeddingSpace(modelCardJson),
        this.renderBestEpochs(modelCardJson),
        this.renderSelectivePrediction(modelCardJson),
        this.renderTrainingOptimization(modelCardJson),
        this.renderTrainingDataset(modelCardJson),
        this.renderDataProcessingNotes(modelCardJson)
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
        
        @keyframes featrix-training-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
        }
        .featrix-model-card .status-badge, .featrix-model-card .quality-badge, .featrix-model-card .severity-badge {
            display: inline-block;
            padding: 4px 12px;
            color: white;
            font-size: 12px;
            font-weight: 600;
        }
        .featrix-model-card .status-badge.training {
            animation: featrix-training-pulse 2s ease-in-out infinite;
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

        <div class="featrix-raw-json-panel" style="display: none; margin: 20px 0; padding: 20px; background: #f5f5f5; border: 2px solid #000; overflow: auto; max-height: 600px;">
            <div style="margin-bottom: 10px;"><button class="btn btn-secondary featrix-copy-json">Copy to Clipboard</button></div>
            <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${JSON.stringify(modelCardJson, null, 2)}</pre>
        </div>

        ${sections}
        <div class="sphere-modal-backdrop">
            <div class="sphere-modal">
                <button class="sphere-modal-close">&times;</button>
                <div class="sphere-modal-inner" id="featrix-sphere-full"></div>
            </div>
        </div>
        <div style="text-align: right; padding: 10px 0 5px 0; font-size: 11px; color: #ccc;">FeatrixModelCard v${FeatrixModelCard.VERSION} (${FeatrixModelCard.BUILD})</div>
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

