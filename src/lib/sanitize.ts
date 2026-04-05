// 白名单标签过滤，防御性编程
const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li',
  'a', 'img', 'br', 'hr', 'blockquote',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
};

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

function cleanNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      while (el.firstChild) {
        node.insertBefore(el.firstChild, el);
      }
      el.remove();
      continue;
    }
    const allowedAttrs = ALLOWED_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
      if (!allowedAttrs?.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    cleanNode(el);
  }
}

export function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}
