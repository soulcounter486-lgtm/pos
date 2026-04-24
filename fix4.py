with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Pattern 1: Line 110 - receipt_header and staff_header_text defaults
pattern1 = b"receipt_header: data.receipt_header || 'POS ?\xef\xbf\xbd\xec\x8a\xa4?\xef\xbf\xbd\xeb\x9e\x91', staff_header_text: data.staff_header_text || '?\xef\xbf\xbd\xec\x82\xac?\xef\xbf\xbd\xec\x9d\xb4\xef\xbf\xbd?pos ?\xef\xbf\xbd\xec\x8a\xa4??"
replacement1 = b"receipt_header: data.receipt_header || 'POS \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91', staff_header_text: data.staff_header_text || '\xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91'"

# Pattern 2: Line 860, 1262, 1293, 1392 - fallback text
pattern2 = b"settings.staff_header_text || 'POS ?\xef\xbf\xbd\xec\x8a\xa4??}"
replacement2 = b"settings.staff_header_text || '\xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91'}"

content = content.replace(pattern1, replacement1)
content = content.replace(pattern2, replacement2)

with open(r'D:\pos\components\StaffPos.tsx', 'wb') as f:
    f.write(content)

print('Fixed!')
