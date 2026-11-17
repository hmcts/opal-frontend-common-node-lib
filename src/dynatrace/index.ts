export interface DynatraceScriptConfiguration {
  enabled?: boolean;
  scriptUrl?: string;
}

export function getDynatraceScriptUrl(configuration: DynatraceScriptConfiguration): string | undefined {
  if (configuration.enabled !== true || typeof configuration.scriptUrl !== 'string') {
    return undefined;
  }

  const scriptUrl = configuration.scriptUrl.trim();
  if (/[\u0000-\u0020\u007f]/.test(scriptUrl)) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(scriptUrl);
    const isDynatraceHost = parsedUrl.hostname.endsWith('.dynatrace.com');

    if (
      parsedUrl.protocol !== 'https:' ||
      !isDynatraceHost ||
      parsedUrl.port ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.hash ||
      !parsedUrl.pathname.endsWith('.js')
    ) {
      return undefined;
    }

    return parsedUrl.href;
  } catch {
    return undefined;
  }
}

export function addDynatraceScript(document: string, configuration: DynatraceScriptConfiguration): string {
  const scriptUrl = getDynatraceScriptUrl(configuration);
  const head = /<head(?:\s(?:[^"'<>]|"[^"]*"|'[^']*')*)?>/i.exec(document);

  if (!scriptUrl || !head) {
    return document;
  }

  const escapedScriptUrl = scriptUrl.replace(/[&<>"']/g, (character) => {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return htmlEscapes[character] ?? character;
  });
  const insertionPoint = head.index + head[0].length;
  const script = `<script type="text/javascript" src="${escapedScriptUrl}" crossorigin="anonymous" async></script>`;

  return document.slice(0, insertionPoint) + script + document.slice(insertionPoint);
}
