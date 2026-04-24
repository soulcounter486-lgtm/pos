import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodebaseSearchClient, WarpGrepClient, FastApplyClient } from '@morphllm/morphsdk';
import fs from 'node:fs';

const __dirname = process.cwd();

const search = new CodebaseSearchClient({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  workspace: __dirname,
  provider: 'anthropic'
});

const warpgrep = new WarpGrepClient({
  apiKey: process.env.MORPH_API_KEY || 'sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16',
  provider: 'anthropic'
});

console.log('='.repeat(60));
console.log('POS 프로젝트 전체 분석');
console.log('='.repeat(60));

console.log('\n[1] 디렉토리 구조 분석...\n');

function walkDir(dir, prefix = '') {
  const items = fs.readdirSync(dir).filter(i => !i.startsWith('.') && i !== 'node_modules' && i !== 'backup');
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      console.log(prefix + '📁 ' + item + '/');
      walkDir(fullPath, prefix + '  ');
    } else {
      console.log(prefix + '📄 ' + item);
    }
  }
}

walkDir(__dirname);

console.log('\n[2] 주요 파일 내용 분석...\n');

const keyFiles = ['package.json', 'app/layout.tsx', 'app/page.tsx', 'components/StaffPos.tsx'];

for (const file of keyFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log('\n--- ' + file + ' ---');
    console.log(content.slice(0, 500) + (content.length > 500 ? '...' : ''));
  }
}

console.log('\n' + '='.repeat(60));
console.log('분석 완료');
console.log('='.repeat(60));

process.exit(0);