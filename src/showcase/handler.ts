import * as http from 'node:http';
import { buildShellHtml } from './ui';

export function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  wsPort: number
): void {
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildShellHtml(wsPort));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}
