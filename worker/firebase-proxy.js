/**
 * ===================================================================================
 * Firestore 安全 API 代理 (Cloudflare Workers)
 * ===================================================================================
 *
 * 【核心功能】
 * 此脚本作为一个安全的后端代理（Backend-for-Frontend），处理对 Google Firestore 的 API 请求。
 * 它负责认证、路由和数据格式化，使前端应用能安全地与 Firestore 交互，而无需暴露任何服务账户凭证。
 *
 * 【设计目标】
 * 1.  **安全**: 核心目标是避免在客户端暴露敏感的服务账户密钥。所有与 Firestore 的交互都通过此 Worker 进行，
 * 利用 Cloudflare 的环境变量安全地存储凭证。
 * 2.  **认证**: 实现 Google OAuth 2.0 服务账户流程，自动生成并缓存访问令牌 (Access Token)。
 * 3.  **路由**: 基于请求路径 (path) 将 API 调用分发到不同的处理程序，支持多个集合（如留言板和博客评论）。
 * 4.  **数据转换**: 将 Firestore 返回的复杂数据结构格式化为简洁、易于前端使用的 JSON 对象。
 *
 * 【!!! 重要配置 !!!】
 * 前往 Cloudflare Worker 的 "Settings" -> "Variables" 页面，添加以下 secrets:
 * 1. FIREBASE_PROJECT_ID:  来自你的服务账户 JSON 文件中的 `project_id`。
 * 2. FIREBASE_CLIENT_EMAIL: 来自你的服务账户 JSON 文件中的 `client_email`。
 * 3. FIREBASE_PRIVATE_KEY:  来自你的服务账户 JSON 文件中的 `private_key`，请确保完整复制。
 */

// Google OAuth 2.0 和 Firestore REST API 的端点常量。
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_URL_BASE = "https://firestore.googleapis.com/v1/projects/";

// 全局变量，用于在 Worker 实例的生命周期内缓存 OAuth Access Token，以减少重复认证。
let accessToken = null;
let tokenExpiry = 0; // Token 过期时间戳 (ms)

export default {
    /**
     * Worker 的主入口 fetch 处理函数，充当请求路由器。
     * @param {Request} request - 客户端请求对象。
     * @param {object} env - 包含环境变量和 secrets 的对象。
     * @param {ExecutionContext} ctx - 执行上下文。
     * @returns {Promise<Response>}
     */
    async fetch(request, env, ctx) {
        // 优先处理 CORS 预检请求 (preflight request)。
        if (request.method === "OPTIONS") {
            return handleOptions();
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // 在处理任何实际请求前，先获取有效的访问令牌。
            const token = await getAccessToken(env);

            // --- API 路由分发 ---

            // 路由: 留言板 (Guestbook / Danmaku) - /messages
            if (path === "/messages") {
                if (request.method === "GET") {
                    return await handleGetMessages(env, token);
                }
                if (request.method === "POST") {
                    return await handlePostMessage(request, env, token);
                }
            }

            // 路由: 博客评论 - /comments/:postId
            const commentMatch = path.match(/^\/comments\/([a-zA-Z0-9_-]+)$/);
            if (commentMatch) {
                const postId = commentMatch[1]; // 从路径中提取 postId
                if (request.method === "GET") {
                    return await handleGetComments(env, token, postId);
                }
                if (request.method === "POST") {
                    return await handlePostComment(request, env, token, postId);
                }
            }

            // 如果没有匹配的路由，返回 404 Not Found。
            return new Response("Not Found", {
                status: 404,
                headers: createCorsHeaders()
            });

        } catch (error) {
            // 全局错误捕获，防止敏感错误信息泄露。
            console.error("Worker Error:", error.stack);
            return new Response(JSON.stringify({ error: "Worker internal error: " + error.message }), {
                status: 500,
                headers: createCorsHeaders(),
            });
        }
    },
};

// --- 留言板 (Guestbook) 路由处理程序 ---

