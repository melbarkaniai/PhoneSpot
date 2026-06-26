"""Test the CertiDeal regex against actual HTML from the diagnostic."""
import re
import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Actual HTML from CertiDeal (from the diagnostic output)
html_snippet = (
    '<a class="btn btn-default btn-round" '
    'href="https://certideal.com/vendre-mon-smartphone?category=iphone-14-pro&amp;capacity=114" '
    'onclick="$(this).addClass(\'active\')"> 128 Go </a>'
    '<a class="btn btn-default btn-round" '
    'href="https://certideal.com/vendre-mon-smartphone?category=iphone-14-pro&amp;capacity=142" '
    'onclick="$(this).addClass(\'active\')"> 256 Go </a>'
    '<a class="btn btn-default btn-round" '
    'href="https://certideal.com/vendre-mon-smartphone?category=iphone-14-pro&amp;capacity=640" '
    'onclick="$(this).addClass(\'active\')"> 1 To </a>'
)

print("=== OLD REGEX (broken) ===")
old = re.findall(r'capacity=(\d+)[^"]*"[^>]*>\s*(\d{2,4})\s*[Gg][Oo]', html_snippet)
print(f"Matches: {old}")

old_to = re.findall(r'capacity=(\d+)[^"]*"[^>]*>\s*1\s*[Tt][Oo]', html_snippet)
print(f"1-To matches: {old_to}")

print("\n=== NEW REGEX v1 (simpler [^>]*) ===")
new1 = re.findall(r'capacity=(\d+)[^>]*>\s*(\d{2,4})\s*[Gg][Oo]', html_snippet)
print(f"Matches: {new1}")

new1_to = re.findall(r'capacity=(\d+)[^>]*>\s*1\s*[Tt][Oo]', html_snippet)
print(f"1-To matches: {new1_to}")

print("\n=== NEW REGEX v2 (href capture) ===")
new2 = re.findall(r'capacity=(\d+)[^"]*"[^>]*>\s*(\d{2,4})\s*[Gg]o', html_snippet)
print(f"Matches: {new2}")

print("\n=== NEW REGEX v3 (just capacity= then number) ===")
# Find all capacity=X pairs
caps = re.findall(r'capacity=(\d+)', html_snippet)
print(f"All capacity IDs: {caps}")
# Find all Go labels
labels = re.findall(r'>\s*(\d{2,4})\s*[Gg][Oo]\s*<', html_snippet)
labels_to = re.findall(r'>\s*1\s*[Tt][Oo]\s*<', html_snippet)
print(f"Go labels: {labels}")
print(f"To labels (1 To): {labels_to}")

print("\n=== MANUAL TRACE ===")
# Find positions where 'capacity=' starts
for m in re.finditer(r'capacity=\d+', html_snippet):
    print(f"Found '{m.group()}' at pos {m.start()}")
    # What comes after?
    after = html_snippet[m.start():m.start()+150]
    print(f"  Context: {repr(after)}")

print("\n=== HTML entity version ===")
# What if we HTML-unescape first?
import html as html_module
html_decoded = html_module.unescape(html_snippet)
print(f"Decoded snippet: {repr(html_decoded[:300])}")
new_decoded = re.findall(r'capacity=(\d+)[^>]*>\s*(\d{2,4})\s*[Gg][Oo]', html_decoded)
print(f"Matches on decoded: {new_decoded}")
