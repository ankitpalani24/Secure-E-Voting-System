import os
import glob
from pathlib import Path

CLIENT_DIR = Path(r"c:\Users\ankit\OneDrive\Documents\HTML\voting-system\client")

# Search all .html and .js files in the client folder recursively
html_files = glob.glob(str(CLIENT_DIR / "**/*.html"), recursive=True)
js_files = glob.glob(str(CLIENT_DIR / "**/*.js"), recursive=True)

def get_relative_prefix_to_client(filepath):
    # calculate depth relative to client dir
    file_path = Path(filepath)
    # The parent directory of the file relative to the client directory
    # e.g., if filepath is client/admin/dashboard/dashboard.html
    # parent relative to client is 'admin/dashboard'
    # which has 2 parts, so depth is 2.
    relative_parent = file_path.parent.relative_to(CLIENT_DIR)
    
    parts = relative_parent.parts
    if len(parts) == 0:
        return "./" # It's in client folder directly
    
    # Otherwise, it's len(parts) "..\\" or "../"
    return "../" * len(parts)

for filepath in html_files + js_files:
    prefix = get_relative_prefix_to_client(filepath)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    
    # 1. Replace '/voting-system/client/' with the relative path to client
    content = content.replace('/voting-system/client/', prefix)
    
    # 2. Fix the javascript login redirects which are hardcoded incorrectly as '../login'
    # Currently they use: window.location.href = '../login/login.html';
    # And there might be double quotes or single quotes.
    if filepath.endswith('.js'):
        content = content.replace("= '../login/login.html'", f"= '{prefix}login/login.html'")
        content = content.replace('= "../login/login.html"', f'= "{prefix}login/login.html"')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated links in: {filepath}")

print("Done updating files.")
