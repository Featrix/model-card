"""
Featrix Model Card - Python Package

Render Featrix Model Card JSON to HTML or plain text.

HTML rendering delegates to the canonical JavaScript renderer (loaded from CDN),
ensuring the Python output always matches the JS version.

Text rendering is a standalone Python implementation for terminal/log output.
"""

from .html_renderer import render_html, render_to_file as render_html_to_file
from .text_renderer import (
    render_brief_text,
    render_detailed_text,
    render_to_file as render_text_to_file,
)

__version__ = "1.17.1"


def print_html(model_card_json, file=None, **kwargs):
    """
    Render model card to HTML and print it.

    Args:
        model_card_json: Model card JSON dictionary.
        file: File-like object to print to (default: sys.stdout).
        **kwargs: Passed to render_html (show_sphere, session_id, cdn_url).

    Returns:
        str: The rendered HTML string.
    """
    html = render_html(model_card_json, **kwargs)
    print(html, file=file)
    return html


def print_text(model_card_json, detailed=True, file=None):
    """
    Render model card to text and print it.

    Args:
        model_card_json: Model card JSON dictionary.
        detailed: If True, render detailed version; if False, render brief version.
        file: File-like object to print to (default: sys.stdout).

    Returns:
        str: The rendered text string.
    """
    if detailed:
        text = render_detailed_text(model_card_json)
    else:
        text = render_brief_text(model_card_json)
    print(text, file=file)
    return text


__all__ = [
    "render_html",
    "render_html_to_file",
    "render_brief_text",
    "render_detailed_text",
    "render_text_to_file",
    "print_html",
    "print_text",
]
