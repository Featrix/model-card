# Featrix Model Card - Standalone JavaScript

Standalone JavaScript renderer for Featrix Sphere Model Card JSON. No dependencies required.

## Installation

### Via Featrix CDN (Recommended)

```html
<script src="https://bits.featrix.com/js/featrix-modelcard/model-card.js"></script>
```

### Via npm CDN

```html
<!-- Using unpkg -->
<script src="https://unpkg.com/@featrix/modelcard-js@latest/model-card.js"></script>

<!-- Or using jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@featrix/modelcard-js@latest/model-card.js"></script>
```

### Via npm

```bash
npm install @featrix/modelcard-js
```

Then include from `node_modules`:
```html
<script src="node_modules/@featrix/modelcard-js/model-card.js"></script>
```

### Direct Download

Download `model-card.js` from the repository and host it yourself.

## Usage

### Include the script

```html
<script src="https://bits.featrix.com/js/featrix-modelcard/model-card.js"></script>
```

### Render HTML

```javascript
// Your model card JSON
const modelCardJson = {
  model_identification: { ... },
  training_dataset: { ... },
  // ... etc
};

// Render to HTML string
const html = FeatrixModelCard.renderHTML(modelCardJson);

// Insert into page
document.getElementById('container').innerHTML = html;
```

### Complete Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Model Card</title>
</head>
<body>
    <div id="model-card-container"></div>
    
    <script src="https://bits.featrix.com/js/featrix-modelcard/model-card.js"></script>
    <script>
        // Load your model card JSON
        fetch('model_card.json')
            .then(response => response.json())
            .then(data => {
                const html = FeatrixModelCard.renderHTML(data);
                const container = document.getElementById('model-card-container');
                container.innerHTML = html;
                
                // Attach event listeners for expand/collapse buttons
                // (Required when using innerHTML, as script tags don't execute)
                FeatrixModelCard.attachEventListeners(container);
            });
    </script>
</body>
</html>
```

## Features

- No dependencies - pure vanilla JavaScript
- Works in browsers and Node.js
- Generates complete HTML with embedded CSS
- Collapsible sections with expand/collapse all functionality
- Print-friendly styles

## API

### `FeatrixModelCard.renderHTML(modelCardJson)`

Renders a complete HTML document from model card JSON.

**Parameters:**
- `modelCardJson` (Object): Featrix Sphere Model Card JSON object

**Returns:**
- `string`: Complete HTML document as a string

### `FeatrixModelCard.attachEventListeners(containerElement)`

Attaches event listeners to expand/collapse buttons. **Call this after inserting HTML via `innerHTML`**, as script tags don't execute when inserted this way.

**Parameters:**
- `containerElement` (Element, optional): Container element where HTML was inserted. Defaults to `document`.

**Example:**
```javascript
const html = FeatrixModelCard.renderHTML(modelCardJson);
container.innerHTML = html;
FeatrixModelCard.attachEventListeners(container);
```

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge).

