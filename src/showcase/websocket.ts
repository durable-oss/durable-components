import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as net from 'node:net';

type MessageHandler = (data: string, socket: net.Socket) => void;

export interface WSServer {
  broadcast: (msg: string) => void;
  handleUpgrade: (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => void;
}

/**
 * Minimal RFC 6455 WebSocket server — no external deps.
 */
export function createWSServer(onMessage?: MessageHandler): WSServer {
  const clients = new Set<net.Socket>();

  function handleUpgrade(req: http.IncomingMessage, socket: net.Socket, _head: Buffer) {
    const key = req.headers['sec-websocket-key'] as string;
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    clients.add(socket);

    socket.on('data', (buf) => {
      const msg = decodeFrame(buf);
      if (msg !== null && onMessage) onMessage(msg, socket);
    });

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  }

  function broadcast(msg: string) {
    const frame = encodeFrame(msg);
    for (const client of clients) {
      try { client.write(frame); } catch { clients.delete(client); }
    }
  }

  return { broadcast, handleUpgrade };
}

function encodeFrame(data: string): Buffer {
  const payload = Buffer.from(data, 'utf-8');
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrame(buf: Buffer): string | null {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) { payloadLen = buf.readUInt16BE(2); offset = 4; }
  else if (payloadLen === 127) { payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10; }
  const mask = masked ? buf.slice(offset, offset + 4) : null;
  if (masked) offset += 4;
  const payload = buf.slice(offset, offset + payloadLen);
  if (mask) {
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  }
  return payload.toString('utf-8');
}
