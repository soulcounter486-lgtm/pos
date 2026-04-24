with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Correct UTF-8 byte sequences for Korean characters:
# 'POS 스탠다랑' = POS \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91
# '사장님이 pos 스탠다' = \xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91

# Find and print the exact bytes for the corrupted text
idx = content.find(b"receipt_header: data.receipt_header || 'POS ")
if idx != -1:
    snippet = content[idx:idx+100]
    print(f"Line 110 pattern: {snippet}")

idx = content.find(b"settings.staff_header_text || 'POS ")
if idx != -1:
    snippet = content[idx:idx+50]
    print(f"Line 1262 pattern: {snippet}")
