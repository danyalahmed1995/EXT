from PIL import Image

def remove_white_fringe(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # Use a very generous threshold to kill any light fringing
                brightness = (r + g + b) / 3.0
                if brightness > 120:
                    # Fade to transparent as it gets lighter
                    new_alpha = max(0, int(a * (1.0 - (brightness - 120) / 135.0)))
                    pixels[x, y] = (0, 0, 0, new_alpha)
    img.save(output_path, "PNG")

remove_white_fringe(r"d:\AI Work\EXT\public\icon.png", r"d:\AI Work\EXT\public\icon.png")
