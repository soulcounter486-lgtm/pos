with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Pattern 1: Line 110
p1 = b"receipt_header: data.receipt_header || 'POS ?\xef\xbf\xbd\xec\x8a\xa4?\xef\xbf\xbd\xeb\x9e\x91', staff_header_text: data.staff_header_text || '?\xef\xbf\xbd\xec\x82\xac?\xef\xbf\xbd\xec\x9d\xb4\xef\xbf\xbd?pos ?\xef\xbf\xbd\xec\x8a\xa4??"
r1 = b"receipt_header: data.receipt_header || 'POS \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91', staff_header_text: data.staff_header_text || '\xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91'"

# Pattern 2: Line 860, 1262, 1293, 1392
p2 = b"settings.staff_header_text || 'POS ?\xef\xbf\xbd\xec\x8a\xa4??'"
r2 = b"settings.staff_header_text || '\xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91'"

content = content.replace(p1, r1)
content = content.replace(p2, r2)

with open(r'D:\pos\components\StaffPos.tsx', 'wb') as f:
    f.write(content)

print('Fixed!')
