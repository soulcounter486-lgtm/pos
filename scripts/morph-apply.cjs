#!/usr/bin/env node
const { FastApplyClient } = require('@morphllm/morphsdk');
const fs = require('fs');
const path = require('path');

const apiKey = process.env.MORPH_API_KEY;
if (!apiKey) { console.error('ERROR: MORPH_API_KEY not set'); process.exit(1); }

const [,, filepath, instructions, codeEdit] = process.argv;
if (!filepath || !instructions) {
  console.error('Usage: node scripts/morph-apply.cjs <filepath> "<instructions>" "<code_edit>"');
  process.exit(1);
}

const client = new FastApplyClient({ apiKey });
const absPath = path.resolve(filepath);
const originalCode = fs.readFileSync(absPath, 'utf8');

console.log(`\n🔧 Morph Fast Apply: ${filepath}`);
console.log(`📝 Instructions: ${instructions}\n`);

client.execute({
  target_filepath: filepath,
  instructions,
  code_edit: codeEdit || instructions,
  original_code: originalCode,
}).then(result => {
  if (result?.success && result?.result) {
    fs.writeFileSync(absPath, result.result, 'utf8');
    console.log('✅ 파일 업데이트 완료!');
  } else if (result?.udiff) {
    console.log('✅ FastApply 성공 (diff):\n', result.udiff.slice(0, 800));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}).catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
