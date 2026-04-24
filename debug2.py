with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Find the byte pattern for line 110
idx = content.find(b"receipt_header: data.receipt_header")
if idx != -1:
    snippet = content[idx:idx+150]
    print(f"Found at {idx}: {snippet}")
    
# Find the byte pattern for line 1262
idx = content.find(b"settings.staff_header_text ||")
if idx != -1:
    snippet = content[idx:idx+50]
    print(f"Found at {idx}: {snippet}")
