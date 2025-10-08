/**
 * ===================================================================================
 * 终极解决方案：联系表单代理 (通过 Resend 发送) - 带最终诊断日志
 * ===================================================================================
 *
 * 【核心功能】
 * 此 Worker 作为一个安全的后端，接收来自联系表单的 POST 请求，并通过 Resend API
 * 将表单内容作为邮件发送。Resend 是一个现代、简洁且对开发者友好的邮件服务。
 *
 * 【!!! 重要配置 !!!】
 * 前往此 Worker 的 "Settings" -> "Variables" 页面，添加以下 secrets:
 *
 * 1. RESEND_API_KEY:   你在 Resend 网站上生成的 API 密钥 (以 "re_" 开头)。
 * 2. SENDER_EMAIL:    你在 Resend 验证过的发件邮箱 (e.g., contact@xvyin.com)。
 * 3. RECIPIENT_EMAIL: 你的个人收件邮箱 (e.g., luckyshuixin@qq.com)。
 * 4. ALLOWED_ORIGIN:  你的网站域名，用于安全校验 (e.g., https://xvyin.com)。
 */

export default {
    async fetch(request, env) {
        // --- 1. 处理 CORS 预检请求 ---
        if (request.method === "OPTIONS") {
            return handleOptions(request, env);
        }

        // --- 2. 安全性与请求验证 ---
        const origin = request.headers.get("Origin");
        if (origin !== env.ALLOWED_ORIGIN) {
            return jsonResponse({ error: "未经授权的请求来源。" }, { status: 403, env });
        }

        if (request.method !== "POST") {
            return jsonResponse({ error: "只接受 POST 请求。" }, { status: 405, env });
        }

        // 检查必要的环境变量
        const { RESEND_API_KEY, SENDER_EMAIL, RECIPIENT_EMAIL, ALLOWED_ORIGIN } = env;
        if (!RESEND_API_KEY || !SENDER_EMAIL || !RECIPIENT_EMAIL || !ALLOWED_ORIGIN) {
            console.error("一个或多个必要的环境变量未配置。");
            return jsonResponse({ error: "服务器邮件功能未正确配置。" }, { status: 500, env });
        }

        try {
            // --- 3. 解析和验证表单数据 ---
            const formData = await request.json();
            const { name, contact_method, contact_value, message } = formData;

            if (!name || !contact_value || !message) {
                return jsonResponse({ error: "表单内容不完整，所有字段均为必填项。" }, { status: 400, env });
            }

            // --- 4. 构造邮件内容 ---
            const subject = `来自个人网站的新消息 - ${name}`;
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2 style="color: #333;">网站联系表单新消息</h2>
                    <p><strong>来自:</strong> ${escapeHtml(name)}</p>
                    <p><strong>联系方式 (${escapeHtml(contact_method)}):</strong> ${escapeHtml(contact_value)}</p>
                    <p><strong>消息内容:</strong></p>
                    <blockquote style="border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0; color: #555;">
                        ${escapeHtml(message).replace(/\n/g, '<br>')}
                    </blockquote>
                </div>`;
            
            // --- 5. 构造 Resend API 请求体 ---
            const emailPayload = {
                from: `个人网站联系表单 <${SENDER_EMAIL}>`,
                to: [RECIPIENT_EMAIL],
                subject: subject,
                html: htmlContent,
                reply_to: contact_method === 'email' ? contact_value : SENDER_EMAIL,
            };

            // --- 6. 发送邮件 ---
            // !!! 最终诊断日志 !!!
            console.log(`[诊断信息] 准备使用发件人邮箱: "${SENDER_EMAIL}" 向 Resend API 发送请求。`);

            const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify(emailPayload),
            });

            if (!emailResponse.ok) {
                 const errorData = await emailResponse.json();
                 console.error(`Resend API 错误: ${emailResponse.status}`, JSON.stringify(errorData, null, 2));
                 throw new Error(errorData.message || `邮件发送失败，状态码: ${emailResponse.status}`);
            }

            return jsonResponse({ success: true }, { env });

        } catch (error) {
            console.error("Worker 内部错误:", error.message);
            return jsonResponse({ error: `消息发送失败: ${error.message}` }, { status: 500, env });
        }
    },
};

// --- 辅助函数 ---

function jsonResponse(data, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (options.env && options.env.ALLOWED_ORIGIN) {
        headers.set('Access-Control-Allow-Origin', options.env.ALLOWED_ORIGIN);
    }
    return new Response(JSON.stringify(data), { ...options, headers });
}

function handleOptions(request, env) {
    const headers = {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    return new Response(null, { headers });
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

