# pyright: ignore[missing-import]
from PIL import Image

def process():
    path = "C:/Users/yeash/.gemini/antigravity-ide/brain/cc560e59-c428-4920-99c9-11751eac1711/.tempmediaStorage/media_cc560e59-c428-4920-99c9-11751eac1711_1786346052555.png"
    img = Image.open(path).convert("RGBA")
    
    min_x, min_y = img.width, img.height
    max_x, max_y = 0, 0
    
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = img.getpixel((x, y))
            # Ignore white/near-white pixels
            if a > 50 and not (r > 240 and g > 240 and b > 240):
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
                
    print(f"Bounding box: {min_x}, {min_y}, {max_x}, {max_y}")
    
    if min_x <= max_x and min_y <= max_y:
        # Add a tiny padding
        pad = 2
        min_x = max(0, min_x - pad)
        min_y = max(0, min_y - pad)
        max_x = min(img.width - 1, max_x + pad)
        max_y = min(img.height - 1, max_y + pad)
        
        cropped = img.crop((min_x, min_y, max_x + 1, max_y + 1))
        
        # Remove background (make white transparent)
        data = cropped.getdata()
        new_data = []
        for item in data:
            if item[0] > 230 and item[1] > 230 and item[2] > 230:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
                
        cropped.putdata(new_data)
        cropped.save("public/language-icon.png", "PNG")
        print("Success!")
    else:
        print("No object found!")

if __name__ == "__main__":
    process()
