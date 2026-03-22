import os
import shutil

src_dir = r"c:\Users\ankit\OneDrive\Documents\HTML\voting-system\server\api"
dst_dir = r"c:\Users\ankit\OneDrive\Documents\HTML\voting-system\server"

for item in os.listdir(src_dir):
    s = os.path.join(src_dir, item)
    d = os.path.join(dst_dir, item)
    # If it already exists, replace it
    if os.path.exists(d):
        if os.path.isdir(d):
            shutil.rmtree(d)
        else:
            os.remove(d)
    shutil.move(s, d)

os.rmdir(src_dir)
print("Successfully rescued the backend files from the nested directory!")
