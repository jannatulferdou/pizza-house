export function vercelConfig(apiOrigin) {
  let url;
  try {
    url = new URL(apiOrigin);
  } catch {
    throw new Error("Set API_ORIGIN to the HTTPS backend origin in Vercel Environment Variables, then redeploy.");
  }
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("API_ORIGIN must be an HTTPS origin only, for example https://pizza-api.example.com (no /api, credentials or query).");
  }
  return {
    version: 3,
    routes: [
      { src: "/api", dest: `${url.origin}/api` },
      { src: "/api/(.*)", dest: `${url.origin}/api/$1` },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  };
}
