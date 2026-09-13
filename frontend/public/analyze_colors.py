import os
from collections import Counter
try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Please install it with 'pip install Pillow'")
    exit(1)

def get_dominant_color(image_path):
    try:
        img = Image.open(image_path)
        img = img.convert('RGB')
        # Resize to small to average out colors and make it fast
        img = img.resize((50, 50))
        # Crop the center to avoid background (assuming clothing is in the center)
        width, height = img.size
        left = width * 0.25
        top = height * 0.25
        right = width * 0.75
        bottom = height * 0.75
        img = img.crop((left, top, right, bottom))
        
        pixels = list(img.getdata())
        # Quantize colors to reduce noise (round to nearest multiple of 32)
        quantized = [(r//32*32, g//32*32, b//32*32) for r, g, b in pixels]
        most_common = Counter(quantized).most_common(1)[0][0]
        return most_common
    except Exception as e:
        return None

def color_name(rgb):
    r, g, b = rgb
    colors = {
        'Black': (0, 0, 0), 'White': (255, 255, 255), 'Grey': (128, 128, 128),
        'Navy Blue': (0, 0, 128), 'Light Blue': (173, 216, 230), 'Blue': (0, 0, 255),
        'Dark Green': (0, 100, 0), 'Olive': (128, 128, 0), 'Green': (0, 128, 0),
        'Maroon': (128, 0, 0), 'Red': (255, 0, 0), 'Pink': (255, 192, 203),
        'Brown': (165, 42, 42), 'Tan/Beige': (210, 180, 140), 'Yellow': (255, 255, 0),
        'Orange': (255, 165, 0), 'Purple': (128, 0, 128), 'Teal': (0, 128, 128),
        'Charcoal': (54, 69, 79), 'Cream': (255, 253, 208), 'Mustard': (255, 219, 88),
        'Burgundy': (128, 0, 32), 'Plum': (221, 160, 221), 'Rust': (183, 65, 14)
    }
    
    min_dist = float('inf')
    best_name = "Unknown"
    for name, (cr, cg, cb) in colors.items():
        dist = (r - cr)**2 + (g - cg)**2 + (b - cb)**2
        if dist < min_dist:
            min_dist = dist
            best_name = name
    return best_name

print("Analyzing pent coat colors (g1 to g5)...")
for i in range(1, 6):
    colors = []
    for j in range(1, 5):
        path = f"/Users/danishraza/Downloads/TailorHub/frontend/public/catalog/garments/g{i}-{j}.jpg"
        rgb = get_dominant_color(path)
        if rgb:
            colors.append(f"{color_name(rgb)} (RGB: {rgb})")
        else:
            colors.append("Not Found")
    print(f"g{i}: {colors}")

print("\nAnalyzing shalwar kameez colors (g6 to g10)...")
for i in range(6, 11):
    colors = []
    for j in range(1, 5):
        path = f"/Users/danishraza/Downloads/TailorHub/frontend/public/catalog/garments/g{i}-{j}.jpg"
        rgb = get_dominant_color(path)
        if rgb:
            colors.append(f"{color_name(rgb)} (RGB: {rgb})")
        else:
            colors.append("Not Found")
    print(f"g{i}: {colors}")
