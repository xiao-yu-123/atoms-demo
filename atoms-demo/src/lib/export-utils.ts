// ============================================================================
// 代码导出工具
// ============================================================================

/**
 * 将所有文件打包下载为 ZIP
 * 使用轻量实现，不依赖外部库
 */
export async function downloadAsZip(
  files: Record<string, string>,
  projectName = "atoms-project",
): Promise<void> {
  // 动态 import JSZip 仅在需要时加载
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const [path, content] of Object.entries(files)) {
    // 去掉开头的 /，使路径相对
    const cleanPath = path.replace(/^\//, "");
    zip.file(cleanPath, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "-")}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 在新标签页中打开独立预览（仅 HTML 文件可用）
 */
export function openPreviewInNewTab(files: Record<string, string>): void {
  // 找到入口 HTML 或 App 文件
  const htmlFile =
    files["/index.html"] ??
    Object.values(files).find((c) => c.includes("<!DOCTYPE") || c.includes("<html"));

  if (htmlFile) {
    const blob = new Blob([htmlFile], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }

  // 如果没有 HTML 文件，构建一个包含 React 应用的基础 HTML
  const appTsx = files["/App.tsx"] ?? files["/App.jsx"] ?? "";
  const styles = files["/styles.css"] ?? files["/index.css"] ?? "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atoms Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${styles}</style>
</head>
<body class="bg-zinc-950 text-zinc-100">
  <div id="root"></div>
  <p style="color:#71717a;text-align:center;padding:4rem;">
    ⚠️ 此应用包含 React 组件，无法在纯 HTML 中运行。<br/>
    请使用右侧预览面板查看，或导出 ZIP 后在本地运行。
  </p>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}
