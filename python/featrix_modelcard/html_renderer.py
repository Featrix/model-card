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


def format_value(value: Any, precision: int = 4) -> str:
    """Format a value for display in HTML."""
    if value is None:
        return '<em>N/A</em>'
    if isinstance(value, float):
        return f"{value:.{precision}f}".rstrip('0').rstrip('.')
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
    session_id_short = mi.get('session_id', 'N/A')[:20] if mi.get('session_id') else 'N/A'
    
    # Map model type to display format
    model_type = mi.get('model_type', '')
    target_type = mi.get('target_column_type', '')
    model_type_display = 'N/A'
    
    if model_type:
        model_type_lower = model_type.lower()
        target_type_lower = target_type.lower() if target_type else ''
        
        if model_type_lower == 'embedding space' or model_type_lower == 'es':
            model_type_display = 'Foundational Embedding Space'
        elif model_type_lower == 'single predictor' or model_type_lower == 'sp':
            if target_type_lower == 'set':
                model_type_display = 'Classifier'
            elif target_type_lower == 'scalar':
                model_type_display = 'Regression'
            else:
                model_type_display = 'Single Predictor'
        else:
            model_type_display = model_type
    
    html = f"""
    <details class="section" open>
        <summary>MODEL IDENTIFICATION</summary>
        <div style="padding: 20px;">
        <div class="grid">
            <div class="metric">
                <div class="metric-label">Target Column</div>
                <div class="metric-value" style="font-size: 20px; font-weight: bold;">{mi.get('target_column', 'N/A')}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Model Type</div>
                <div class="metric-value" style="font-size: 20px; font-weight: bold;">{model_type_display}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Status</div>
                <div class="metric-value"><span class="status-badge" style="background-color: {status_color}">{mi.get('status', 'N/A').upper()}</span></div>
            </div>
            <div class="metric">
                <div class="metric-label">Training Date</div>
                <div class="metric-value" style="font-size: 18px;">{mi.get('training_date', 'N/A')}</div>
            </div>
        </div>
        <table class="info-table">
            <tr>
                <th style="width: 250px;">Session ID</th>
                <td><code>{session_id_short}</code></td>
            </tr>
            <tr>
                <th>Compute Cluster</th>
                <td>{mi.get('compute_cluster', 'N/A').upper()}</td>
            </tr>
            <tr>
                <th>Job ID</th>
                <td><code>{mi.get('job_id', 'N/A')}</code></td>
            </tr>
            <tr>
                <th>Target Type</th>
                <td>{mi.get('target_column_type', 'N/A').upper() if mi.get('target_column_type') else 'N/A'}</td>
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
    <div class="section">
        <div class="section-title">Training Dataset</div>
        <div class="grid">
            <div class="metric">
                <div class="metric-label">Training Rows</div>
                <div class="metric-value">{td.get('train_rows', 0):,}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Features</div>
                <div class="metric-value">{td.get('total_features', 0)}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Target Column</div>
                <div class="metric-value" style="font-size: 18px;">{td.get('target_column', 'N/A')}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Target Type</div>
                <div class="metric-value">{data.get('model_identification', {}).get('target_column_type', 'N/A').upper() if data.get('model_identification', {}).get('target_column_type') else 'N/A'}</div>
            </div>
        </div>
    </div>
    """
    return html


def render_feature_inventory(data: Dict[str, Any]) -> str:
    """Render feature inventory section."""
    features = data.get('feature_inventory', [])
    target_col = data.get('model_identification', {}).get('target_column')
    
    rows = []
    for feat in features[:50]:  # Top 50
        name = feat.get('name', 'N/A')
        feat_type = feat.get('type', 'N/A')
        encoder = feat.get('encoder_type', 'N/A')
        unique_vals = feat.get('unique_values')
        sample_vals = feat.get('sample_values', [])
        stats = feat.get('statistics')
        
        # Highlight target column
        highlight_style = 'background: #000; color: white; font-weight: bold;' if name == target_col else ''
        
        stats_html = 'N/A'
        if stats:
            stats_html = f"Min: {format_value(stats.get('min'))}, Max: {format_value(stats.get('max'))}, Mean: {format_value(stats.get('mean'))}"
        
        sample_html = 'N/A'
        if sample_vals:
            sample_list = [str(v) for v in sample_vals[:3]]
            sample_html = ', '.join(sample_list)
        
        rows.append(f"""
        <tr style="{highlight_style}">
            <td>{name}</td>
            <td>{feat_type}</td>
            <td>{unique_vals if unique_vals is not None else 'N/A'}</td>
            <td style="font-size: 14px;">{sample_html}</td>
            <td style="font-size: 13px;">{stats_html}</td>
        </tr>
        """)
    
    html = f"""
    <div class="section">
        <div class="section-title" style="cursor: pointer;" onclick="toggleFeatures()">
            Feature Inventory (Top 50) <span id="toggle-icon">▼</span>
        </div>
        <div id="feature-table" style="display: none;">
            <table>
                <thead>
                    <tr>
                        <th>Feature Name</th>
                        <th>Data Type</th>
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
    </div>
    """
    return html


