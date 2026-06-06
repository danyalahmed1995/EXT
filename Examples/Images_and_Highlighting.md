# Images and Highlight Section

This document specifically highlights two core features:
1. **Local Image Previews**
2. **Text & Syntax Highlighting**

## Local Image Preview

If you place an image in the same directory as your markdown file, you can preview it instantly:

![Cover Image](./cover.png)

## The Highlight Engine

EXT includes custom editor themes `extEditorTheme` and `extHighlightStyle` using the `@codemirror/language-data` pack to colorize text seamlessly.

**Python Highlight Test:**
```python
class NeuralNetwork:
    def __init__(self, layers):
        self.layers = layers
        self.weights = [np.random.randn(y, x) for x, y in zip(layers[:-1], layers[1:])]
        
    def forward(self, a):
        for w in self.weights:
            a = sigmoid(np.dot(w, a))
        return a
```

**HTML/CSS Highlight Test:**
```html
<style>
  .btn-primary {
    background: linear-gradient(135deg, #FF6B6B, #C06C84);
    border-radius: 8px;
    padding: 12px 24px;
    color: white;
    font-weight: 600;
  }
</style>
<button class="btn-primary">Click Me</button>
```

*EXT keeps everything smooth!*
