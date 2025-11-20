"""
Featrix Model Card - Python Package

Render Featrix Sphere Model Card JSON to HTML or plain text.
All render functions return strings that can be printed or saved to files.
"""

from .html_renderer import render_html, render_to_file as render_html_to_file
from .text_renderer import (
    render_brief_text,
    render_detailed_text,
    render_to_file as render_text_to_file,
)

__version__ = "1.0.0"


def print_html(model_card_json, file=None):
    """
    Render model card to HTML and print it.
    
    Args:
        model_card_json: Model card JSON dictionary
        file: File-like object to print to (default: sys.stdout)
    
    Returns:
        str: The rendered HTML string
    """
    html = render_html(model_card_json)
    print(html, file=file)
    return html


def print_text(model_card_json, detailed=True, file=None):
    """
    Render model card to text and print it.
    
    Args:
        model_card_json: Model card JSON dictionary
        detailed: If True, render detailed version; if False, render brief version
        file: File-like object to print to (default: sys.stdout)
    
    Returns:
        str: The rendered text string
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

