import React from 'react';

/**
 * Parses WhatsApp-style markdown into React elements.
 * Supports: *bold*, _italic_, ~strikethrough~, ```code```, and line breaks.
 */
export function formatWhatsAppText(text) {
  if (!text) return null;

  // Split by newlines first
  const lines = text.split('\n');
  
  return lines.map((line, lineIdx) => {
    let formattedLine = [];
    let currentText = line;

    // A simple regex approach to handle the markdown
    // We'll process bold, then italic, then strikethrough
    // Note: This is a simplified version but covers 90% of use cases
    
    const parts = line.split(/(\*.*?\*|_.*?_|~.*?~|`.*?`)/g);

    const renderedParts = parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={i}>{part.slice(1, -1)}</strong>;
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('~') && part.endsWith('~')) {
        return <del key={i}>{part.slice(1, -1)}</del>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="wa-code-inline">{part.slice(1, -1)}</code>;
      }
      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {renderedParts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}
