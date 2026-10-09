import React from "react";

/**
 * Fills "{name}" placeholders in a translated sentence with React nodes (e.g. <strong> button names),
 * so word order can differ per language instead of splitting a sentence into fragments.
 */
export function renderRich(template: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, i) => {
    const m = chunk.match(/^\{(\w+)\}$/);
    return m && m[1] in parts ? <React.Fragment key={i}>{parts[m[1]]}</React.Fragment> : <React.Fragment key={i}>{chunk}</React.Fragment>;
  });
}
