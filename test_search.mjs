import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodebaseSearchClient } from '@morphllm/morphsdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const search = new CodebaseSearchClient({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  workspace: __dirname,
  provider: 'anthropic'
});

console.log(' Morph 코드베이스 분석 시작...\n');

const result = await search.search({ query: 'pos 프로젝트 구조 설명' });

console.log('분석 결과:');
console.log(result);
process.exit(0);