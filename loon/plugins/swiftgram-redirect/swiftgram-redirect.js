/*
 * Swiftgram Redirect (with Fallback)
 * author: Hi Jacker
 */

const args = $argument || "";

function getArg(name, def) {
  const match = args.match(new RegExp(`${name}=([^,]+)`));
  return match ? match[1] === "true" : def;
}

const enableFallback = getArg("enable_fallback", true);
const debug = getArg("debug", false);

const url = $request.url;
const match = url.match(/^https?:\/\/(?:t\.me|telegram\.me)\/(.+)/);

if (!match || !match[1]) {
  $done({});
  return;
}

const fullPath = match[1];

// 处理带 ? 参数的情况
const [domain, query] = fullPath.split("?");

let redirectUrl = `swiftgram://resolve?domain=${domain}`;
if (query) {
  redirectUrl += `&${query}`;
}

if (debug) {
  console.log("Original URL:", url);
  console.log("Redirect URL:", redirectUrl);
}

// fallback 页面（官方 Web 版本）
const fallbackUrl = `https://t.me/${fullPath}`;

// 构造带 fallback 的 html
const html = `
<html>
<head>
<meta http-equiv="refresh" content="0;url=${redirectUrl}">
<script>
setTimeout(function() {
  ${enableFallback ? `window.location.href="${fallbackUrl}";` : ""}
}, 1500);
</script>
</head>
<body>
<p>Opening Swiftgram...</p>
</body>
</html>
`;

$notification.post(
  "Swiftgram 跳转",
  "",
  enableFallback ? "已启用 fallback" : "未启用 fallback"
);

$done({
  response: {
    status: 200,
    headers: {
      "Content-Type": "text/html"
    },
    body: html
  }
});
