#!/usr/bin/env python3
"""
Static HTML renderer for Featrix Sphere Model Card JSON.
Features:
- Uses <summary> elements for collapsible sections
- Expand all functionality
- Print-friendly CSS that prints nicely onto 1 page
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional


def format_value(value: Any) -> str:
    """Format a value for display in HTML."""
    if value is None:
        return '<em>N/A</em>'
    if isinstance(value, float):
        return f"{value:.4f}".rstrip('0').rstrip('.')
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (list, dict)):
        return json.dumps(value, indent=2)
    return str(value)


def format_percentage(value: Optional[float]) -> str:
    """Format a percentage value."""
    if value is None:
        return '<em>N/A</em>'
    return f"{value * 100:.2f}%"


def get_status_color(status: str) -> str:
    """Get color for status."""
    status_lower = status.lower()
    if status_lower == 'done':
        return '#28a745'
    elif status_lower == 'training':
        return '#ffc107'
    elif status_lower == 'failed':
        return '#dc3545'
    return '#6c757d'


def get_quality_color(assessment: Optional[str]) -> str:
    """Get color for quality assessment."""
    if not assessment:
        return '#6c757d'
    assessment_lower = assessment.lower()
    if assessment_lower == 'excellent':
        return '#28a745'
    elif assessment_lower == 'good':
        return '#007bff'
    elif assessment_lower == 'fair':
        return '#ffc107'
    elif assessment_lower == 'poor':
        return '#fd7e14'
    return '#6c757d'


def get_severity_color(severity: str) -> str:
    """Get color for warning severity."""
    severity_lower = severity.lower()
    if severity_lower == 'high':
        return '#dc3545'
    elif severity_lower == 'moderate':
        return '#ffc107'
    elif severity_lower == 'low':
        return '#007bff'
    return '#6c757d'


def render_model_identification(data: Dict[str, Any]) -> str:
    """Render model identification section."""
    mi = data.get('model_identification', {})
    
    status_color = get_status_color(mi.get('status', ''))
    
    html = f"""
    <details open>
        <summary><h2>Model Identification</h2></summary>
        <div class="section-content">
            <table class="info-table">
                <tr>
                    <th>Session ID</th>
                    <td><code>{mi.get('session_id', 'N/A')}</code></td>
                </tr>
                <tr>
                    <th>Job ID</th>
                    <td><code>{mi.get('job_id', 'N/A')}</code></td>
                </tr>
                <tr>
                    <th>Name</th>
                    <td><strong>{mi.get('name', 'N/A')}</strong></td>
                </tr>
                <tr>
                    <th>Model Type</th>
                    <td>{mi.get('model_type', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Status</th>
                    <td><span class="status-badge" style="background-color: {status_color}">{mi.get('status', 'N/A')}</span></td>
                </tr>
                <tr>
                    <th>Target Column</th>
                    <td>{mi.get('target_column', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Target Type</th>
                    <td>{mi.get('target_column_type', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Compute Cluster</th>
                    <td>{mi.get('compute_cluster', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Training Date</th>
                    <td>{mi.get('training_date', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Framework</th>
                    <td>{mi.get('framework', 'N/A')}</td>
                </tr>
            </table>
        </div>
    </details>
    """
    return html


def render_training_dataset(data: Dict[str, Any]) -> str:
    """Render training dataset section."""
    td = data.get('training_dataset', {})
    
    html = f"""
    <details open>
        <summary><h2>Training Dataset</h2></summary>
        <div class="section-content">
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Training Rows</div>
                    <div class="metric-value">{td.get('train_rows', 0):,}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Validation Rows</div>
                    <div class="metric-value">{td.get('val_rows', 0):,}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Rows</div>
                    <div class="metric-value">{td.get('total_rows', 0):,}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Features</div>
                    <div class="metric-value">{td.get('total_features', 0)}</div>
                </div>
            </div>
            <div class="feature-names">
                <h3>Feature Names</h3>
                <div class="tag-list">
                    {''.join([f'<span class="tag">{name}</span>' for name in td.get('feature_names', [])])}
                </div>
            </div>
        </div>
    </details>
    """
    return html


def render_feature_inventory(data: Dict[str, Any]) -> str:
    """Render feature inventory section."""
    features = data.get('feature_inventory', [])
    
    rows = []
    for feat in features:
        name = feat.get('name', 'N/A')
        feat_type = feat.get('type', 'N/A')
        encoder = feat.get('encoder_type', 'N/A')
        unique_vals = feat.get('unique_values')
        sample_vals = feat.get('sample_values', [])
        stats = feat.get('statistics')
        
        stats_html = '<em>N/A</em>'
        if stats:
            stats_html = f"""
            <div class="stats-grid">
                <div>Min: {format_value(stats.get('min'))}</div>
                <div>Max: {format_value(stats.get('max'))}</div>
                <div>Mean: {format_value(stats.get('mean'))}</div>
                <div>Std: {format_value(stats.get('std'))}</div>
                <div>Median: {format_value(stats.get('median'))}</div>
            </div>
            """
        
        sample_html = '<em>N/A</em>'
        if sample_vals:
            sample_html = ', '.join([str(v) for v in sample_vals[:5]])
            if len(sample_vals) > 5:
                sample_html += f' <em>(+{len(sample_vals) - 5} more)</em>'
        
        rows.append(f"""
        <tr>
            <td><strong>{name}</strong></td>
            <td>{feat_type}</td>
            <td>{encoder}</td>
            <td>{unique_vals if unique_vals is not None else '<em>N/A</em>'}</td>
            <td>{sample_html}</td>
            <td>{stats_html}</td>
        </tr>
        """)
    
    html = f"""
    <details>
        <summary><h2>Feature Inventory</h2></summary>
        <div class="section-content">
            <table class="data-table">
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
                    {''.join(rows)}
                </tbody>
            </table>
        </div>
    </details>
    """
    return html


def render_training_configuration(data: Dict[str, Any]) -> str:
    """Render training configuration section."""
    tc = data.get('training_configuration', {})
    dropout = tc.get('dropout_schedule')
    
    html = f"""
    <details>
        <summary><h2>Training Configuration</h2></summary>
        <div class="section-content">
            <table class="info-table">
                <tr>
                    <th>Total Epochs</th>
                    <td>{tc.get('epochs_total', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Best Epoch</th>
                    <td>{tc.get('best_epoch', 'N/A')}</td>
                </tr>
                <tr>
                    <th>d_model</th>
                    <td>{tc.get('d_model', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Batch Size</th>
                    <td>{tc.get('batch_size', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Learning Rate</th>
                    <td>{format_value(tc.get('learning_rate'))}</td>
                </tr>
                <tr>
                    <th>Optimizer</th>
                    <td>{tc.get('optimizer', 'N/A')}</td>
                </tr>
    """
    
    if dropout:
        html += f"""
                <tr>
                    <th>Dropout Schedule</th>
                    <td>
                        <div>Enabled: {dropout.get('enabled', False)}</div>
                        <div>Initial: {format_value(dropout.get('initial'))}</div>
                        <div>Final: {format_value(dropout.get('final'))}</div>
                    </td>
                </tr>
        """
    
    html += """
            </table>
        </div>
    </details>
    """
    return html


def render_training_metrics(data: Dict[str, Any]) -> str:
    """Render training metrics section."""
    tm = data.get('training_metrics', {})
    model_type = data.get('model_identification', {}).get('model_type', '')
    
    html = f"""
    <details open>
        <summary><h2>Training Metrics</h2></summary>
        <div class="section-content">
    """
    
    # Best epoch
    best_epoch = tm.get('best_epoch', {})
    html += f"""
            <h3>Best Epoch</h3>
            <table class="info-table">
                <tr>
                    <th>Epoch</th>
                    <td>{best_epoch.get('epoch', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Validation Loss</th>
                    <td>{format_value(best_epoch.get('validation_loss'))}</td>
                </tr>
                <tr>
                    <th>Train Loss</th>
                    <td>{format_value(best_epoch.get('train_loss'))}</td>
                </tr>
    """
    
    if best_epoch.get('spread_loss') is not None:
        html += f"""
                <tr>
                    <th>Spread Loss</th>
                    <td>{format_value(best_epoch.get('spread_loss'))}</td>
                </tr>
                <tr>
                    <th>Joint Loss</th>
                    <td>{format_value(best_epoch.get('joint_loss'))}</td>
                </tr>
                <tr>
                    <th>Marginal Loss</th>
                    <td>{format_value(best_epoch.get('marginal_loss'))}</td>
                </tr>
        """
    
    html += """
            </table>
    """
    
    # Classification metrics (Single Predictor)
    if model_type == 'Single Predictor':
        cm = tm.get('classification_metrics')
        if cm:
            html += f"""
            <h3>Classification Metrics</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Accuracy</div>
                    <div class="metric-value">{format_percentage(cm.get('accuracy'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Precision</div>
                    <div class="metric-value">{format_percentage(cm.get('precision'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Recall</div>
                    <div class="metric-value">{format_percentage(cm.get('recall'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">F1 Score</div>
                    <div class="metric-value">{format_percentage(cm.get('f1'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">AUC</div>
                    <div class="metric-value">{format_percentage(cm.get('auc'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Binary Classification</div>
                    <div class="metric-value">{cm.get('is_binary', False)}</div>
                </div>
            </div>
            """
        
        # Optimal threshold
        opt_thresh = tm.get('optimal_threshold')
        if opt_thresh:
            html += f"""
            <h3>Optimal Threshold</h3>
            <table class="info-table">
                <tr>
                    <th>Optimal Threshold</th>
                    <td>{format_value(opt_thresh.get('optimal_threshold'))}</td>
                </tr>
                <tr>
                    <th>Positive Label</th>
                    <td>{opt_thresh.get('pos_label', 'N/A')}</td>
                </tr>
                <tr>
                    <th>F1 at Optimal Threshold</th>
                    <td>{format_percentage(opt_thresh.get('optimal_threshold_f1'))}</td>
                </tr>
                <tr>
                    <th>Accuracy at Optimal Threshold</th>
                    <td>{format_percentage(opt_thresh.get('accuracy_at_optimal_threshold'))}</td>
                </tr>
            </table>
            """
        
        # Argmax metrics
        argmax = tm.get('argmax_metrics')
        if argmax:
            html += f"""
            <h3>Argmax Metrics</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Accuracy</div>
                    <div class="metric-value">{format_percentage(argmax.get('accuracy'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Precision</div>
                    <div class="metric-value">{format_percentage(argmax.get('precision'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Recall</div>
                    <div class="metric-value">{format_percentage(argmax.get('recall'))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">F1 Score</div>
                    <div class="metric-value">{format_percentage(argmax.get('f1'))}</div>
                </div>
            </div>
            """
    
    # Loss progression (Embedding Space)
    if model_type == 'Embedding Space':
        loss_prog = tm.get('loss_progression')
        if loss_prog:
            html += f"""
            <h3>Loss Progression</h3>
            <table class="info-table">
                <tr>
                    <th>Initial Train Loss</th>
                    <td>{format_value(loss_prog.get('initial_train'))}</td>
                </tr>
                <tr>
                    <th>Initial Val Loss</th>
                    <td>{format_value(loss_prog.get('initial_val'))}</td>
                </tr>
                <tr>
                    <th>Improvement %</th>
                    <td>{format_value(loss_prog.get('improvement_pct'))}</td>
                </tr>
            </table>
            """
        
        final_epoch = tm.get('final_epoch')
        if final_epoch:
            html += f"""
            <h3>Final Epoch</h3>
            <table class="info-table">
                <tr>
                    <th>Epoch</th>
                    <td>{final_epoch.get('epoch', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Train Loss</th>
                    <td>{format_value(final_epoch.get('train_loss'))}</td>
                </tr>
                <tr>
                    <th>Val Loss</th>
                    <td>{format_value(final_epoch.get('val_loss'))}</td>
                </tr>
            </table>
            """
    
    html += """
        </div>
    </details>
    """
    return html


def render_model_architecture(data: Dict[str, Any]) -> str:
    """Render model architecture section."""
    ma = data.get('model_architecture', {})
    
    html = f"""
    <details>
        <summary><h2>Model Architecture</h2></summary>
        <div class="section-content">
            <table class="info-table">
    """
    
    if ma.get('predictor_layers') is not None:
        html += f"""
                <tr>
                    <th>Predictor Layers</th>
                    <td>{ma.get('predictor_layers')}</td>
                </tr>
        """
    
    if ma.get('predictor_parameters') is not None:
        html += f"""
                <tr>
                    <th>Predictor Parameters</th>
                    <td>{ma.get('predictor_parameters'):,}</td>
                </tr>
        """
    
    if ma.get('embedding_space_d_model') is not None:
        html += f"""
                <tr>
                    <th>Embedding Space d_model</th>
                    <td>{ma.get('embedding_space_d_model')}</td>
                </tr>
        """
    
    html += """
            </table>
        </div>
    </details>
    """
    return html


def render_model_quality(data: Dict[str, Any]) -> str:
    """Render model quality section."""
    mq = data.get('model_quality', {})
    
    html = f"""
    <details open>
        <summary><h2>Model Quality</h2></summary>
        <div class="section-content">
    """
    
    assessment = mq.get('assessment')
    if assessment:
        quality_color = get_quality_color(assessment)
        html += f"""
            <div class="quality-assessment">
                <h3>Assessment</h3>
                <span class="quality-badge" style="background-color: {quality_color}">{assessment}</span>
            </div>
        """
    
    recommendations = mq.get('recommendations', [])
    if recommendations:
        html += """
            <h3>Recommendations</h3>
            <ul class="recommendations-list">
        """
        for rec in recommendations:
            html += f"""
                <li>
                    <strong>Issue:</strong> {rec.get('issue', 'N/A')}<br>
                    <strong>Suggestion:</strong> {rec.get('suggestion', 'N/A')}
                </li>
            """
        html += """
            </ul>
        """
    
    warnings = mq.get('warnings', [])
    if warnings:
        html += """
            <h3>Warnings</h3>
            <div class="warnings-list">
        """
        for warning in warnings:
            severity = warning.get('severity', 'UNKNOWN')
            severity_color = get_severity_color(severity)
            html += f"""
                <div class="warning-item">
                    <div class="warning-header">
                        <span class="severity-badge" style="background-color: {severity_color}">{severity}</span>
                        <strong>{warning.get('type', 'N/A')}</strong>
                    </div>
                    <div class="warning-message">{warning.get('message', 'N/A')}</div>
            """
            if warning.get('recommendation'):
                html += f"""
                    <div class="warning-recommendation">
                        <strong>Recommendation:</strong> {warning.get('recommendation')}
                    </div>
                """
            details = warning.get('details')
            if details:
                html += """
                    <details class="warning-details">
                        <summary>Details</summary>
                        <pre class="details-json">""" + json.dumps(details, indent=2) + """</pre>
                    </details>
                """
            html += """
                </div>
            """
        html += """
            </div>
        """
    
    training_quality_warning = mq.get('training_quality_warning')
    if training_quality_warning:
        html += f"""
            <div class="training-quality-warning">
                <h3>Training Quality Warning</h3>
                <p>{training_quality_warning}</p>
            </div>
        """
    
    html += """
        </div>
    </details>
    """
    return html


def render_technical_details(data: Dict[str, Any]) -> str:
    """Render technical details section."""
    td = data.get('technical_details', {})
    
    html = f"""
    <details>
        <summary><h2>Technical Details</h2></summary>
        <div class="section-content">
            <table class="info-table">
                <tr>
                    <th>PyTorch Version</th>
                    <td>{td.get('pytorch_version', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Device</th>
                    <td>{td.get('device', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Precision</th>
                    <td>{td.get('precision', 'N/A')}</td>
                </tr>
                <tr>
                    <th>Loss Function</th>
                    <td>{td.get('loss_function', 'N/A')}</td>
                </tr>
    """
    
    if td.get('normalization'):
        html += f"""
                <tr>
                    <th>Normalization</th>
                    <td>{td.get('normalization')}</td>
                </tr>
        """
    
    html += """
            </table>
        </div>
    </details>
    """
    return html


def render_provenance(data: Dict[str, Any]) -> str:
    """Render provenance section."""
    prov = data.get('provenance', {})
    
    html = f"""
    <details>
        <summary><h2>Provenance</h2></summary>
        <div class="section-content">
            <table class="info-table">
                <tr>
                    <th>Created At</th>
                    <td>{prov.get('created_at', 'N/A')}</td>
                </tr>
    """
    
    if prov.get('training_duration_minutes') is not None:
        duration = prov.get('training_duration_minutes')
        hours = int(duration // 60)
        minutes = int(duration % 60)
        html += f"""
                <tr>
                    <th>Training Duration</th>
                    <td>{hours}h {minutes}m ({duration:.2f} minutes)</td>
                </tr>
        """
    
    version_info = prov.get('version_info')
    if version_info:
        html += f"""
                <tr>
                    <th>Version Info</th>
                    <td><pre class="details-json">{json.dumps(version_info, indent=2)}</pre></td>
                </tr>
        """
    
    html += """
            </table>
        </div>
    </details>
    """
    return html


def render_column_statistics(data: Dict[str, Any]) -> str:
    """Render column statistics section (Embedding Space only)."""
    cs = data.get('column_statistics', {})
    
    if not cs:
        return ""
    
    rows = []
    for col_name, stats in cs.items():
        rows.append(f"""
        <tr>
            <td><strong>{col_name}</strong></td>
            <td>{format_value(stats.get('mutual_information_bits'))}</td>
            <td>{format_value(stats.get('marginal_loss'))}</td>
        </tr>
        """)
    
    html = f"""
    <details>
        <summary><h2>Column Statistics</h2></summary>
        <div class="section-content">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Column</th>
                        <th>Mutual Information (bits)</th>
                        <th>Marginal Loss</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(rows)}
                </tbody>
            </table>
        </div>
    </details>
    """
    return html


def render_html(model_card_json: Dict[str, Any]) -> str:
    """Render complete HTML model card."""
    
    # Render all sections
    sections = [
        render_model_identification(model_card_json),
        render_training_dataset(model_card_json),
        render_feature_inventory(model_card_json),
        render_training_configuration(model_card_json),
        render_training_metrics(model_card_json),
        render_model_architecture(model_card_json),
        render_model_quality(model_card_json),
        render_technical_details(model_card_json),
        render_provenance(model_card_json),
        render_column_statistics(model_card_json),
    ]
    
    model_name = model_card_json.get('model_identification', {}).get('name', 'Model Card')
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Card - {model_name}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        
        .header {{
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            font-size: 32px;
            color: #333;
            margin-bottom: 10px;
        }}
        
        .header .meta {{
            color: #666;
            font-size: 14px;
        }}
        
        .controls {{
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }}
        
        .btn {{
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }}
        
        .btn:hover {{
            background: #5568d3;
        }}
        
        .btn-secondary {{
            background: #6c757d;
        }}
        
        .btn-secondary:hover {{
            background: #5a6268;
        }}
        
        details {{
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background: white;
        }}
        
        details summary {{
            padding: 15px 20px;
            cursor: pointer;
            font-weight: 600;
            background: #f8f9fa;
            border-radius: 5px 5px 0 0;
            user-select: none;
        }}
        
        details summary:hover {{
            background: #e9ecef;
        }}
        
        details summary::-webkit-details-marker {{
            display: none;
        }}
        
        details summary::before {{
            content: '▶';
            display: inline-block;
            margin-right: 10px;
            transition: transform 0.2s;
        }}
        
        details[open] summary::before {{
            transform: rotate(90deg);
        }}
        
        details summary h2 {{
            display: inline;
            font-size: 20px;
            margin: 0;
        }}
        
        .section-content {{
            padding: 20px;
        }}
        
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}
        
        .metric-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #667eea;
        }}
        
        .metric-label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }}
        
        .metric-value {{
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }}
        
        .info-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        
        .info-table th {{
            text-align: left;
            padding: 10px;
            background: #f8f9fa;
            font-weight: 600;
            width: 200px;
            border-bottom: 1px solid #ddd;
        }}
        
        .info-table td {{
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }}
        
        .data-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 14px;
        }}
        
        .data-table th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }}
        
        .data-table td {{
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
        }}
        
        .data-table tr:hover {{
            background: #f8f9fa;
        }}
        
        .tag-list {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }}
        
        .tag {{
            display: inline-block;
            padding: 4px 12px;
            background: #e3f2fd;
            color: #1976d2;
            border-radius: 12px;
            font-size: 12px;
        }}
        
        .status-badge, .quality-badge, .severity-badge {{
            display: inline-block;
            padding: 4px 12px;
            color: white;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }}
        
        .quality-assessment {{
            margin: 20px 0;
        }}
        
        .recommendations-list {{
            list-style: none;
            margin: 15px 0;
        }}
        
        .recommendations-list li {{
            padding: 15px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 4px;
        }}
        
        .warnings-list {{
            margin: 15px 0;
        }}
        
        .warning-item {{
            padding: 15px;
            margin-bottom: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
        }}
        
        .warning-header {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }}
        
        .warning-message {{
            margin: 10px 0;
        }}
        
        .warning-recommendation {{
            margin-top: 10px;
            padding: 10px;
            background: white;
            border-radius: 4px;
        }}
        
        .warning-details {{
            margin-top: 10px;
        }}
        
        .warning-details summary {{
            padding: 5px;
            font-size: 14px;
            background: transparent;
        }}
        
        .details-json {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            margin-top: 10px;
        }}
        
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 5px;
            font-size: 12px;
        }}
        
        .training-quality-warning {{
            padding: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
            margin: 15px 0;
        }}
        
        code {{
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }}
        
        /* Print Styles */
        @media print {{
            @page {{
                size: letter;
                margin: 0.5in;
            }}
            
            body {{
                background: white;
                padding: 0;
            }}
            
            .container {{
                box-shadow: none;
                padding: 0;
            }}
            
            .controls {{
                display: none;
            }}
            
            details {{
                page-break-inside: avoid;
                border: none;
            }}
            
            details summary {{
                page-break-after: avoid;
            }}
            
            details[open] {{
                display: block;
            }}
            
            details:not([open]) {{
                display: none;
            }}
            
            .section-content {{
                padding: 10px 0;
            }}
            
            .metrics-grid {{
                grid-template-columns: repeat(2, 1fr);
            }}
            
            .data-table {{
                font-size: 10pt;
            }}
            
            .data-table th,
            .data-table td {{
                padding: 6px;
            }}
            
            .warning-item,
            .recommendations-list li {{
                page-break-inside: avoid;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Model Card: {model_name}</h1>
            <div class="meta">
                Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            </div>
        </div>
        
        <div class="controls">
            <button class="btn" onclick="expandAll()">Expand All</button>
            <button class="btn btn-secondary" onclick="collapseAll()">Collapse All</button>
        </div>
        
        {''.join(sections)}
    </div>
    
    <script>
        function expandAll() {{
            document.querySelectorAll('details').forEach(detail => {{
                detail.open = true;
            }});
        }}
        
        function collapseAll() {{
            document.querySelectorAll('details').forEach(detail => {{
                detail.open = false;
            }});
        }}
    </script>
</body>
</html>
"""
    
    return html


def render_to_file(model_card_json: Dict[str, Any], output_path: str) -> str:
    """Render model card JSON to HTML file."""
    html = render_html(model_card_json)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    return output_path

