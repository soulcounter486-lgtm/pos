with open(r'D:\pos\components\StaffPos.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
output = []
for i, line in enumerate(lines):
    if 'receipt_header' in line and 'POS' in line:
        output.append(f"Line {i+1}: {repr(line[:150])}")
    if 'settings.staff_header_text' in line and 'POS' in line:
        output.append(f"Line {i+1}: {repr(line[:150])}")

with open(r'D:\pos\output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
