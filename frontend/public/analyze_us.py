import os
from collections import Counter
try:
    from PIL import Image
except ImportError:
    pass

def get_dominant_color(image_path):
    try:
        img = Image.open(image_path).convert('RGB').resize((50, 50))
        width, height = img.size
        img = img.crop((width*0.25, height*0.25, width*0.75, height*0.75))
        pixels = list(img.getdata())
        quantized = [(r//32*32, g//32*32, b//32*32) for r, g, b in pixels]
        return Counter(quantized).most_common(1)[0][0]
    except Exception as e:
        return None

def color_name(rgb):
    r, g, b = rgb
    colors = {
        'Black': (0, 0, 0), 'White': (255, 255, 255), 'Grey': (128, 128, 128),
        'Navy': (0, 0, 128), 'Teal': (0, 128, 128), 'Olive': (128, 128, 0),
        'Maroon': (128, 0, 0), 'Charcoal': (54, 69, 79), 'Cream': (255, 253, 208),
        'Rust': (183, 65, 14), 'Bottle Green': (0, 100, 0), 'Plum': (221, 160, 221),
        'Ivory': (255, 255, 240), 'Gold': (255, 215, 0), 'Brown': (165, 42, 42)
    }
    min_dist = float('inf')
    best = "Unknown"
    for name, (cr, cg, cb) in colors.items():
        dist = (r-cr)**2 + (g-cg)**2 + (b-cb)**2
        if dist < min_dist:
            min_dist = dist; best = name
    return best

print("Analyzing unstitched images (us_1 to us_10)...")
for i in range(1, 11):
    colors = []
    for j in range(1, 5):
        path = f"/Users/danishraza/Downloads/TailorHub/frontend/public/catalog/garments/us_{i}-{j}.jpg"
        rgb = get_dominant_color(path)
        colors.append(f"{color_name(rgb)} {rgb}" if rgb else "Not Found")
    print(f"us_{i}: {colors}")
