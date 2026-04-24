import { WarpGrepClient } from '@morphllm/morphsdk';

const grep = new WarpGrepClient({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  provider: 'anthropic'
});

console.log(' Morph로 부대찌개 수량 롤백 버그 분석\n');
console.log('='.repeat(50));

const result = await grep.execute({
  pattern: 'setAllOrderItems|fetchOrders|pendingChanges',
  paths: ['components/'],
  filePattern: 'StaffPos.tsx'
});

console.log('検索된 패턴:');
result.contexts?.forEach((ctx: any, i: number) => {
  if (i < 10) {
    console.log(`\n[${i+1}] ${ctx.file}`);
    console.log(ctx.content?.slice(0, 300));
  }
});

console.log('\n' + '='.repeat(50));
console.log('分析 완료');
process.exit(0);