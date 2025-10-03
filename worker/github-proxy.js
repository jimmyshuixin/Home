/**
 * ===================================================================================
 * 多功能 GitHub API 代理 (Cloudflare Workers)
 * ===================================================================================
 *
 * 【核心功能】
 * 此脚本将 Cloudflare Worker 部署为一个多端点的 GitHub API 代理。它安全地处理对 GitHub
 * 的 GraphQL 和 REST API 的请求，并提供数据聚合与格式化功能。
 *
 * 【设计目标】
 * 1.  **安全认证**: 通过在 Worker 的 secrets 中存储 GitHub Personal Access Token (PAT)，
 * 避免了在客户端暴露敏感密钥的风险。
 * 2.  **多端点路由**: 支持通过查询参数 (`endpoint`) 调用不同的功能，如获取用户统计、置顶仓库，
 * 或代理通用的 REST API 请求。
 * 3.  **API 聚合**: 使用 GraphQL API 一次性获取多种关联数据（如用户统计），减少客户端请求次数。
 * 4.  **数据转换**: 将从 GitHub API 获取的复杂数据结构，格式化为前端易于使用的简洁 JSON 格式。
 * 5.  **缓存策略**: 为不同的数据端点设置了合理的缓存时间（通过 `Cache-Control` 头部），
 * 降低 API 调用频率，提升响应速度。
 * 6.  **CORS 支持**: 自动为所有响应添加 CORS 头部，允许前端应用进行跨域调用。
 *
 * 【!!! 重要配置 !!!】
 * 前往 Cloudflare Worker 的 "Settings" -> "Variables" 页面，添加一个名为 `GITHUB_TOKEN`
 * 的 secret，其值为你的 GitHub Personal Access Token。
 */


addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

/**
 * Worker 的主入口，负责处理所有传入的 HTTP 请求。
 * @param {Request} request 客户端发起的请求对象。
 */
async function handleRequest(request) {
    // 验证 GITHUB_TOKEN 是否已在 Worker 的 secrets 中正确配置。
    if (typeof GITHUB_TOKEN === 'undefined' || !GITHUB_TOKEN) {
        return new Response('错误: GITHUB_TOKEN 未在 Worker secrets 中配置。', { status: 500, headers: corsHeaders() })
    }

    const url = new URL(request.url)
    const username = url.searchParams.get('username')
    const endpoint = url.searchParams.get('endpoint') || 'pinned'; // 默认端点为 'pinned'

    if (!username) {
        return new Response('请求错误: 缺少 "username" 查询参数。', { status: 400, headers: corsHeaders() })
    }

    try {
        // 根据 'endpoint' 参数将请求路由到相应的处理函数。
        switch (endpoint) {
            case 'stats': // 获取用户统计数据
                return await fetchUserStats(username, GITHUB_TOKEN);
            case 'pinned': // 获取用户置顶仓库
                return await fetchPinnedRepos(username, GITHUB_TOKEN);
            case 'repos': // 代理获取用户仓库列表的 REST API 请求
                return await proxyRestApi(request, `/users/${username}/repos`, GITHUB_TOKEN);
            case 'events': // 代理获取用户动态事件的 REST API 请求
                return await proxyRestApi(request, `/users/${username}/events`, GITHUB_TOKEN);
            default:
                return new Response('请求错误: 指定了无效的 "endpoint"。', { status: 400, headers: corsHeaders() });
        }
    } catch (error) {
        console.error(`处理端点 "${endpoint}" 时出错:`, error.message);
        return new Response(`获取端点 "${endpoint}" 的数据失败。`, { status: 502, headers: corsHeaders() });
    }
}

/**
 * 创建一个包含通用 CORS 和 Content-Type 头部的 Headers 对象。
 * @param {object} customHeaders - 需要合并的额外头部。
 * @returns {object} - 包含所有头部的对象。
 */
const corsHeaders = (customHeaders = {}) => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Content-Type': 'application/json',
    ...customHeaders,
});

/**
 * 向 GitHub GraphQL API 发送请求的通用辅助函数。
 * @param {string} query - GraphQL 查询语句。
 * @param {object} variables - 查询中使用的变量。
 * @param {string} token - GitHub Personal Access Token。
 * @returns {Promise<object>} - 返回 API 响应的 JSON 数据。
 */
