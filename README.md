# Featrix Model Card

Render Featrix Sphere model cards as interactive HTML, plain text, or React components.

<!-- TODO: full-width screenshot of an HTML model card rendering (~800px wide, showing collapsible sections and status badge) -->
<!-- ![Model Card Screenshot](docs/images/model-card-screenshot.png) -->

## Live Demo

<!-- TODO: host a demo page with a real model card baked in -->
<!-- Try it now: [Live Demo](https://bits.featrix.com/model-card-demo/) -->

## Choose Your Integration

| Approach | Best for | Install |
|----------|----------|---------|
| [**JavaScript (CDN)**](#javascript-cdn) | Any web page — zero build step | `<script>` tag |
| [**React Component**](#react-component) | React / Next.js apps | `npm install @featrix/modelcard` |
| [**Python Package**](#python-package) | Jupyter notebooks, server-side rendering, CLI | `pip install featrix-modelcard` |

---

## JavaScript (CDN)

Drop a single `<script>` tag into any HTML page. No bundler required.

```html
<div id="model-card"></div>

<script src="https://bits.featrix.com/js/featrix-modelcard/model-card.js"></script>
<script>
  const container = document.getElementById('model-card');
  container.innerHTML = FeatrixModelCard.renderHTML(modelCardJson);
  FeatrixModelCard.attachEventListeners(container);
</script>
```

Also available via public CDNs:

```
https://unpkg.com/@featrix/modelcard-js/model-card.js
https://cdn.jsdelivr.net/npm/@featrix/modelcard-js/model-card.js
```

### Embed in an iframe

To isolate model card styles from your page, render into an iframe:

```html
<iframe id="card-frame" style="width:100%; border:none;"></iframe>

<script src="https://bits.featrix.com/js/featrix-modelcard/model-card.js"></script>
<script>
  const doc = document.getElementById('card-frame').contentDocument;
  doc.open();
  doc.write('<html><body>' + FeatrixModelCard.renderHTML(modelCardJson) + '</body></html>');
  doc.close();
  FeatrixModelCard.attachEventListeners(doc.body);
</script>
```

### 3D Sphere Visualization

Enable the interactive 3D sphere thumbnail by passing options:

```js
const html = FeatrixModelCard.renderHTML(modelCardJson, { showSphere: true });
```

---

## React Component

```bash
npm install @featrix/modelcard recharts
```

```tsx
import ModelCard from '@featrix/modelcard';

function App() {
  return <ModelCard data={modelCardJson} />;
}
```

<!-- TODO: screenshot of React component in a dashboard layout -->
<!-- ![React Component](docs/images/react-component.png) -->

The component includes interactive charts (via Recharts), collapsible sections, and full TypeScript type definitions.

---

## Python Package

```bash
pip install featrix-modelcard
```

### Generate HTML

```python
from featrix_modelcard import render_html, render_html_to_file

# Get a complete standalone HTML document as a string
html = render_html(model_card)

# Or write it directly to a file
render_html_to_file(model_card, "output.html")
```

The generated HTML loads the canonical JS renderer from CDN, so it always matches the JavaScript output.

### Print plain text

```python
from featrix_modelcard import print_text

# Quick summary
print_text(model_card, detailed=False)

# Full details
print_text(model_card, detailed=True)
```

### Jupyter Notebook

```python
from featrix_modelcard import render_html
from IPython.display import HTML

HTML(render_html(model_card))
```

<!-- TODO: screenshot of model card rendered inline in a Jupyter notebook -->
<!-- ![Jupyter Notebook](docs/images/jupyter-notebook.png) -->

### Flask / Django

Serve the HTML string from any Python web framework:

```python
from featrix_modelcard import render_html

# Flask
@app.route("/model-card/<session_id>")
def model_card_view(session_id):
    model_card = load_model_card(session_id)  # your lookup logic
    return render_html(model_card)
```

### Enable 3D sphere

```python
html = render_html(model_card, show_sphere=True, session_id="your-session-id")
```

---

## Model Card JSON Format

All renderers consume the same JSON schema. See [model-card-schema.json](model-card-schema.json) for the full specification.

Key sections:

| Section | Contents |
|---------|----------|
| `model_identification` | Name, status, target column, training date |
| `training_dataset` | Row counts, feature names |
| `feature_inventory` | Feature types and details |
| `training_configuration` | Hyperparameters |
| `training_metrics` | Accuracy, AUC, F1, loss curves |
| `model_architecture` | Network structure |
| `model_quality` | Warnings and quality assessments |
| `technical_details` | Runtime and environment info |
| `provenance` | Creation metadata |
| `column_statistics` | Per-column stats (Embedding Space models) |

---

## Publishing

See [PUBLISH.md](PUBLISH.md) for instructions on publishing to PyPI, npm, and the Featrix CDN.

| Target | Package | Command |
|--------|---------|---------|
| PyPI | `featrix-modelcard` | `cd python && ./publish.sh` |
| npm (React) | `@featrix/modelcard` | `cd react && ./publish.sh` |
| npm (JS) | `@featrix/modelcard-js` | `cd javascript && ./publish.sh` |
| Featrix CDN | — | `cd javascript && ./publish-cdn.sh` |

## License

MIT
