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
      
      return `
    <div class="section">
        <div class="section-title">Model Identification</div>
        <div class="grid">
            <div class="metric">
                <div class="metric-label">Session ID</div>
                <div class="metric-value" style="font-size: 18px;">${sessionIdShort}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Compute Cluster</div>
                <div class="metric-value">${(mi.compute_cluster || 'N/A').toUpperCase()}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Training Date</div>
                <div class="metric-value" style="font-size: 18px;">${mi.training_date || 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Status</div>
                <div class="metric-value"><span class="status-badge" style="background-color: ${statusColor}">${(mi.status || 'N/A').toUpperCase()}</span></div>
            </div>
        </div>
        <table>
            <tr>
                <th style="width: 250px;">Job ID</th>
                <td><code>${mi.job_id || 'N/A'}</code></td>
            </tr>
            <tr>
                <th>Model Type</th>
                <td>${mi.model_type || 'N/A'}</td>
            </tr>
            <tr>
                <th>Target Column</th>
                <td>${mi.target_column || 'N/A'}</td>
            </tr>
            <tr>
                <th>Target Type</th>
                <td>${mi.target_column_type || 'N/A'}</td>
            </tr>
            <tr>
                <th>Framework</th>
                <td>${mi.framework || 'N/A'}</td>
            </tr>
        </table>
    </div>
      `;
    },

    /**
     * Render training dataset section
     */
    renderTrainingDataset: function(data) {
      var td = data.training_dataset || {};
      var mi = data.model_identification || {};
      
      return `
    <div class="section">
        <div class="section-title">Training Dataset</div>
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
    </div>
      `;
    },

    /**
     * Render training metrics section
     */
    renderTrainingMetrics: function(data) {
      var tm = data.training_metrics || {};
      var modelType = (data.model_identification || {}).model_type || '';
      
      var html = `
    <div class="section">
        <div class="section-title">Model Performance Metrics</div>
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
    </div>
      `;
      
      return html;
    },

    /**
     * Render model quality section
     */
    renderModelQuality: function(data) {
      var mq = data.model_quality || {};
      var html = `
    <div class="section">
        <div class="section-title">Model Quality</div>
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
    </div>
      `;
      
      return html;
    },

    /**
     * Attach event listeners to expand/collapse buttons
     * Call this after inserting HTML into the DOM
     */
    attachEventListeners: function(containerElement) {
      containerElement = containerElement || document;
      var expandBtn = containerElement.getElementById ? 
        containerElement.getElementById('expand-all-btn') :
        containerElement.querySelector('#expand-all-btn');
      var collapseBtn = containerElement.getElementById ?
        containerElement.getElementById('collapse-all-btn') :
        containerElement.querySelector('#collapse-all-btn');
      
      if (expandBtn) {
        expandBtn.addEventListener('click', function() {
          var page = containerElement.querySelector ? 
            containerElement.querySelector('.page') :
            document.querySelector('.page');
          if (page) {
            var sections = page.querySelectorAll('.section');
            sections.forEach(function(section) {
              var table = section.querySelector('#feature-table');
              if (table) {
                table.style.display = 'block';
                var icon = section.querySelector('#toggle-icon');
                if (icon) icon.textContent = '▲';
              }
            });
          }
        });
      }
      
      if (collapseBtn) {
        collapseBtn.addEventListener('click', function() {
          var page = containerElement.querySelector ?
            containerElement.querySelector('.page') :
            document.querySelector('.page');
          if (page) {
            var sections = page.querySelectorAll('.section');
            sections.forEach(function(section) {
              var table = section.querySelector('#feature-table');
              if (table) {
                table.style.display = 'none';
                var icon = section.querySelector('#toggle-icon');
                if (icon) icon.textContent = '▼';
              }
            });
          }
        });
      }
      
      // Make toggleFeatures available
      window.toggleFeatures = function() {
        var table = document.getElementById('feature-table');
        var icon = document.getElementById('toggle-icon');
        if (table && icon) {
          if (table.style.display === 'none') {
            table.style.display = 'block';
            icon.textContent = '▲';
          } else {
            table.style.display = 'none';
            icon.textContent = '▼';
          }
        }
      };
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
        this.renderTrainingDataset(modelCardJson),
        this.renderTrainingMetrics(modelCardJson),
        this.renderModelQuality(modelCardJson)
      ].join('');
      
      return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Model Card - ${modelName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: #fff; color: #000; line-height: 1.4; }
        .page { max-width: 1400px; margin: 0 auto; padding: 40px; }
        
        .header { border-bottom: 4px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { font-size: 36px; font-weight: bold; letter-spacing: -1px; }
        .header .meta { font-size: 14px; margin-top: 8px; }
        
        .section { margin: 30px 0; page-break-inside: avoid; }
        .section-title { font-size: 18px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; letter-spacing: 1px; }
        
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 15px 0; }
        .metric { border: 1px solid #000; padding: 12px; }
        .metric-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .metric-value { font-size: 24px; font-weight: bold; }
        
        table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 15px 0; }
        th { background: #000; color: #fff; padding: 10px; text-align: left; font-weight: bold; font-size: 13px; text-transform: uppercase; }
        td { border-bottom: 1px solid #ccc; padding: 8px 10px; }
        tr:hover { background: #f5f5f5; }
        
        .controls {
            margin-bottom: 20px;
            padding: 15px;
            background: #fff;
            border: 1px solid #000;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 8px 16px;
            background: #000;
            color: #fff;
            border: 1px solid #000;
            cursor: pointer;
            font-size: 14px;
            font-family: 'Courier New', monospace;
        }
        
        .btn:hover {
            background: #333;
        }
        
        .btn-secondary {
            background: #fff;
            color: #000;
        }
        
        .btn-secondary:hover {
            background: #f5f5f5;
        }
        
        .status-badge, .quality-badge, .severity-badge {
            display: inline-block;
            padding: 4px 12px;
            color: white;
            font-size: 12px;
            font-weight: 600;
        }
        
        .warning-item {
            padding: 15px;
            margin-bottom: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
        }
        
        .warning-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        code {
            background: #fff;
            padding: 2px 6px;
            border: 1px solid #000;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        
        @media print { 
            @page { size: letter; margin: 0.75in; }
            .page { padding: 0; max-width: 100%; }
            .section { page-break-inside: avoid; }
            .header { page-break-after: always; }
            .controls { display: none; }
            table { font-size: 10pt; }
            .grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>MODEL CARD: ${modelName.toUpperCase()}</h1>
            <div class="meta">
                <strong>Generated:</strong> ${dateStr} UTC
            </div>
        </div>
        
        <div class="controls">
            <button class="btn" id="expand-all-btn">Expand All</button>
            <button class="btn btn-secondary" id="collapse-all-btn">Collapse All</button>
        </div>
        
        ${sections}
    </div>
    
    <script>
        (function() {
            function expandAll() {
                var sections = document.querySelectorAll('.section');
                sections.forEach(function(section) {
                    var table = section.querySelector('#feature-table');
                    if (table) {
                        table.style.display = 'block';
                        var icon = section.querySelector('#toggle-icon');
                        if (icon) icon.textContent = '▲';
                    }
                });
            }
            
            function collapseAll() {
                var sections = document.querySelectorAll('.section');
                sections.forEach(function(section) {
                    var table = section.querySelector('#feature-table');
                    if (table) {
                        table.style.display = 'none';
                        var icon = section.querySelector('#toggle-icon');
                        if (icon) icon.textContent = '▼';
                    }
                });
            }
            
            function toggleFeatures() {
                var table = document.getElementById('feature-table');
                var icon = document.getElementById('toggle-icon');
                if (table && icon) {
                    if (table.style.display === 'none') {
                        table.style.display = 'block';
                        icon.textContent = '▲';
                    } else {
                        table.style.display = 'none';
                        icon.textContent = '▼';
                    }
                }
            }
            
            // Attach event listeners when DOM is ready
            function attachListeners() {
                var expandBtn = document.getElementById('expand-all-btn');
                var collapseBtn = document.getElementById('collapse-all-btn');
                
                if (expandBtn) {
                    expandBtn.addEventListener('click', expandAll);
                }
                if (collapseBtn) {
                    collapseBtn.addEventListener('click', collapseAll);
                }
                
                // Make toggleFeatures available globally
                window.toggleFeatures = toggleFeatures;
            }
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', attachListeners);
            } else {
                attachListeners();
            }
        })();
    </script>
</body>
</html>`;
    }
  };

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeatrixModelCard;
  } else {
    global.FeatrixModelCard = FeatrixModelCard;
  }
})(typeof window !== 'undefined' ? window : this);

