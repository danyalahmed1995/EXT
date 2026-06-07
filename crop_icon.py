from PIL import Image, ImageChops

def crop_white_border(image_path, output_path):
    img = Image.open(image_path).convert("RGBA")
    
    # We want to find the bounding box of everything that is NOT the white border or transparent.
    # Actually, the user's screenshot shows an icon with a thick white border.
    # The area outside the rounded white border is probably transparent.
    # Let's get the center pixel to see if the inner area is colored.
    
    width, height = img.size
    
    # Let's scan from the center outwards to find the first white pixel? No.
    # Let's just find the bounding box of non-white AND non-transparent pixels.
    # A pixel is "white-ish" if R, G, B > 240 and A > 0.
    # A pixel is "transparent" if A == 0.
    # The actual content is not white.
    
    bbox_left = width
    bbox_right = 0
    bbox_top = height
    bbox_bottom = 0
    
    pixels = img.load()
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 0: # Not transparent
                # Not white
                if not (r > 240 and g > 240 and b > 240):
                    if x < bbox_left: bbox_left = x
                    if x > bbox_right: bbox_right = x
                    if y < bbox_top: bbox_top = y
                    if y > bbox_bottom: bbox_bottom = y
                    
    if bbox_left < bbox_right and bbox_top < bbox_bottom:
        cropped = img.crop((bbox_left, bbox_top, bbox_right + 1, bbox_bottom + 1))
        # Resize it back to the original size or keep it?
        # Tauri takes any square image and resizes it.
        # But we should probably keep it square.
        crop_width = bbox_right - bbox_left + 1
        crop_height = bbox_bottom - bbox_top + 1
        size = max(crop_width, crop_height)
        
        # Crop a square from the center of the found bbox
        center_x = (bbox_left + bbox_right) // 2
        center_y = (bbox_top + bbox_bottom) // 2
        
        half = size // 2
        square_crop = img.crop((center_x - half, center_y - half, center_x - half + size, center_y - half + size))
        
        # Resize to original size
        final_img = square_crop.resize((width, height), Image.Resampling.LANCZOS)
        final_img.save(output_path)
        print(f"Cropped to {square_crop.size} and resized to {width}x{height}")
    else:
        print("Could not find content to crop.")

crop_white_border('src-tauri/icons/icon.png', 'src-tauri/icons/icon_preview.png')
