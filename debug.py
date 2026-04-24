with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Find the byte pattern for the corrupted text
# Search for "POS " followed by garbage
pos_pattern = b"POS "
idx = content.find(pos_pattern)
while idx != -1:
    # Print next 20 bytes after "POS "
    snippet = content[idx:idx+20]
    print(f"Found at {idx}: {snippet}")
    idx = content.find(pos_pattern, idx+1)
