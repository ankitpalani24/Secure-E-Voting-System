import os

client_dir = r"c:\Users\ankit\OneDrive\Documents\HTML\voting-system\client"

for root, _, files in os.walk(client_dir):
    for f in files:
        if f.endswith('.js'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            
            if "http://localhost:5000" in content:
                # Completely strip the http://localhost:5000 prefix ensuring relative paths like `/api/...` format seamlessly
                new_content = content.replace("http://localhost:5000", "")
                
                with open(filepath, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print(f"Sanitized: {filepath}")

print("Successfully decoupled frontend API URLs from localStorage!")
