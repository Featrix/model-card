# Featrix Model Card - Python Package

Python package for rendering Featrix Sphere Model Card JSON to HTML or plain text.

## Installation

```bash
pip install featrix-modelcard
```

## Usage

### HTML Renderer

#### Render to File

```python
from featrix_modelcard import render_html_to_file
import json

# Load model card JSON
with open('model_card.json', 'r') as f:
    model_card = json.load(f)

# Generate HTML file
render_html_to_file(model_card, 'output.html')
```

#### Render to String

```python
from featrix_modelcard import render_html

# Get HTML as a string
html_string = render_html(model_card)

# Print HTML to stdout
print(html_string)

# Or use the convenience function
from featrix_modelcard import print_html
print_html(model_card)
```

### Text Renderer

#### Render to File

```python
from featrix_modelcard import render_text_to_file

# Detailed text output
render_text_to_file(model_card, 'output_detailed.txt', detailed=True)

# Brief text output
render_text_to_file(model_card, 'output_brief.txt', detailed=False)
```

#### Render to String

```python
from featrix_modelcard import render_brief_text, render_detailed_text

# Get text as strings
brief = render_brief_text(model_card)
detailed = render_detailed_text(model_card)

# Print to stdout
print(brief)
print(detailed)

# Or use the convenience function
from featrix_modelcard import print_text
print_text(model_card, detailed=True)   # Detailed version
print_text(model_card, detailed=False)  # Brief version
```

### Complete Example

```python
import json
from featrix_modelcard import render_html, render_detailed_text, print_text

# Load model card JSON
with open('model_card.json', 'r') as f:
    model_card = json.load(f)

# Print brief summary to console
print_text(model_card, detailed=False)

# Get HTML string for embedding in web page
html = render_html(model_card)

# Get detailed text for documentation
detailed_text = render_detailed_text(model_card)
```

## API Reference

### HTML Functions

- `render_html(model_card_json)` → `str`: Returns HTML string
- `render_html_to_file(model_card_json, output_path)` → `str`: Saves HTML to file, returns path
- `print_html(model_card_json, file=None)` → `str`: Prints HTML to stdout or file, returns HTML string

### Text Functions

- `render_brief_text(model_card_json)` → `str`: Returns brief text string
- `render_detailed_text(model_card_json)` → `str`: Returns detailed text string
- `render_text_to_file(model_card_json, output_path, detailed=True)` → `str`: Saves text to file, returns path
- `print_text(model_card_json, detailed=True, file=None)` → `str`: Prints text to stdout or file, returns text string

## Features

- **HTML Renderer**: Static HTML with collapsible sections, expand all functionality, and print-friendly CSS
- **Text Renderer**: Plain text output in both brief and detailed formats
- **String Output**: All render functions return strings that can be printed, saved, or embedded
- No external dependencies (uses Python standard library only)

## Model Card JSON Format

Expects Featrix Sphere Model Card JSON format. See the specification for details.

