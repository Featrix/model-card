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
      if (statusLower === 'done') return '#28a745';
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
      if (assessmentLower === 'fair') return '#ffc107';
      if (assessmentLower === 'poor') return '#fd7e14';
      return '#6c757d';
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
     * Render model identification section
     */
    renderModelIdentification: function(data) {
      var mi = data.model_identification || {};
      var statusColor = this.getStatusColor(mi.status);
      var sessionIdShort = mi.session_id ? mi.session_id.substring(0, 20) : 'N/A';
      
      // Map model type to display format
      var modelTypeDisplay = 'N/A';
      if (mi.model_type) {
        var modelTypeLower = mi.model_type.toLowerCase();
        var targetTypeLower = (mi.target_column_type || '').toLowerCase();
        
        if (modelTypeLower === 'embedding space' || modelTypeLower === 'es') {
          modelTypeDisplay = 'Foundational Embedding Space';
        } else if (modelTypeLower === 'single predictor' || modelTypeLower === 'sp') {
          if (targetTypeLower === 'set') {
            modelTypeDisplay = 'Classifier';
          } else if (targetTypeLower === 'scalar') {
            modelTypeDisplay = 'Regression';
          } else {
            modelTypeDisplay = 'Single Predictor';
          }
        } else {
          modelTypeDisplay = mi.model_type;
        }
      }
      
      return `
    <details class="section" open>
        <summary>MODEL IDENTIFICATION</summary>
        <div style="padding: 20px;">
        <div class="grid">
            <div class="metric">
                <div class="metric-label">Target Column</div>
                <div class="metric-value" style="font-size: 20px; font-weight: bold;">${mi.target_column || 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Model Type</div>
                <div class="metric-value" style="font-size: 20px; font-weight: bold;">${modelTypeDisplay}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Status</div>
                <div class="metric-value"><span class="status-badge" style="background-color: ${statusColor}">${(mi.status || 'N/A').toUpperCase()}</span></div>
            </div>
            <div class="metric">
                <div class="metric-label">Training Date</div>
                <div class="metric-value" style="font-size: 18px;">${mi.training_date || 'N/A'}</div>
            </div>
        </div>
        <table>
            <tr>
                <th style="width: 250px;">Session ID</th>
                <td><code>${sessionIdShort}</code></td>
            </tr>
            <tr>
                <th>Compute Cluster</th>
                <td>${(mi.compute_cluster || 'N/A').toUpperCase()}</td>
            </tr>
            <tr>
                <th>Job ID</th>
                <td><code>${mi.job_id || 'N/A'}</code></td>
            </tr>
            <tr>
                <th>Target Type</th>
                <td>${(mi.target_column_type || 'N/A').toUpperCase()}</td>
            </tr>
            <tr>
                <th>Framework</th>
                <td>${mi.framework || 'N/A'}</td>
            </tr>
        </table>
        </div>
    </details>
      `;
    },

    /**
     * Render training dataset section
     */
    renderTrainingDataset: function(data) {
      var td = data.training_dataset || {};
      var mi = data.model_identification || {};
      
      return `
    <details class="section" open>
        <summary>TRAINING DATASET</summary>
        <div class="grid">
            <div class="metric">
                <div class="metric-label">Training Rows</div>
                <div class="metric-value">${(td.train_rows || 0).toLocaleString()}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Features</div>
                <div class="metric-value">${td.total_features || 0}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Target Column</div>
                <div class="metric-value" style="font-size: 18px;">${td.target_column || 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Target Type</div>
                <div class="metric-value">${(mi.target_column_type || 'N/A').toUpperCase()}</div>
            </div>
        </div>
    </details>
      `;
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
                <div class="metric-label">Precision</div>
                <div class="metric-value">${cm.precision !== null && cm.precision !== undefined ? cm.precision.toFixed(3) : 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Recall</div>
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
        this.renderTrainingMetrics(modelCardJson),
        this.renderModelQuality(modelCardJson),
        this.renderTrainingDataset(modelCardJson)
      ].join('');
      
      // Return a fragment wrapped in a scoped container, not a full HTML document
      return `
<div class="featrix-model-card">
    <style>
        .featrix-model-card * { margin: 0; padding: 0; box-sizing: border-box; color: #000; }
        .featrix-model-card { font-family: 'Courier New', monospace; background: #fff; color: #000; line-height: 1.4; }
        .featrix-model-card .page { max-width: 1400px; margin: 0 auto; padding: 40px; color: #000; }
        
        .featrix-model-card .header { border-bottom: 4px solid #000; padding-bottom: 20px; margin-bottom: 30px; color: #000; }
        .featrix-model-card .header h1 { font-size: 36px; font-weight: bold; letter-spacing: -1px; color: #000; }
        .featrix-model-card .header .meta { font-size: 14px; margin-top: 8px; color: #000; }
        
        .featrix-model-card details { margin: 30px 0; border: 3px double #000; background: white; page-break-inside: avoid; color: #000; }
        .featrix-model-card details summary { padding: 15px 20px; cursor: pointer; font-weight: bold; background: #fff; border-bottom: 2px solid #000; user-select: none; text-transform: uppercase; font-size: 18px; letter-spacing: 1px; color: #000; }
        .featrix-model-card details summary:hover { background: #f5f5f5; color: #000; }
        .featrix-model-card details[open] summary { border-bottom: 2px solid #000; color: #000; }
        .featrix-model-card details > *:not(summary) { padding: 20px; color: #000; }
        
        .featrix-model-card .section { margin: 30px 0; page-break-inside: avoid; color: #000; }
        .featrix-model-card .section-title { font-size: 18px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; letter-spacing: 1px; color: #000; }
        
        .featrix-model-card .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 15px 0; color: #000; }
        .featrix-model-card .metric { border: 1px solid #000; padding: 12px; color: #000; }
        .featrix-model-card .metric-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; color: #000; }
        .featrix-model-card .metric-value { font-size: 24px; font-weight: bold; color: #000; }
        
        .featrix-model-card table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 15px 0; color: #000; }
        .featrix-model-card th { background: #000; color: #fff; padding: 10px; text-align: left; font-weight: bold; font-size: 13px; text-transform: uppercase; }
        .featrix-model-card td { border-bottom: 1px solid #ccc; padding: 8px 10px; color: #000; }
        .featrix-model-card tr:hover { background: #f5f5f5; color: #000; }
        
        .featrix-model-card .controls {
            margin-bottom: 20px;
            padding: 15px;
            background: #fff;
            border: 1px solid #000;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .featrix-model-card .btn {
            padding: 8px 16px;
            background: #000;
            color: #fff;
            border: 1px solid #000;
            cursor: pointer;
            font-size: 14px;
            font-family: 'Courier New', monospace;
        }
        
        .featrix-model-card .btn:hover {
            background: #333;
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
        </div>
        
        ${sections}
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

