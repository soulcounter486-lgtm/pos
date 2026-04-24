const fetch = require('node:http').request || require('node:https').request;

const https = require('node:https');

const data = JSON.stringify({
  model: 'gpt-3.5-turbo',
  prompt: 'Hi',
  max_tokens: 10
});

const options = {
  hostname: 'api.morphllm.com',
  path: '/v1/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      if (result.data) {
        console.log('Morph API 연결 성공:', result.data);
      } else {
        console.log('Morph API 응답:', body);
      }
    } catch(e) {
      console.log('Morph API 응답:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Morph API 오류:', e.message);
});

req.write(data);
req.end();