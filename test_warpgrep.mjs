import { WarpGrepClient } from '@morphllm/morphsdk';

const grep = new WarpGrepClient({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  provider: 'anthropic'
});

console.log(' Morph WarpGrep 분석 시작...\n');

const result = await grep.execute({
  pattern: 'export.*function',
  paths: ['app/', 'components/'],
  filePattern: '*.tsx'
});

console.log('검색 결과:');
console.log(JSON.stringify(result, null, 2));
process.exit(0);