/** 获取留言列表 */
async function getMessages(env, token) {
    const firebaseUrl = `${FIRESTORE_URL_BASE}${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/guestbook?orderBy=timestamp%20desc&pageSize=50`;
    const response = await fetch(firebaseUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Firebase GET failed: ${await response.text()}`);
    const data = await response.json();
    return (data.documents || []).map(doc => formatFirestoreDoc(doc));
}

/** 处理 GET /messages 请求 */
async function handleGetMessages(env, token) {
    const messages = await getMessages(env, token);
    return new Response(JSON.stringify(messages), { headers: createCorsHeaders() });
}

/** 处理 POST /messages 请求 */
async function handlePostMessage(request, env, token) {
    const body = await request.json();
    if (!body.name || !body.message) {
        return new Response(JSON.stringify({ error: 'Name and message are required.' }), { status: 400, headers: createCorsHeaders() });
    }
    const firebaseUrl = `${FIRESTORE_URL_BASE}${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/guestbook`;
    await postToFirestore(firebaseUrl, token, body.name, body.message);
    // 成功提交后，返回最新的留言列表
    const latestMessages = await getMessages(env, token);
    return new Response(JSON.stringify(latestMessages), { status: 201, headers: createCorsHeaders() });
}


// --- 博客评论路由处理程序 ---

/** 根据 postId 获取评论列表 */
async function getComments(env, token, postId) {
    const firebaseUrl = `${FIRESTORE_URL_BASE}${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/blog_comments/${postId}/comments?orderBy=timestamp%20asc`;
    const response = await fetch(firebaseUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) {
        // 对于尚无评论的文章，Firestore 会返回 404，这属于正常情况，应视为空数组。
        if (response.status === 404) {
            return [];
        }
        throw new Error(`Firebase GET (comments) failed: ${await response.text()}`);
    }
    const data = await response.json();
    return (data.documents || []).map(doc => formatFirestoreDoc(doc));
}

/** 处理 GET /comments/:postId 请求 */
async function handleGetComments(env, token, postId) {
    const comments = await getComments(env, token, postId);
    return new Response(JSON.stringify(comments), { headers: createCorsHeaders() });
}

/** 处理 POST /comments/:postId 请求 */
async function handlePostComment(request, env, token, postId) {
    const body = await request.json();
    if (!body.name || !body.message) {
        return new Response(JSON.stringify({ error: 'Name and message are required.' }), { status: 400, headers: createCorsHeaders() });
    }
    // 评论是对应文章文档下的一个子集合 (subcollection)。
    const firebaseUrl = `${FIRESTORE_URL_BASE}${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/blog_comments/${postId}/comments`;
    await postToFirestore(firebaseUrl, token, body.name, body.message);
    // 成功提交后，返回最新的评论列表
    const latestComments = await getComments(env, token, postId);
    return new Response(JSON.stringify(latestComments), { status: 201, headers: createCorsHeaders() });
}


// --- 通用 Firestore 及认证辅助函数 ---

/**
 * 将 Firestore REST API 返回的文档对象格式化为简洁的前端可用对象。
 * @param {object} doc - Firestore 文档对象。
 * @returns {object} 格式化后的对象。
 */
function formatFirestoreDoc(doc) {
    const fields = doc.fields || {};
    return {
        id: doc.name.split('/').pop(),
        name: fields.name ? fields.name.stringValue : "匿名",
        message: fields.message ? fields.message.stringValue : "",
        timestamp: fields.timestamp ? fields.timestamp.timestampValue : new Date().toISOString(),
    };
}

/**
 * 向指定的 Firestore 集合 URL POST 一个新文档。
 * @param {string} url - Firestore 集合的完整 URL。
 * @param {string} token - OAuth Access Token。
 * @param {string} name - 用户名。
 * @param {string} message - 消息内容。
 */
async function postToFirestore(url, token, name, message) {
    const createDocumentBody = {
        fields: {
            name: { stringValue: name },
            message: { stringValue: message },
            timestamp: { timestampValue: new Date().toISOString() }
        }
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(createDocumentBody)
    });
    if (!response.ok) {
        throw new Error(`Firebase POST failed: ${await response.text()}`);
    }
}

/**
 * 获取（或刷新）用于访问 Google Cloud API 的 OAuth Access Token。
 * 实现了内存缓存策略以提高性能。
 * @param {object} env - Worker 的环境变量。
 * @returns {Promise<string>} Access Token。
 */
async function getAccessToken(env) {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
    if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error("Service account credentials are not configured in Worker secrets.");
    }

    const scope = "https://www.googleapis.com/auth/datastore";
    const iat = Math.floor(Date.now() / 1000); // Issued at time
    const exp = iat + 3500; // Expiration time (max 1 hour)

    const claims = { iss: FIREBASE_CLIENT_EMAIL, sub: FIREBASE_CLIENT_EMAIL, aud: TOKEN_URL, iat, exp, scope };
    const jwt = await createJwt(claims, FIREBASE_PRIVATE_KEY);

    const tokenResponse = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!tokenResponse.ok) {
        throw new Error(`Failed to fetch access token: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
    // 设置一个比实际有效期稍短的缓存时间，以避免边缘情况下的 token 失效。
    tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;

    return accessToken;
}

/**
 * 根据声明和私钥创建一个签名的 JWT。
 * @param {object} claims - JWT 的 payload。
 * @param {string} privateKeyPem - PEM 格式的 PKCS#8 私钥。
 * @returns {Promise<string>} 签名的 JWT 字符串。
 */
async function createJwt(claims, privateKeyPem) {
    const header = { alg: "RS256", typ: "JWT" };
    const encodedHeader = btoa_url(JSON.stringify(header));
    const encodedClaims = btoa_url(JSON.stringify(claims));
    const signingInput = `${encodedHeader}.${encodedClaims}`;

    const key = await importKey(privateKeyPem);
    const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },
        key,
        new TextEncoder().encode(signingInput)
    );

    const encodedSignature = btoa_url(String.fromCharCode(...new Uint8Array(signature)));
    return `${signingInput}.${encodedSignature}`;
}

/**
 * 将 PEM 格式的私钥导入 Web Crypto API 以便用于签名。
 * @param {string} pem - PEM 格式的 PKCS#8 私钥字符串。
 * @returns {Promise<CryptoKey>} 可用于签名的 CryptoKey 对象。
 */
async function importKey(pem) {
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");

    try {
        const binaryDer = atob(pemContents);
        const binaryDerArr = new Uint8Array(binaryDer.length).map((_, i) => binaryDer.charCodeAt(i));
        return crypto.subtle.importKey(
            "pkcs8",
            binaryDerArr.buffer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            true,
            ["sign"]
        );
    } catch (e) {
        console.error("Failed to decode or import private key.", e);
        throw new Error("The FIREBASE_PRIVATE_KEY secret is malformed or invalid.");
    }
}

/**
 * 将字符串进行 Base64URL 编码。
 * @param {string} str - 输入字符串。
 * @returns {string} Base64URL 编码后的字符串。
 */
function btoa_url(str) {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 创建一个包含标准 CORS 策略的 Headers 对象。
 * @returns {object} 包含 CORS 头部的对象。
 */
function createCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

/**
 * 处理 CORS 预检 (OPTIONS) 请求。
 * @returns {Response}
 */
function handleOptions() {
    return new Response(null, { headers: createCorsHeaders() });
}
