import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const css = `
html, body, #root { height: 100%; }
body {
  background-color: #E8E2DC;
  font-family: 'General Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}
`;
