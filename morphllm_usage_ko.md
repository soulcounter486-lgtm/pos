# MorphLLM API 사용 가이드 (한국어)

## 1. 사전 준비

### 1.1 API 키 설정
- 이미 API 키를 발급받았고 `.env.local` 파일에 추가했습니다.
- 현재 설정된 키: `sk-Y0KPgAwovoA9mLx675XdcLYgtxxnLIviQw1RQv38CHXPZi16`

### 1.2 라이브러리 설치
```bash
npm install morphllm
```

## 2. API 라우트 설정

### 2.1 API 라우트 파일 생성
`app/api/morphllm/route.ts` 파일을 생성하고 아래 코드를 추가합니다:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import MorphLLM from 'morphllm';

const client = new MorphLLM({
  apiKey: process.env.MORPHLLM_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: '프롬프트가 필요합니다' },
        { status: 400 }
      );
    }

    const res = await client.generate({
      model: 'gpt-3.5-turbo',
      prompt: prompt,
      maxTokens: 150,
    });

    return NextResponse.json({ 
      success: true,
      text: res.data 
    });
  } catch (error: any) {
    console.error('MorphLLM API 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'API 호출 중 오류가 발생했습니다' 
      },
      { status: error.status || 500 }
    );
  }
}
```

## 3. 프론트엔드 컴포넌트 생성

### 3.1 테스트 페이지 생성
`app/page.tsx` 파일을 수정하거나 아래와 같이 테스트용 컴포넌트를 추가합니다:

```tsx
'use client';

import { useState } from 'react';

export default function MorphLLMTest() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const res = await fetch('/api/morphllm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (data.success) {
        setResponse(data.text);
      } else {
        setError(data.error || '오류가 발생했습니다');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">MorphLLM API 테스트</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          프롬프트 입력:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="여기에 프롬프트를 입력하세요..."
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? '생성 중...' : '텍스트 생성'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          오류: {error}
        </div>
      )}

      {response && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">생성된 텍스트:</h2>
          <div className="p-4 bg-gray-100 border border-gray-300 rounded-md">
            <pre className="whitespace-pre-wrap">{response}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 4. 테스트 방법

### 4.1 개발 서버 실행
```bash
npm run dev
```

### 4.2 테스트 절차
1. 브라우저에서 `http://localhost:3000` 접속
2. 텍스트 영역에 프롬프트 입력 (예: "안녕하세요! 자기소개 부탁드려요.")
3. "텍스트 생성" 버튼 클릭
4. 생성된 텍스트가 표시되는지 확인

### 4.3 curl 테스트
```bash
curl -X POST http://localhost:3000/api/morphllm \
  -H "Content-Type: application/json" \
  -d '{"prompt": "안녕하세요! 반갑습니다."}'
```

## 5. 고급 사용법

### 5.1 다양한 모델 사용
```typescript
const res = await client.generate({
  model: 'gpt-4',  // 또는 다른 지원 모델
  prompt: prompt,
  maxTokens: 200,
  temperature: 0.7,
});
```

### 5.2 여러 프롬프트 처리
```typescript
const prompts = [
  "첫 번째 질문입니다.",
  "두 번째 질문입니다."
];

const results = await Promise.all(
  prompts.map(p => client.generate({ model: 'gpt-3.5-turbo', prompt: p }))
);
```

## 6. 오류 해결

### 6.1 일반 오류
- **401 Unauthorized**: API 키가 잘못되었거나 만료됨
- **429 Too Many Requests**: 요청 한도 초과
- **500 Internal Server Error**: 서버 오류

### 6.2 디버깅
```typescript
// 개발 환경에서 상세 로깅
if (process.env.NODE_ENV === 'development') {
  console.log('API 요청:', { model, prompt, maxTokens });
  console.log('API 응답:', res.data);
}
```

## 7. 프로덕션 환경에서의 사용

### 7.1 환경 변수 검증
```typescript
if (!process.env.MORPHLLM_API_KEY) {
  throw new Error('MORPHLLM_API_KEY가 설정되지 않았습니다');
}
```

### 7.2 요청 제한
- API 호출 빈도를 적절히 제어
- 필요한 경우 요청 큐 구현

이 가이드를 따라 MorphLLM API를 성공적으로 사용할 수 있습니다.