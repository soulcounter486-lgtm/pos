with open(r'D:\pos\components\StaffPos.tsx', 'rb') as f:
    content = f.read()

# Pattern 2: Line 1262, 1293, 1392 - fallback text
# POS ?\xef\xbf\xbd\xec\x8a\xa4?? should be \xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91
pattern2 = b"settings.staff_header_text || 'POS ?\xef\xbf\xbd\xec\x8a\xa4??'"
replacement2 = b"settings.staff_header_text || '\xec\x80\xb4\xec\x9e\xa5\xec\x9b\x90\xec\x9d\xb4 pos \xec\x8a\xa4\xeb\x8b\xa4\xeb\x9e\x91'"

print("Pattern 2 found:", pattern2 in content)
print("Pattern 2 length:", len(pattern2))

# Try with different ending
pattern2b = b"settings.staff_header_text || 'POS ?\xef\xbf\xbd\xec\x8a\xa4??}"
print("Pattern 2b found:", pattern2b in content)

# Try with just the text part
pattern2c = b"POS ?\xef\xbf\xbd\xec\x8a\xa4??"
print("Pattern 2c found:", pattern2c in content)
