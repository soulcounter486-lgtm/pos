const path = require('node:path');
const { createCodebaseSearch } = require('@morphllm/morphsdk/codebase-search');

const __dirname = process.cwd();

const search = createCodebaseSearch({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  workspace: __dirname
});

console.log(' Morph 코드베이스 분석 시작...\n');

const result = await search.analyzeCodebase({
  question: '이 프로젝트의 전체 구조와 주요 파일을 설명해주세요'
});

console.log('분석 결과:');
console.log(result);
process.exit(0);