def render_training_configuration(data: Dict[str, Any]) -> str:
    """Render training configuration section."""
    tc = data.get('training_configuration', {})
    dropout = tc.get('dropout_schedule')
    
    html = f"""
    <div class="section">
        <div class="section-title">Training Configuration</div>
        <table class="info-table">
            <tr>
                <th style="width: 250px;">Total Epochs</th>
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
                    Enabled: {dropout.get('enabled', False)}, Initial: {format_value(dropout.get('initial'))}, Final: {format_value(dropout.get('final'))}
                </td>
            </tr>
        """
    
    html += """
        </table>
    </div>
    """
    return html


def render_training_metrics(data: Dict[str, Any]) -> str:
    """Render training metrics section."""
    tm = data.get('training_metrics', {})
    model_type = data.get('model_identification', {}).get('model_type', '')
    
    html = f"""
    <div class="section">
        <div class="section-title">Model Performance Metrics</div>
    """
    
    # Classification metrics (Single Predictor)
    if model_type == 'Single Predictor':
        cm = tm.get('classification_metrics')
        if cm:
            html += f"""
        <div class="grid">
            <div class="metric">
                <div class="metric-label">Precision</div>
                <div class="metric-value">{format_value(cm.get('precision'), 3) if cm.get('precision') is not None else 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Recall</div>
                <div class="metric-value">{format_value(cm.get('recall'), 3) if cm.get('recall') is not None else 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">F1 Score</div>
                <div class="metric-value">{format_value(cm.get('f1'), 3) if cm.get('f1') is not None else 'N/A'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">AUC</div>
                <div class="metric-value">{format_value(cm.get('auc'), 3) if cm.get('auc') is not None else 'N/A'}</div>
            </div>
        </div>
            """
    
    # Loss progression (Embedding Space)
    if model_type == 'Embedding Space':
        best_epoch = tm.get('best_epoch', {})
        html += f"""
        <table class="info-table">
            <tr>
                <th style="width: 250px;">Best Epoch</th>
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
        </table>
        """
    
    html += """
    </div>
    """
    return html


def render_model_architecture(data: Dict[str, Any]) -> str:
    """Render model architecture section."""
    ma = data.get('model_architecture', {})
    
    html = f"""
    <div class="section">
        <div class="section-title">Model Architecture</div>
        <table class="info-table">
    """
    
    if ma.get('predictor_layers') is not None:
        html += f"""
            <tr>
                <th style="width: 250px;">Predictor Layers</th>
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
    """
    return html


def render_model_quality(data: Dict[str, Any]) -> str:
    """Render model quality section."""
    mq = data.get('model_quality', {})
    
    html = f"""
    <div class="section">
        <div class="section-title">Model Quality</div>
    """
    
    assessment = mq.get('assessment')
    if assessment:
        quality_color = get_quality_color(assessment)
        html += f"""
        <table class="info-table">
            <tr>
                <th style="width: 250px;">Assessment</th>
                <td><span class="quality-badge" style="background-color: {quality_color}">{assessment}</span></td>
            </tr>
        </table>
        """
    
    recommendations = mq.get('recommendations', [])
    if recommendations:
        html += """
        <h3 style="margin: 15px 0 10px 0; font-size: 16px;">Recommendations</h3>
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
        <h3 style="margin: 15px 0 10px 0; font-size: 16px;">Warnings</h3>
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
    """
    return html


def render_technical_details(data: Dict[str, Any]) -> str:
    """Render technical details section."""
    td = data.get('technical_details', {})
    
    html = f"""
    <div class="section" style="margin-top: 50px; border-top: 3px solid #000; padding: 30px; background: #2b2b2b; color: #d0d0d0; font-size: 15px;">
        <div class="section-title" style="color: #fff; border-bottom-color: #fff;">Technical Details</div>
        <table class="info-table" style="color: #d0d0d0;">
            <tr>
                <th style="width: 250px; background: #3a3a3a; color: #fff;">PyTorch Version</th>
                <td>{td.get('pytorch_version', 'N/A')}</td>
            </tr>
            <tr>
                <th style="background: #3a3a3a; color: #fff;">Device</th>
                <td>{td.get('device', 'N/A')}</td>
            </tr>
            <tr>
                <th style="background: #3a3a3a; color: #fff;">Precision</th>
                <td>{td.get('precision', 'N/A')}</td>
            </tr>
            <tr>
                <th style="background: #3a3a3a; color: #fff;">Loss Function</th>
                <td>{td.get('loss_function', 'N/A')}</td>
            </tr>
    """
    
    if td.get('normalization'):
        html += f"""
            <tr>
                <th style="background: #3a3a3a; color: #fff;">Normalization</th>
                <td>{td.get('normalization')}</td>
            </tr>
        """
    
    html += """
        </table>
    </div>
    """
    return html


