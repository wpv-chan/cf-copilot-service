const GithubCopilotChat = GITHUB_COPILOT_CHAT; // 此处替换你绑定KV namespace的名称

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const authorizationHeader = request.headers.get('Authorization') || ''
    const match = authorizationHeader.match(/^Bearer\s+(.*)$/)
    if (!match) {
      throw new Error('Missing or malformed Authorization header')
    }
    const githubToken = match[1]

    const copilotToken = await getCopilotToken(githubToken)

    const headers = await createHeaders(copilotToken);

    const requestData = await request.json()

    const openAIResponse = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: typeof requestData === 'object' ? JSON.stringify(requestData) : '{}',
    })

    const { readable, writable } = new TransformStream();
    streamResponse(openAIResponse, writable);
    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error) {
    return new Response(error.message, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function streamResponse(openAIResponse, writable) {
  const reader = openAIResponse.body.getReader();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  function push() {
    reader.read().then(({ done, value }) => {
      if (done) {
        writer.close();
        return;
      }
      const chunk = decoder.decode(value, { stream: true });
      writer.write(encoder.encode(chunk));
      push();
    }).catch(error => {
      console.error(error);
      writer.close();
    });
  }

  push();
}

async function getCopilotToken(githubToken) {
  let tokenData = await GithubCopilotChat.get("copilotToken", "json");
  
  if (tokenData && tokenData.expires_at > Date.now()) {
    return tokenData.token;
  }

  const getTokenUrl = 'https://api.github.com/copilot_internal/v2/token';
  const response = await fetch(getTokenUrl, {
    headers: {
      'Authorization': `token ${githubToken}`, 
      'User-Agent': 'GitHubCopilotChat/0.8.0',
    }
  });

  if (!response.ok) {
    const errorResponse = await response.text();
    console.error('Failed to get Copilot token from GitHub:', errorResponse);
    throw new Error('Failed to get Copilot token from GitHub:');
  }

  const data = await response.json();
  const expires_at = Date.now() + data.expires_in * 1000; 

  await GithubCopilotChat.put("copilotToken", JSON.stringify({ token: data.token, expires_at }), {
    expirationTtl: data.expires_in 
  });

  return data.token;
}

async function createHeaders(copilotToken) {
  function genHexStr(length) {
    const arr = new Uint8Array(length / 2);
    crypto.getRandomValues(arr);
    return Array.from(arr, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return {
    'Authorization': `Bearer ${copilotToken}`,
    'X-Request-Id': `${genHexStr(8)}-${genHexStr(4)}-${genHexStr(4)}-${genHexStr(4)}-${genHexStr(12)}`,
    'Vscode-Sessionid': `${genHexStr(8)}-${genHexStr(4)}-${genHexStr(4)}-${genHexStr(4)}-${genHexStr(25)}`,
    'Vscode-Machineid': genHexStr(64),
    'Editor-Version': 'vscode/1.83.1',
    'Editor-Plugin-Version': 'copilot-chat/0.8.0',
    'Openai-Organization': 'github-copilot',
    'Openai-Intent': 'conversation-panel',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'User-Agent': 'GitHubCopilotChat/0.8.0',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip,deflate,br',
    'Connection': 'close'
  };
}