import sys
from PIL import Image, ImageDraw

def process_image(input_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Make square
    size = min(width, height)
    left = (width - size) / 2
    top = (height - size) / 2
    right = (width + size) / 2
    bottom = (height + size) / 2
    
    img = img.crop((left, top, right, bottom))
    
    # Create circular mask
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    
    # Apply mask
    circular_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circular_img.paste(img, (0, 0), mask)
    
    # Save sizes
    circular_img.resize((512, 512), Image.Resampling.LANCZOS).save('assets/icons/icon-512.png', 'PNG')
    circular_img.resize((192, 192), Image.Resampling.LANCZOS).save('assets/icons/icon-192.png', 'PNG')
    circular_img.resize((256, 256), Image.Resampling.LANCZOS).save('images/logo.png', 'PNG')
    
    print("Teacher logo processed successfully as circular PNG.")

if __name__ == "__main__":
    input_file = r"C:\Users\mohammed\.gemini\antigravity\brain\535829c9-1332-4dff-8970-aca18e632200\.user_uploaded\media_1786463475405.jpg"
    process_image(input_file)
