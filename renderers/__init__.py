"""
Featrix Sphere Model Card Renderers

This package provides three renderers for Featrix Sphere Model Card JSON:
1. HTML renderer - Static HTML with collapsible sections and print-friendly CSS
2. Text renderer - Plain text output in brief and detailed formats
3. React component - Dynamic React component with interactive charts
"""

from .html_renderer import render_html, render_to_file as render_html_to_file
from .text_renderer import render_brief_text, render_detailed_text, render_to_file as render_text_to_file

__all__ = [
    'render_html',
    'render_html_to_file',
    'render_brief_text',
    'render_detailed_text',
    'render_text_to_file',
]

