const http = require('http');
const https = require('https');

const PORT = 3456;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { apiKey, styleDesc } = JSON.parse(body);
                console.log('收到生成请求，风格描述：', styleDesc);

                const postData = JSON.stringify({
                    model: 'deepseek-chat',   // 如果不行可尝试改为 'deepseek-reasoner'
                    messages: [
                        {
                            role: 'user',
                            content: `你是一个全栈设计师。请为一个文字互动游戏生成完整的HTML代码，要求：
- 风格：${styleDesc}
- 必须包含CSS变量定义，有独特的配色方案
- 必须包含至少两个@keyframes动画
- 内嵌一个完整的文字游戏引擎（至少3个故事节点，支持点击选项推进）
- 响应式设计，按钮至少44px
- 只返回完整HTML代码，不要任何markdown标记，不要解释`
                        }
                    ],
                    temperature: 0.9,
                    max_tokens: 6000
                });

                const options = {
                    hostname: 'api.deepseek.com',
                    path: '/chat/completions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    }
                };

                const apiReq = https.request(options, apiRes => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        console.log('API 原始返回：', data);   // 关键：打印返回内容
                        try {
                            const json = JSON.parse(data);
                            // 如果 API 返回了错误信息（例如 key 无效），打印出来
                            if (json.error) {
                                console.error('API 错误：', json.error);
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: 'API错误: ' + (json.error.message || '未知') }));
                                return;
                            }
                            const content = json.choices?.[0]?.message?.content;
                            if (!content) {
                                console.error('返回内容为空');
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: 'AI未返回有效内容' }));
                                return;
                            }
                            const cleanCode = content.replace(/```html|```/g, '').trim();
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ code: cleanCode }));
                        } catch (e) {
                            console.error('JSON解析失败：', e);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'AI响应解析失败' }));
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('请求AI出错：', e);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '无法连接AI服务' }));
                });

                apiReq.write(postData);
                apiReq.end();

            } catch (e) {
                console.error('请求解析失败：', e);
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效请求' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`✅ 后端已启动：http://localhost:${PORT}`);
});
