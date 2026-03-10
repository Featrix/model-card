#!/usr/bin/env python3
"""
HTML renderer for Featrix Model Card JSON.

Generates a standalone HTML page that loads the canonical JavaScript renderer
from the CDN, ensuring the Python output always matches the JS version.
"""

import json
from datetime import datetime
from typing import Any, Dict, Optional


CDN_BASE = "https://bits.featrix.com/js/featrix-modelcard"


def render_html(
    model_card_json: Dict[str, Any],
    *,
    show_sphere: bool = False,
    session_id: Optional[str] = None,
    cdn_url: Optional[str] = None,
) -> str:
    """
    Render a model card JSON dict to a standalone HTML page.

    Uses the canonical FeatrixModelCard JavaScript renderer loaded from CDN,
    so the output is always in sync with the JS version.

    Args:
        model_card_json: Model card JSON dictionary.
        show_sphere: If True, enable the 3D sphere visualization thumbnail.
        session_id: Explicit session ID for the sphere viewer. If not provided,
                    it will be resolved from the model card data.
        cdn_url: Override the CDN URL for model-card.js.

    Returns:
        str: Complete standalone HTML document.
    """
    js_url = cdn_url or f"{CDN_BASE}/model-card.js"
    model_name = (model_card_json.get("model_identification") or {}).get(
        "name", "Model Card"
    )

    # Build the options object for renderHTML
    options_parts = []
    if show_sphere:
        options_parts.append("showSphere: true")
    if session_id:
        options_parts.append(f'sessionId: {json.dumps(session_id)}')
    options_js = "{" + ", ".join(options_parts) + "}" if options_parts else "{}"

    json_str = json.dumps(model_card_json, indent=2)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Card - {_escape_html(model_name)}</title>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            background: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }}
    </style>
</head>
<body>
    <div id="model-card-container"></div>
    <script src="{_escape_html(js_url)}"></script>
    <script>
        var modelCardJson = {json_str};
        var options = {options_js};
        var container = document.getElementById('model-card-container');
        container.innerHTML = FeatrixModelCard.renderHTML(modelCardJson, options);
        FeatrixModelCard.attachEventListeners(container);
    </script>
</body>
</html>"""


def render_to_file(
    model_card_json: Dict[str, Any],
    output_path: str,
    *,
    show_sphere: bool = False,
    session_id: Optional[str] = None,
    cdn_url: Optional[str] = None,
) -> str:
    """
    Render model card JSON to an HTML file.

    Args:
        model_card_json: Model card JSON dictionary.
        output_path: Path to write the HTML file.
        show_sphere: If True, enable the 3D sphere visualization.
        session_id: Explicit session ID for the sphere viewer.
        cdn_url: Override the CDN URL for model-card.js.

    Returns:
        str: The output_path that was written to.
    """
    html = render_html(
        model_card_json,
        show_sphere=show_sphere,
        session_id=session_id,
        cdn_url=cdn_url,
    )
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    return output_path


def _escape_html(text: str) -> str:
    """Escape HTML special characters."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
