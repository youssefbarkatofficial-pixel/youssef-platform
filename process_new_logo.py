import sys
from PIL import Image

def process_image(input_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # We want the far left logo. The image has 3 columns.
    # Let's crop the left 33% of the image.
    left_crop = img.crop((0, 0, int(width / 3.2), height))
    
    # Now find the bounding box of the non-white content in this crop
    datas = left_crop.getdata()
    min_x, min_y = left_crop.size[0], left_crop.size[1]
    max_x, max_y = 0, 0
    
    threshold = 240
    new_data = []
    
    for y in range(left_crop.size[1]):
        for x in range(left_crop.size[0]):
            pixel = left_crop.getpixel((x, y))
            if pixel[0] > threshold and pixel[1] > threshold and pixel[2] > threshold:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(pixel)
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y

    left_crop.putdata(new_data)
    
    # Add a little padding
    padding = 20
    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(left_crop.size[0], max_x + padding)
    max_y = min(left_crop.size[1], max_y + padding)
    
    final_logo = left_crop.crop((min_x, min_y, max_x, max_y))
    
    # Make it square
    fw, fh = final_logo.size
    size = max(fw, fh)
    square_bg = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    offset = ((size - fw) // 2, (size - fh) // 2)
    square_bg.paste(final_logo, offset)
    
    # Save sizes
    square_bg.resize((512, 512), Image.Resampling.LANCZOS).save('assets/icons/icon-512.png', 'PNG')
    square_bg.resize((192, 192), Image.Resampling.LANCZOS).save('assets/icons/icon-192.png', 'PNG')
    square_bg.resize((256, 256), Image.Resampling.LANCZOS).save('images/logo.png', 'PNG')
    
    print(f"Logo cropped successfully. Original size: {width}x{height}. Final size: {size}x{size}")

if __name__ == "__main__":
    input_file = r"C:\Users\mohammed\.gemini\antigravity\brain\535829c9-1332-4dff-8970-aca18e632200\.user_uploaded\media_1786461253970.png"
    process_image(input_file)
