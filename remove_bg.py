from rembg import remove
from PIL import Image

input_path = 'src-tauri/icons/icon.png'
output_path = 'src-tauri/icons/icon.png'

with open(input_path, 'rb') as i:
    input_image = i.read()
    output_image = remove(input_image)

with open(output_path, 'wb') as o:
    o.write(output_image)

print("Background removed successfully.")
