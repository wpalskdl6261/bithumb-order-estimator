export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const send = (payload) => res.status(200).json(payload);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return send({
      isPass: false,
      resultType: 'fail',
      feedback: '[질문 연금술사의 대답]\n앗, 지금은 POST 방식으로만 이야기할 수 있어.\n\n[질문 연금술사의 조언]\n선생님이 요청 방식을 다시 확인해주면 좋겠어!',
      teacherNote: '잘못된 요청 방식',
      nextTip: 'POST 방식으로 다시 시도하세요.',
      scores: { relevance: 0, clarity: 0, stageFit: 0, thinking: 0 },
      total: 0
    });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { step, scenarioTitle, scenarioDesc, q } = body;
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      return send({
        isPass: false,
        resultType: 'fail',
        feedback: '[질문 연금술사의 대답]\n앗! 지금은 마법의 열쇠를 찾지 못했어요.\n\n[질문 연금술사의 조언]\n선생님이 API 키를 확인한 뒤 다시 시도해보면 좋겠어요.',
        teacherNote: 'GEMINI_API_KEY 누락',
        nextTip: '환경변수를 확인해주세요.',
        scores: { relevance: 0, clarity: 0, stageFit: 0, thinking: 0 },
        total: 0
      });
    }

    if (!step || !scenarioTitle || !q) {
      return send({
        isPass: false,
        resultType: 'fail',
        feedback: '[질문 연금술사의 대답]\n질문을 살펴보려면 필요한 정보가 조금 부족해.\n\n[질문 연금술사의 조언]\n질문을 다시 한 번 또렷하게 적어볼까?',
        teacherNote: 'step/scenarioTitle/q 누락',
        nextTip: '필수 입력값을 확인해주세요.',
        scores: { relevance: 0, clarity: 0, stageFit: 0, thinking: 0 },
        total: 0
      });
    }

    const stepGuide = {
      1: '1단계 사실 질문: 눈에 보이는 정보, 인물, 장소, 사건 자체를 묻는 질문',
      2: '2단계 궁금 질문: 이유, 원인, 감정, 숨은 뜻을 묻는 질문',
      3: '3단계 새롬 질문: 상상, 가정, 확장, 새로운 관점을 더한 질문'
    };

    function normalizeMatchToken(word = '') {
      let value = String(word || '').trim().replace(/[^\w가-힣]/g, '');
      const suffixes = [
        '들에게는', '에게서는', '으로서는', '이라고는', '이라면', '라면',
        '이라고', '에게서', '으로서', '으로써', '에게는', '에서는',
        '한테는', '에게', '한테', '에서', '으로', '처럼', '부터', '까지',
        '이었다', '였다', '이다', '하며', '하고', '하는', '하던',
        '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만', '로', '라', '야'
      ];

      for (const suffix of suffixes) {
        if (value.length > suffix.length + 1 && value.endsWith(suffix)) {
          value = value.slice(0, -suffix.length);
          break;
        }
      }
      return value;
    }

    function extractMeaningfulTokens(text = '') {
      const stopwords = new Set([
        '그리고','하지만','그러나','그래서','정말','아주','어느','어떤','무엇','무슨',
        '그','이','저','것','수','때','곳','채','더','속','뒤','전','후','중',
        '하는','하던','하게','된','된다','있는','있던','에게','에서','으로','로',
        '의','를','을','이','가','은','는','와','과','도','한','입','문',
        '말했습니다','말았습니다','시작했습니다','있습니다','했습니다','합니다','되었습니다'
      ].map(normalizeMatchToken));

      const words = String(text || '')
        .replace(/[^\w가-힣\s]/g, ' ')
        .split(/\s+/)
        .map(normalizeMatchToken)
        .filter(Boolean);

      return [...new Set(words.filter(word => word.length >= 2 && !stopwords.has(word)))];
    }

    function getScenarioKeywords(title = '', desc = '') {
      return extractMeaningfulTokens(`${title} ${desc}`);
    }

    function inferQuestionStage(question = '') {
      const text = question.trim();
      if (/만약|라면|된다면|없다면|있다면|어떨까|어떻게 될까|바뀐다면/.test(text)) return 3;
      if (/(장면|행동|말|표정|마음|의도|이유).{0,6}뜻|뜻하는|의미|숨은 뜻/.test(text)) return 2;
      if (/(무슨|어떤)?\s*뜻(이|은)?\s*(뭐|무엇|뭔|뭐야|뭘까|뭐지)/.test(text)) return 1;
      if (/왜|어째서|이유|원인|마음|기분|느낌|생각|까닭/.test(text)) return 2;
      return 1;
    }

    // [로컬 사전 채점 로직]
    function calcLocalEval(step, scenarioTitle, scenarioDesc, question) {
      const qText = String(question || '').trim();
      const normalized = qText.replace(/\s+/g, ' ');
      const inferredStage = inferQuestionStage(normalized);
      const keywords = getScenarioKeywords(scenarioTitle, scenarioDesc);
      const questionKeywords = extractMeaningfulTokens(normalized);
      const normalizedQuestionText = questionKeywords.join(' ');

      // 1. 장난감지 필터
      const trolling = /어쩌라고|어쩔|알빠노|그래서 뭐|뭐 어쩌라고|장난|안물|안궁|어쩔티비|저쩔티비|알바노|누물보|응애/.test(normalized.replace(/\s+/g, ''));

      const badShort =
        /^(ㅇ+|ㅎ+|ㅋ+|ㅜ+|ㅠ+|ㄴ+|ㄱ+|ㄷ+|ㅁ+|ㅂ+|ㅅ+|ㅈ+|ㅊ+|ㅍ+|ㅌ+|123+|asdf+|zxc+|\?+|!+)$/.test(normalized) ||
        normalized.length <= 1;

      const notQuestion = !/[?？]|까|나요|인가요|일까요|할까요|인가|일까|뭐야|무엇이야|누구야|어디야|무슨|어떤|언제|몇/.test(normalized);
      const veryShort = normalized.length <= 4;

      const matchedKeywords = keywords.filter(keyword =>
        normalizedQuestionText.includes(keyword) ||
        questionKeywords.some(token => token.includes(keyword) || keyword.includes(token))
      );
      
      // 2. 이름 제거 (동문서답 방지)
      const genericRelevant = /주인공|이야기|장면|사람|친구|인물|사건/.test(normalizedQuestionText);

      let relevance = 0;
      if (trolling) relevance = 0; 
      else if (matchedKeywords.length >= 2) relevance = 2;
      else if (matchedKeywords.length === 1 || genericRelevant) relevance = 1;

      let clarity = 0;
      if (normalized.length >= 12 && !badShort && !notQuestion && !trolling) clarity = 2;
      else if (normalized.length >= 5 && !badShort && !trolling) clarity = 1;

      let stageFit = 0;
      if (inferredStage === Number(step)) stageFit = 2;
      else if (
        (Number(step) === 1 && inferredStage === 2) ||
        (Number(step) === 2 && (inferredStage === 1 || inferredStage === 3)) ||
        (Number(step) === 3 && inferredStage === 2)
      ) stageFit = 1;
      else stageFit = 0;

      let thinking = 0;
      if (inferredStage === 3) thinking = 2;
      else if (inferredStage === 2) thinking = 1;
      else thinking = 0;

      let resultType = 'fail';
      let failureType = '';

      if (trolling) {
        resultType = 'fail'; failureType = 'trolling';
      } else if (badShort || veryShort) {
        resultType = 'fail'; failureType = 'too_short';
      } else if (notQuestion) {
        resultType = 'fail'; failureType = 'not_a_question';
      } else if (relevance === 0) {
        resultType = 'fail'; failureType = 'irrelevant';
      } else if (stageFit < 2 && relevance >= 1) {
        resultType = 'redirect'; failureType = 'stage_mismatch';
      } else if (stageFit === 2 && relevance >= 1) {
        resultType = 'pass'; failureType = '';
      }

      if (resultType === 'fail') {
        relevance = 0; clarity = 0; stageFit = 0; thinking = 0;
      }

      const total = relevance + clarity + stageFit + thinking;

      return {
        isPass: resultType === 'pass',
        resultType, inferredStage, failureType,
        scores: { relevance, clarity, stageFit, thinking }, total
      };
    }

  const localEval = calcLocalEval(step, scenarioTitle, scenarioDesc, q);

    // [🚨 빠른 차단 (Short-circuit): 명백한 장난, 너무 짧은 글은 AI에게 안 보내고 입구에서 즉시 컷!]
    if (localEval.resultType === 'fail' && ['trolling', 'too_short', 'not_a_question'].includes(localEval.failureType)) {
      let fastFeedback = '';
      if (localEval.failureType === 'trolling') {
        fastFeedback = '[질문 연금술사의 대답]\n음, 이건 이 이야기와 어울리는 질문이 아닌 것 같아.\n\n[질문 연금술사의 조언]\n장난은 잠시 멈추고, 진짜 궁금한 것을 완전한 문장으로 적어줄래?';
      } else if (localEval.failureType === 'too_short') {
        fastFeedback = '[질문 연금술사의 대답]\n음, 이건 질문이라기엔 너무 짧은 것 같아.\n\n[질문 연금술사의 조언]\n네가 궁금한 걸 완전한 문장으로 조금만 더 길게 써줄래?';
      } else {
        fastFeedback = '[질문 연금술사의 대답]\n네 생각은 잘 보았지만, 아직 묻는 말(질문)처럼 들리지 않아.\n\n[질문 연금술사의 조언]\n끝을 "~까?", "~요?"처럼 다듬어서 진짜 질문으로 만들어보자!';
      }

      return send({
        isPass: false,
        resultType: 'fail',
        scores: localEval.scores,
        total: localEval.total,
        feedback: fastFeedback,
        teacherNote: `로컬 사전 차단: ${localEval.failureType}`,
        nextTip: '완전한 문장으로 다시 써보세요.'
      });
    }
    

    const prompt = `
너는 3, 4학년 초등학생들의 상상력과 질문하는 힘을 길러주는 다정하고 지혜로운 '질문 연금술사'야.
학생이 보낸 질문을 읽고, 먼저 그 질문에 상상력을 자극하는 스토리텔링 방식으로 풍성하게 답해주고, 그다음 질문의 품질을 아주 깐깐하고 엄격하게 평가해.

---

[지금 상황]
이야기 제목: ${scenarioTitle}
장면 설명: ${scenarioDesc || ''}
학생 질문: "${q}"
현재 단계: ${step}단계 — ${stepGuide[step] || ''}
(제시된 장면 설명 외에도 네가 알고 있는 동화나 위인전의 풍부한 배경지식을 적극적으로 활용해서 대답해!)

---

[1단계: 장난 및 쓰레기 걸러내기 (매우 중요!!!)]
아래 5가지 중 하나라도 해당하면 무조건 fail 처리하고 모든 점수(relevance, clarity, stageFit, thinking)를 0점으로 줘! 억지로 의미를 부여하지 마!
1. 자음/모음 나열: ㅇㅇ, ㅋㅋ, ㅎㅎ 등
2. 4글자 이하의 단답: 왜?, 몰라, 누구야 등
3. 무의미한 타이핑: asdf, 123 등
4. 장난치거나 예의 없는 말: 그래서 어쩌라고, 어쩔티비, 알빠노, 안물안궁, 장난 등
5. 다른 이야기 주인공 언급: 인어공주 이야기에 백설공주를 묻는 등 이야기와 전혀 상관없는 명사 등장

fail 처리 시 피드백 예시 (상황에 맞게 다정하지만 단호하게):
"[질문 연금술사의 대답]\\n음, 이건 이 이야기와 어울리는 질문이 아닌 것 같아.\\n\\n[질문 연금술사의 조언]\\n장난은 잠시 멈추고, 이야기 속 장면을 다시 읽어본 뒤 진짜 궁금한 것을 완전한 문장으로 적어줄래?"

---

[2단계: 질문 평가]

■ 점수 기준 (매우 엄격하게 판단!)
- relevance (0~2): 질문이 지금 이야기/장면과 직접적인 관련이 있는지
  0 = 전혀 다른 이야기의 인물/사건 언급, 장난, 아예 관련 없음 -> 무조건 fail
  1 = 관련은 있으나 핵심을 비껴감
  2 = 이야기와 딱 맞음
- clarity (0~2): 질문이 완전한 문장이고 구체적인지
  0 = 문장 형태도 아님, 1 = 뭘 묻는지 대충 알겠음, 2 = 명확하고 구체적
- stageFit (0~2): 질문 형식이 현재 ${step}단계 유형과 맞는지
  0 = 다른 단계 형식, 1 = 애매함, 2 = 딱 맞음
- thinking (0~2): 단순 확인을 넘어 생각을 확장하게 만드는지

■ 판정 기준 (철저히 지킬 것)
- pass: stageFit=2 이고 relevance>=1 이고 clarity>=1
- fail: relevance=0 (다른 이야기, 장난 등) 또는 stageFit<2 또는 질문 형태가 아님. 
※ 중요: relevance가 0이면 문장 형식(stageFit)이 아무리 완벽해도 절대 통과시키지 마! 가차 없이 fail 처리할 것.

---

[피드백 작성 방법 (풍성하고 자유롭게!)]

feedback은 두 섹션으로 구성해. 기계적인 채점 평가 문투("이 질문은 ~하게 해 줘")는 피하고, 배경지식을 활용해 3, 4학년 눈높이에 맞춰 대화를 나누듯 다정하게 작성해.

[질문 연금술사의 대답]
→ 학생의 질문 내용에 대해 실제 이야기의 배경지식을 살려 대답해 줘. (3~4문장)
→ 장난이나 관련 없는 질문(relevance=0)이라면, 단호하지만 다정하게 이야기로 돌아오도록 안내해 줘.

[질문 연금술사의 조언]
→ 학생의 질문이 왜 좋은 질문인지, 혹은 어떻게 다듬어야 할지 학생이 쓴 단어를 구체적으로 언급하며 칭찬하거나 방향을 잡아줘. (2~3문장)

---

[출력 형식] 순수 JSON만. 마크다운 없이.
{
  "isPass": true/false,
  "resultType": "pass" | "redirect" | "fail",
  "scores": { "relevance": 0, "clarity": 0, "stageFit": 0, "thinking": 0 },
  "total": 0,
  "feedback": "[질문 연금술사의 대답]\\n...\\n\\n[질문 연금술사의 조언]\\n...",
  "teacherNote": "교사 입장에서 이 질문의 특징 한 줄 메모",
  "nextTip": "다음 단계 질문 방향 힌트"
}
`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let text = '';
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4
          }
        })
      });

      let data = {};
      try { data = await response.json(); } catch { data = {}; }

      if (response.ok) {
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch { text = ''; }

    // [Fallback 작동 로직 - API 통신이 끊겼을 때]
    if (!text) {
      let fallbackFeedback = '';
      if (localEval.isPass) {
         fallbackFeedback = '[질문 연금술사의 대답]\n마법 통신망이 잠깐 흐려졌지만, 네가 아주 훌륭한 질문을 던졌다는 건 느낄 수 있어!\n\n[질문 연금술사의 조언]\n정말 훌륭해! 얼른 다음 단계로 넘어가서 멋진 탐구를 계속해보자!';
      } else {
         fallbackFeedback = '[질문 연금술사의 대답]\n앗, 통신 마법이 살짝 끊겨서 네 질문을 잘 못 읽었어.\n\n[질문 연금술사의 조언]\n네트워크 상태를 확인하고 버튼을 다시 한번 눌러줄래?';
      }

      return send({
        isPass: localEval.isPass,
        resultType: localEval.resultType,
        scores: localEval.scores,
        total: localEval.total,
        feedback: fallbackFeedback,
        teacherNote: `AI 통신 지연으로 로컬 자체 판단 작동.`,
        nextTip: '다시 시도해보세요.'
      });
    }

    // [정상 작동 로직]
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      let resultType = ['pass', 'redirect', 'fail'].includes(parsed.resultType)
        ? parsed.resultType : localEval.resultType;

      const scores = {
        relevance: Number(parsed?.scores?.relevance ?? localEval.scores.relevance),
        clarity: Number(parsed?.scores?.clarity ?? localEval.scores.clarity),
        stageFit: Number(parsed?.scores?.stageFit ?? localEval.scores.stageFit),
        thinking: Number(parsed?.scores?.thinking ?? localEval.scores.thinking)
      };

      // 🚨 최종 안전장치: 관련성이 0이거나 장난으로 판별되면 무조건 fail
      if (scores.relevance === 0 || localEval.failureType === 'trolling') {
        resultType = 'fail';
        scores.relevance = 0; scores.stageFit = 0; scores.clarity = 0; scores.thinking = 0;
      }

      let total = scores.relevance + scores.clarity + scores.stageFit + scores.thinking;
      let feedback = String(parsed.feedback || '').trim();
      
      return send({
        isPass: resultType === 'pass',
        resultType,
        scores,
        total,
        feedback,
        teacherNote: String(parsed.teacherNote || '').trim(),
        nextTip: String(parsed.nextTip || '').trim()
      });
    } catch {
      return send({
        isPass: localEval.isPass,
        resultType: localEval.resultType,
        scores: localEval.scores,
        total: localEval.total,
        feedback: '[질문 연금술사의 대답]\n연금술사가 네 마법 주문을 해독하지 못했어.\n\n[질문 연금술사의 조언]\n조금 더 정성스럽게 적어서 다시 물어볼까?',
        teacherNote: `AI JSON 파싱 실패.`,
        nextTip: '다시 시도해보세요.'
      });
    }
  } catch (err) {
    return send({
      isPass: false,
      resultType: 'fail',
      feedback: '[질문 연금술사의 대답]\n앗, 질문을 읽는 중에 잠깐 헷갈렸어.\n\n[질문 연금술사의 조언]\n질문을 완전한 문장으로 또렷하게 다시 적어주면 내가 바로 도와줄게!',
      teacherNote: err?.message || 'unknown error',
      nextTip: '질문을 한 문장으로 또렷하게 적어보세요.',
      scores: { relevance: 0, clarity: 0, stageFit: 0, thinking: 0 },
      total: 0
    });
  }
}
