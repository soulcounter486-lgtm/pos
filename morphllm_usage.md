# MorphLLM API 사용 가이드

## 1. 사전 준비
- [ ] **API 키 발급**  
  - 제공업체(예: MorphLabs) 웹사이트에 로그인 후 API 키를 생성합니다.  
  - 생성된 키는 안전한 장소에 보관하세요.

- [ ] **라이브러리 설치**    ```bash
  npm install morphllm
  # 또는 pip install morphllm (Python 사용 시)
  ```

- [ ] **환경 변수 설정**  
  - `.env.local` 파일에 API 키를 추가합니다.  
  ```env
  MORPHLLM_API_KEY=your_api_key_here
  ```

## 2. 기본 사용 예시 (Node.js)
```javascriptimport MorphLLM from 'morphllm';

const client = new MorphLLM({
  apiKey: process.env.MORPHLLM_API_KEY,
});

async function generateText(prompt) {
  const response = await client.generate({
    model: 'gpt-3.5-turbo',
    prompt: prompt,
    maxTokens: 150,
  });
  console.log(response.data);
}

generateText('Hello, world!');
```

## 3. Python 예시
```python
import os
from morphllm import MorphLLM

client = MorphLLM(api_key=os.getenv('MORPHLLM_API_KEY'))

def generate_text(prompt):
    response = client.generate(
        model='gpt-3.5-turbo',
        prompt=prompt,
        max_tokens=150,
    )
    print(response.json())

generate_text('Hello, world!')
```

## 4. 옵션 및 파라미터
| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `model` | 사용할 모델 이름 | `'gpt-3.5-turbo'` |
| `prompt` | 입력 텍스트 | - |
| `maxTokens` | 생성될 최대 토큰 수 | `150` |
| `temperature` | 창의성 수준 | `0.7` |
| `topP` | 핵 sampling 파라미터 | `1.0` |

## 5. 오류 처리
- **401 Unauthorized**: API 키가 올바르게 설정되지 않았거나 비활성화되었습니다.  
- **429 Too Many Requests**: 요청 한도 초과. 백오프 후 재시도하세요.  - **네트워크 오류**: 인터넷 연결을 확인하고 재시도하세요.

## 6. 테스트
- [ ] 위 예시 코드를 실행해 정상적으로 응답을 받는지 확인합니다.  
- [ ] 다양한 프롬프트를 시도해 다양한 출력이 생성되는지 테스트합니다.  

---

이 가이드를 참고하여 MorphLLM API를 프로젝트에 통합하고, 발급받은 API 키를 안전하게 사용하세요.