def render_provenance(data: Dict[str, Any]) -> str:
    """Render provenance section."""
    prov = data.get('provenance', {})
    
    html = f"""
    <div class="section">
        <div class="section-title">Provenance</div>
        <table class="info-table">
            <tr>
                <th style="width: 250px;">Created At</th>
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
    <div class="section">
        <div class="section-title">Column Statistics</div>
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
    """
    return html


def render_html(model_card_json: Dict[str, Any]) -> str:
    """Render complete HTML model card."""
    
    # Render all sections
    sections = [
        render_model_identification(model_card_json),
        render_training_metrics(model_card_json),
        render_model_quality(model_card_json),
        render_training_dataset(model_card_json),
        render_feature_inventory(model_card_json),
        render_training_configuration(model_card_json),
        render_model_architecture(model_card_json),
        render_technical_details(model_card_json),
        render_provenance(model_card_json),
        render_column_statistics(model_card_json),
    ]
    
    model_name = model_card_json.get('model_identification', {}).get('name', 'Model Card')
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Model Card - {model_name}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Courier New', monospace;
            background: #fff;
            color: #000;
            line-height: 1.4;
            padding: 20px;
        }}
        
        .page {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 40px;
        }}
        
        .section {{
            margin: 30px 0;
            page-break-inside: avoid;
        }}
        
        .section-title {{
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
            margin-bottom: 15px;
            letter-spacing: 1px;
        }}
        
        .header {{
            border-bottom: 4px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            font-size: 36px;
            font-weight: bold;
            letter-spacing: -1px;
            color: #000;
            margin-bottom: 10px;
        }}
        
        .header .meta {{
            font-size: 14px;
            color: #000;
            margin-top: 8px;
        }}
        
        .controls {{
            margin-bottom: 20px;
            padding: 15px;
            background: #fff;
            border: 1px solid #000;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }}
        
        .btn {{
            padding: 8px 16px;
            background: #000;
            color: #fff;
            border: 1px solid #000;
            cursor: pointer;
            font-size: 14px;
            font-family: 'Courier New', monospace;
        }}
        
        .btn:hover {{
            background: #333;
        }}
        
        .btn-secondary {{
            background: #fff;
            color: #000;
        }}
        
        .btn-secondary:hover {{
            background: #f5f5f5;
        }}
        
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin: 15px 0;
        }}
        
        .metric {{
            border: 1px solid #000;
            padding: 12px;
        }}
        
        .metric-label {{
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }}
        
        .metric-value {{
            font-size: 24px;
            font-weight: bold;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            margin: 15px 0;
        }}
        
        th {{
            background: #000;
            color: #fff;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            font-size: 13px;
            text-transform: uppercase;
        }}
        
        td {{
            border-bottom: 1px solid #ccc;
            padding: 8px 10px;
        }}
        
        tr:hover {{
            background: #f5f5f5;
        }}
        
        .technical-appendix tr:hover {{
            background: #3a3a3a !important;
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
            background: #fff;
            color: #000;
            border: 1px solid #000;
            font-size: 12px;
            font-family: 'Courier New', monospace;
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
            background: #fff;
            border-left: 3px solid #000;
            padding-left: 10px;
        }}
        
        .warnings-list {{
            margin: 15px 0;
        }}
        
        .warning-item {{
            padding: 15px;
            margin-bottom: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
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
            background: #fff;
            padding: 2px 6px;
            border: 1px solid #000;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }}
        
        /* Print Styles */
        @media print {{
            @page {{
                size: letter;
                margin: 0.75in;
            }}
            
            body {{
                background: white;
                padding: 0;
            }}
            
            .container {{
                padding: 0;
                max-width: 100%;
            }}
            
            .controls {{
                display: none;
            }}
            
            .section {{
                page-break-inside: avoid;
            }}
            
            .metrics-grid {{
                grid-template-columns: repeat(2, 1fr) !important;
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
            
            .header {{
                background: #fff !important;
                color: #000 !important;
                padding: 40px 0 !important;
            }}
            
            .header h1 {{
                color: #000 !important;
            }}
        }}
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>MODEL CARD: {model_name.upper()}</h1>
            <div class="meta">
                <strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
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
            var sections = document.querySelectorAll('.section');
            sections.forEach(function(section) {{
                var table = section.querySelector('#feature-table');
                if (table) {{
                    table.style.display = 'block';
                    var icon = section.querySelector('#toggle-icon');
                    if (icon) icon.textContent = '▲';
                }}
            }});
        }}
        
        function collapseAll() {{
            var sections = document.querySelectorAll('.section');
            sections.forEach(function(section) {{
                var table = section.querySelector('#feature-table');
                if (table) {{
                    table.style.display = 'none';
                    var icon = section.querySelector('#toggle-icon');
                    if (icon) icon.textContent = '▼';
                }}
            }});
        }}
        
        function toggleFeatures() {{
            var table = document.getElementById('feature-table');
            var icon = document.getElementById('toggle-icon');
            if (table.style.display === 'none') {{
                table.style.display = 'block';
                icon.textContent = '▲';
            }} else {{
                table.style.display = 'none';
                icon.textContent = '▼';
            }}
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

