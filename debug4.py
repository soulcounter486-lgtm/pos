with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Find the exact bytes for line 110
idx = content.find(b"receipt_header: data.receipt_header || 'POS ")
if idx != -1:
    # Get 180 bytes starting from "POS "
    snippet = content[idx:idx+180]
    print(f"Full pattern from 'POS ':")
    print(repr(snippet))
    print()
    
# Find the exact bytes for line 1262
idx = content.find(b"settings.staff_header_text || 'POS ")
if idx != -1:
    snippet = content[idx:idx+60]
    print(f"Full pattern from line 1262:")
    print(repr(snippet))
