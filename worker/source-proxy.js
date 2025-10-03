/**
 * ===================================================================================
 * 通用缓存与反向代理 (Cloudflare Workers)
 * ===================================================================================
 *
 * 【核心功能】
 * 此脚本将 Cloudflare Worker 部署为一个通用的缓存反向代理。它会抓取任意指定 URL 的资源，
 * 利用 Cloudflare 强大的边缘缓存网络进行缓存，并在后续请求中直接从缓存提供服务。
 *
 * 【设计目标】
 * 1.  **性能加速**: 通过 Cloudflare 的全球分布式缓存，极大降低后续访问的延迟，提升用户体验。
 * 2.  **源站保护与带宽节省**: 大幅减少对源服务器的直接请求，保护源站免受高流量冲击，并节省其带宽成本。
 * 3.  **跨域支持 (CORS)**: 自动为所有代理的响应注入开放的 CORS 头部，解决前端资源跨域加载的问题。
 * 4.  **高可配置性**: 缓存行为（如 TTL）可以通过 Cloudflare 特有的 `cf` 对象进行精细化控制。
 *
 * 【使用方法】
 * 通过 `target` 查询参数来指定需要代理和缓存的目标资源 URL。
 * 例如: https://your-worker.workers.dev/?target=https://example.com/image.jpg
 */

export default {
    /**
     * Worker 的主入口 fetch 处理函数。
     * @param {Request} request - 客户端传入的请求对象。
     * @param {object} env - 环境变量对象 (此脚本中未使用)。
     * @param {ExecutionContext} ctx - 执行上下文，用于延长 Worker 生命周期以完成异步任务。
     * @returns {Promise<Response>} 返回一个从缓存或源站获取的响应。
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 从查询参数中解析出目标资源 URL。
        const targetUrl = url.searchParams.get('target');

        // --- 步骤 1: 请求校验 ---
        if (!targetUrl) {
            return new Response('请求错误: 请提供 "target" 查询参数。', { status: 400 });
        }

        try {
            // 验证 targetUrl 是否为一个合法的 URL 结构，防止格式错误或恶意输入。
            new URL(targetUrl);
        } catch (e) {
            return new Response('请求错误: 提供了无效的 "target" URL。', { status: 400 });
        }

        // --- 步骤 2: 缓存查找 ---
        // 获取 Cloudflare 的默认缓存实例。
        const cache = caches.default;
        // 使用目标 URL 本身作为缓存键 (Cache Key)，尝试从缓存中匹配响应。
        let response = await cache.match(targetUrl);

        if (!response) {
            // --- 步骤 3: 缓存未命中 (Cache Miss) ---
            console.log(`缓存未命中: ${targetUrl}`);

            // 构造一个新的请求发往源站。
            // 使用 Cloudflare 特有的 `cf` 对象来强制控制缓存行为。
            const newRequest = new Request(targetUrl, {
                headers: request.headers,
                cf: {
                    cacheTtl: 86400, // 缓存有效期 (TTL): 86400 秒 (1 天)，可按需调整。
                    cacheEverything: true, // 强制缓存所有内容，即使源站响应头建议不缓存。
                },
            });

            response = await fetch(newRequest);

            // 必须克隆响应以使其头部可修改。
            response = new Response(response.body, response);

            // 注入 CORS 头部，以允许任何来源的前端应用进行跨域访问。
            response.headers.set('Access-Control-Allow-Origin', '*');
            response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

            // 添加一个自定义响应头，用于调试，标示此次响应来自源站。
            response.headers.set('X-CF-Proxy-Status', 'MISS');

            // 使用 ctx.waitUntil 确保缓存写入操作在响应返回给客户端后异步完成，
            // 这样不会阻塞对用户的响应。必须克隆 response 对象，因为其 body 只能被读取一次。
            ctx.waitUntil(cache.put(targetUrl, response.clone()));
        } else {
            // --- 步骤 4: 缓存命中 (Cache Hit) ---
            console.log(`缓存命中: ${targetUrl}`);
            
            // 同样需要克隆响应以修改头部。
            response = new Response(response.body, response);
            // 添加自定义响应头，标示此次响应来自 Cloudflare 缓存。
            response.headers.set('X-CF-Proxy-Status', 'HIT');
        }

        return response;
    },
};