async function fetchGraphQL(query, variables, token) {
    const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker-GitHub-Proxy',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub GraphQL API 响应错误 ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (data.errors) {
        console.error('GraphQL 查询错误:', data.errors);
        throw new Error('GraphQL 查询返回了错误。');
    }
    return data;
}

/**
 * `stats` 端点的处理函数：获取并格式化用户的核心统计数据。
 * @param {string} username - GitHub 用户名。
 * @param {string} token - GitHub PAT。
 * @returns {Promise<Response>}
 */
async function fetchUserStats(username, token) {
    const query = `
    query UserStats($username: String!) {
      user(login: $username) {
        repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) { totalCount }
        followers { totalCount }
        following { totalCount }
        contributionsCollection {
          contributionCalendar { totalContributions }
        }
        repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
          totalCount
        }
      }
    }
  `;
    const data = await fetchGraphQL(query, { username }, token);
    const user = data.data.user;
    if (!user) {
        throw new Error(`用户 "${username}" 未找到。`);
    }

    const stats = {
        publicRepos: user.repositories.totalCount,
        followers: user.followers.totalCount,
        following: user.following.totalCount,
        contributions: user.contributionsCollection.contributionCalendar.totalContributions,
        repoContributions: user.repositoriesContributedTo.totalCount,
    };
    // 返回统计数据，并设置 12 小时的缓存。
    return new Response(JSON.stringify(stats), { headers: corsHeaders({ 'Cache-Control': 's-maxage=43200' }) });
}

/**
 * `pinned` 端点的处理函数：获取并格式化用户的置顶仓库。
 * @param {string} username - GitHub 用户名。
 * @param {string} token - GitHub PAT。
 * @returns {Promise<Response>}
 */
async function fetchPinnedRepos(username, token) {
    const query = `
    query PinnedRepos($username: String!) {
      user(login: $username) {
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name, owner { login }, description, url
              stargazers { totalCount }
              forks { totalCount }
              primaryLanguage { name, color }
            }
          }
        }
      }
    }
  `;
    const data = await fetchGraphQL(query, { username }, token);
    const user = data.data.user;
    if (!user) {
        throw new Error(`User with username "${username}" not found.`);
    }

    const pinnedRepos = user.pinnedItems.nodes.map(repo => ({
        owner: repo.owner.login,
        repo: repo.name,
        link: repo.url,
        description: repo.description,
        language: repo.primaryLanguage ? repo.primaryLanguage.name : 'Text',
        languageColor: repo.primaryLanguage ? repo.primaryLanguage.color : '#ededed',
        stars: repo.stargazers.totalCount,
        forks: repo.forks.totalCount,
    }));
    // 返回置顶仓库数据，并设置 1 小时的缓存。
    return new Response(JSON.stringify(pinnedRepos), { headers: corsHeaders({ 'Cache-Control': 's-maxage=3600' }) });
}

/**
 * 通用的 GitHub REST API 代理函数。
 * @param {Request} request - 原始请求，用于传递查询参数。
 * @param {string} apiPath - 要代理的 API 路径 (例如, `/users/USERNAME/repos`)。
 * @param {string} token - GitHub PAT。
 * @returns {Promise<Response>}
 */
async function proxyRestApi(request, apiPath, token) {
    const url = new URL(request.url);
    const apiBase = "https://api.github.com";
    // 将原始请求中的查询参数 (如 ?page=2, ?per_page=50) 附加到目标 API URL 上。
    const proxyUrl = new URL(apiBase + apiPath + url.search);

    const headers = new Headers();
    headers.set('User-Agent', 'Cloudflare-Worker-GitHub-Proxy');
    headers.set('Authorization', `bearer ${token}`);
    headers.set('Accept', 'application/vnd.github.v3+json');

    const response = await fetch(proxyUrl.toString(), {
        method: 'GET',
        headers: headers,
    });

    // 克隆响应以使其头部可修改。
    const newResponse = new Response(response.body, response);
    // 注入 CORS 和缓存头部。
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Cache-Control', 's-maxage=3600'); // 为 REST API 响应设置 1 小时缓存。

    return newResponse;
}
