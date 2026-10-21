import os
import zipfile
import sys

DEST_ZIP = r"C:\Users\mohammed\Downloads\youssef-platform-v2-full-source.zip"
WORKSPACE_ROOT = os.path.abspath(".")

print(f"Packaging workspace {WORKSPACE_ROOT} to {DEST_ZIP}...")

# Directories to skip completely
EXCLUDE_DIRS = {
    "node_modules",
    "dist",
    ".git",
    "node-v20.10.0-win-x64",
    ".cache",
    "__pycache__",
    ".system_generated",
    "v2-app-backup-قبل-4c",
    "v2-app-backup-قبل-4d",
    "v2-app-backup-قبل-5",
    "v2-app-backup-قبل-game-closed",
    "backups",
    "backup",
}

# File extensions or specific files to skip
EXCLUDE_EXTENSIONS = {".zip", ".pyc", ".log"}

file_count = 0
total_uncompressed_bytes = 0

with zipfile.ZipFile(DEST_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        # Modify dirs in-place to avoid descending into excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".git")]

        rel_root = os.path.relpath(root, WORKSPACE_ROOT)
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in EXCLUDE_EXTENSIONS:
                continue
            if file == "youssef-platform-v2-full-source.zip":
                continue

            full_path = os.path.join(root, file)
            if rel_root == ".":
                arcname = file
            else:
                arcname = os.path.join(rel_root, file)

            try:
                stat = os.stat(full_path)
                # Skip files larger than 50MB (like huge raw binaries if any)
                if stat.st_size > 50 * 1024 * 1024:
                    print(f"Skipping large file ({stat.st_size} bytes): {arcname}")
                    continue

                zipf.write(full_path, arcname)
                file_count += 1
                total_uncompressed_bytes += stat.st_size
            except Exception as e:
                print(f"Warning: could not add {arcname}: {e}")

zip_size = os.path.getsize(DEST_ZIP)
print(f"\nSUCCESS!")
print(f"Output File: {DEST_ZIP}")
print(f"File Count: {file_count} files")
print(f"Uncompressed Size: {total_uncompressed_bytes / (1024*1024):.2f} MB")
print(f"Compressed ZIP Size: {zip_size / (1024*1024):.2f} MB")
