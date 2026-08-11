from PIL import Image, ImageDraw
import sys

def process_image(input_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    # Tolerance for white background
    threshold = 240
    for item in datas:
        # if pixel is close to white, make it transparent
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    
    # Save as 512x512
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save('assets/icons/icon-512.png', 'PNG')
    
    # Save as 192x192
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save('assets/icons/icon-192.png', 'PNG')
    
    # Save as logo.png
    img_logo = img.resize((256, 256), Image.Resampling.LANCZOS)
    img_logo.save('images/logo.png', 'PNG')
    
    print("Logo processed successfully!")

if __name__ == "__main__":
    input_file = r"C:\Users\mohammed\.gemini\antigravity\brain\535829c9-1332-4dff-8970-aca18e632200\.user_uploaded\media_1786459431460.png"
    process_image(input_file)
