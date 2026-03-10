# Featrix Model Card - Python Package

Python package for rendering Featrix Model Card JSON to HTML or plain text.

**HTML rendering** delegates to the canonical JavaScript renderer loaded from CDN,
ensuring the Python output always matches the JS version.

**Text rendering** is a standalone Python implementation for terminal/log output.

## Installation

```bash
pip install featrix-modelcard
```

## Usage

### HTML Renderer

The HTML renderer generates a standalone page that loads `model-card.js` from the
Featrix CDN. The JavaScript renderer handles all layout, styling, and interactivity.

```python
from featrix_modelcard import render_html, render_html_to_file

# Load model card JSON
import json
with open('model_card.json', 'r') as f:
    model_card = json.load(f)

# Render to file
render_html_to_file(model_card, 'output.html')

# Render to string
html = render_html(model_card)

# With 3D sphere visualization
html = render_html(model_card, show_sphere=True)

# With explicit session ID for sphere
html = render_html(model_card, show_sphere=True, session_id='my-session-id')

# Override CDN URL (e.g. for local development)
html = render_html(model_card, cdn_url='http://localhost:8080/model-card.js')
```

### Text Renderer

```python
from featrix_modelcard import render_brief_text, render_detailed_text, print_text

# Brief summary
print_text(model_card, detailed=False)

# Detailed output
print_text(model_card, detailed=True)

# Get as strings
brief = render_brief_text(model_card)
detailed = render_detailed_text(model_card)
```

## API Reference

### HTML Functions

- `render_html(model_card_json, *, show_sphere=False, session_id=None, cdn_url=None)` -> `str`
- `render_html_to_file(model_card_json, output_path, *, show_sphere=False, session_id=None, cdn_url=None)` -> `str`
- `print_html(model_card_json, file=None, **kwargs)` -> `str`

### Text Functions

- `render_brief_text(model_card_json)` -> `str`
- `render_detailed_text(model_card_json)` -> `str`
- `render_text_to_file(model_card_json, output_path, detailed=True)` -> `str`
- `print_text(model_card_json, detailed=True, file=None)` -> `str`

## Architecture

The HTML renderer is a thin wrapper that embeds your model card JSON into a page
that loads the canonical `FeatrixModelCard` JavaScript renderer from the CDN.
This means:

- Python HTML output is always in sync with the JS version
- No rendering logic to maintain in Python
- All styling, interactivity, and features come from the JS renderer
- Zero external Python dependencies

The text renderer is a standalone Python implementation for use in terminals,
logs, and non-browser contexts.
