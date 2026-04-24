#!/usr/bin/env node
const { WarpGrepClient } = require('@morphllm/morphsdk');
const path = require('path');

const apiKey = process.env.MORPH_API_KEY;
if (!apiKey) { console.error('ERROR: MORPH_API_KEY not set'); process.exit(1); }

const [,, query, dir = '.'] = process.argv;
if (!query) {
  console.error('Usage: node scripts/morph-search.cjs "<query>" [directory]');
  process.exit(1);
}

const client = new WarpGrepClient({ apiKey });
console.log(`\n🔍 WarpGrep: "${query}"\n`);

client.execute({ query, directory: path.resolve(dir) })
  .then(result => {
    if (result?.success) {
      console.log('✅ 검색 성공!');
      if (result.summary) console.log('요약:', result.summary);
      if (result.contexts?.length) {
        result.contexts.forEach((c, i) => {
          if (c.content) console.log(`\n[${i+1}] ${c.file}\n${c.content.slice(0, 400)}`);
        });
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  })
  .catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
