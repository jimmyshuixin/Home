/**
 * ===================================================================================
 * Meting API 高可用反向代理 (Cloudflare Workers)
 * ===================================================================================
 *
 * 【核心功能】
 * 此脚本部署于 Cloudflare Workers，作为一个高可用的反向代理，将请求转发至指定的 Meting API 上游服务器。
 *
 * 【设计目标】
 * 1.  **高可用性**: 利用 Cloudflare 的全球分布式网络作为边缘节点，确保服务的稳定性与低延迟。
 * 2.  **CORS 策略**: 动态注入 CORS (Cross-Origin Resource Sharing) 头部，解决前端应用跨域调用的限制。
 * 3.  **兼容性与透明度**: 通过完整转发请求（包括方法、头部、主体），并直接返回上游响应，实现与原始 API 的 100% 兼容。
 *
 * @author Gemini
 * @version 2.2.0 - 专业开发者注释版
 */

// Cloudflare Workers 的标准入口点，监听并处理所有传入的 `fetch` 事件。
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * 异步处理 HTTP 请求的核心逻辑。
 * 函数接收原始请求，将其代理到上游服务器，并返回一个注入了 CORS 策略的响应。
 *
 * @param {Request} request - 客户端发起的原始 Fetch API Request 对象。
 * @returns {Promise<Response>} - 返回一个处理后的 Response 对象。
 */
async function handleRequest(request) {
  // --- 步骤 1: 解析请求 URL ---
  // 从原始请求中实例化 URL 对象，以便于提取查询参数（`search`）。
  const url = new URL(request.url);

  // --- 步骤 2: 定义上游 API 地址 ---
  // 这是代理的目标服务器。
  const targetApi = 'https://api.injahow.cn/meting/';

  // --- 步骤 3: 构建目标 URL ---
  // 将原始请求的查询参数附加到目标 API 地址上，确保请求的意图被完整传递。
  const targetUrl = new URL(targetApi);
  targetUrl.search = url.search;

  // --- 步骤 4: 创建转发请求 ---
  // 构造一个新的 Request 对象，用于向上游服务器发起请求。
  // 必须忠实地复制原始请求的 method, headers 和 body，以确保请求的透明转发。
  // `redirect: 'follow'` 策略使 fetch 能自动处理上游返回的 3xx 重定向。
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  });

  // --- 步骤 5: 向上游发起 fetch 请求 ---
  // 异步执行网络请求，并等待上游服务器的响应。
  const response = await fetch(newRequest);

  // --- 步骤 6: 克隆响应头 ---
  // `response.headers` 是一个只读的 Headers 对象。为注入自定义头部，需创建一个可写的副本。
  const responseHeaders = new Headers(response.headers);

  // --- 步骤 7: 注入 CORS 头部 ---
  // 为响应添加必要的 CORS 策略，允许任何来源的前端应用进行跨域访问。
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

  // --- 步骤 8: 返回最终响应 ---
  // 构建一个新的 Response 对象返回给客户端。
  // 该响应直接流式传输上游的 body，并使用其原始的 status 和 statusText，
  // 但应用了我们修改过的 headers。这确保了代理的高效性和透明度。
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

