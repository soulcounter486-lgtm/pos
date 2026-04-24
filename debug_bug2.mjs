import { WarpGrepClient } from '@morphllm/morphsdk';

const grep = new WarpGrepClient({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  provider: 'anthropic'
});

console.log('문제 정확한 원인 분석\n');
console.log('='.repeat(50));

const result = await grep.execute({
  pattern: 'fetchOrders\\(\\)',
  paths: ['components/'],
  filePattern: 'StaffPos.tsx'
});

console.log('fetchOrders 호출되는 곳:');
result.contexts?.forEach((ctx: any, i: number) => {
  console.log(`\n[${i+1}] ${ctx.file}`);
  console.log(ctx.content?.slice(0, 500));
});

console.log('\n' + '='.repeat(50));
process.exit(0);