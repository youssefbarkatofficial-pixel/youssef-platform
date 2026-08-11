import cv2
import sys

video_path = "WhatsApp Video 2026-08-11 at 6.39.26 PM.mp4"
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print("Error opening video stream or file")
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = frame_count / fps

print(f"Video duration: {duration} seconds. FPS: {fps}, Total Frames: {frame_count}")

# Let's save a frame at 60s, 90s, 120s if they exist
times = [60, 90, 120, 150]
for t in times:
    if t < duration:
        frame_no = int(t * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f"frame_{t}.jpg", frame)
            print(f"Saved frame_{t}.jpg")

cap.release()
