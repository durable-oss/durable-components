import { describe, it, expect, vi } from 'vitest';
import { createWSServer } from '../../showcase/websocket';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type * as net from 'node:net';

// Minimal fake socket that records writes and emits events.
function fakeSocket(): net.Socket & { written: Buffer[] } {
  const emitter = new EventEmitter() as net.Socket & { written: Buffer[] };
  emitter.written = [];
  (emitter as any).write = (data: Buffer) => {
    emitter.written.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return true;
  };
  return emitter;
}

// Build a valid WebSocket upgrade request.
function upgradeRequest(key: string) {
  return {
    headers: { 'sec-websocket-key': key },
  } as any;
}

// Encode a client-to-server WebSocket text frame (masked, as clients must).
function encodeClientFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf-8');
  const mask = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  const header = Buffer.alloc(payload.length < 126 ? 6 : 8);
  header[0] = 0x81; // FIN + text opcode
  header[1] = 0x80 | (payload.length < 126 ? payload.length : 126);
  let offset = 2;
  if (payload.length >= 126) {
    header.writeUInt16BE(payload.length, 2);
    offset = 4;
  }
  mask.copy(header, offset);
  const maskedPayload = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    maskedPayload[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, maskedPayload]);
}

// Decode a server-to-client WebSocket frame (unmasked).
function decodeServerFrame(buf: Buffer): string {
  const payloadLen = buf[1] & 0x7f;
  let offset = 2;
  let len = payloadLen;
  if (payloadLen === 126) {
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  return buf.slice(offset, offset + len).toString('utf-8');
}

describe('createWSServer', () => {
  describe('handshake', () => {
    it('sends a valid 101 Switching Protocols response', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      const key = 'dGhlIHNhbXBsZSBub25jZQ==';
      ws.handleUpgrade(upgradeRequest(key), socket, Buffer.alloc(0));

      expect(socket.written).toHaveLength(1);
      const response = socket.written[0].toString();
      expect(response).toContain('HTTP/1.1 101 Switching Protocols');
      expect(response).toContain('Upgrade: websocket');
      expect(response).toContain('Connection: Upgrade');
      expect(response).toContain('Sec-WebSocket-Accept:');
    });

    it('computes the correct Sec-WebSocket-Accept value', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      const key = 'dGhlIHNhbXBsZSBub25jZQ==';
      ws.handleUpgrade(upgradeRequest(key), socket, Buffer.alloc(0));

      const response = socket.written[0].toString();
      const acceptMatch = response.match(/Sec-WebSocket-Accept: (.+)\r\n/);
      expect(acceptMatch).toBeTruthy();
      const expectedAccept = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
      expect(acceptMatch![1]).toBe(expectedAccept);
    });
  });

  describe('broadcast', () => {
    it('does nothing when no clients connected', () => {
      const ws = createWSServer();
      // Should not throw
      expect(() => ws.broadcast('hello')).not.toThrow();
    });

    it('sends encoded frame to a connected client', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));

      // Flush written array after handshake
      socket.written = [];

      ws.broadcast('hello world');
      expect(socket.written).toHaveLength(1);
      const decoded = decodeServerFrame(socket.written[0]);
      expect(decoded).toBe('hello world');
    });

    it('broadcasts to all connected clients', () => {
      const ws = createWSServer();
      const s1 = fakeSocket();
      const s2 = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), s1, Buffer.alloc(0));
      ws.handleUpgrade(upgradeRequest('key2=='), s2, Buffer.alloc(0));

      s1.written = [];
      s2.written = [];

      ws.broadcast('ping');
      expect(decodeServerFrame(s1.written[0])).toBe('ping');
      expect(decodeServerFrame(s2.written[0])).toBe('ping');
    });

    it('removes a client after socket close', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));
      socket.written = [];

      socket.emit('close');
      ws.broadcast('after-close');
      // Client was removed, nothing written after close
      expect(socket.written).toHaveLength(0);
    });

    it('removes a client after socket error', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));
      socket.written = [];

      socket.emit('error', new Error('connection reset'));
      ws.broadcast('after-error');
      expect(socket.written).toHaveLength(0);
    });
  });

  describe('message receiving', () => {
    it('calls onMessage with decoded text when client sends a frame', () => {
      const handler = vi.fn();
      const ws = createWSServer(handler);
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));

      const frame = encodeClientFrame('hello from client');
      socket.emit('data', frame);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0]).toBe('hello from client');
    });

    it('passes the socket as second argument to onMessage', () => {
      const handler = vi.fn();
      const ws = createWSServer(handler);
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));

      socket.emit('data', encodeClientFrame('test'));
      expect(handler.mock.calls[0][1]).toBe(socket);
    });

    it('does not call onMessage when handler is not provided', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));
      // Should not throw
      expect(() => socket.emit('data', encodeClientFrame('test'))).not.toThrow();
    });
  });

  describe('frame encoding for various payload sizes', () => {
    it('encodes short messages (< 126 bytes) correctly', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));
      socket.written = [];

      const msg = 'short';
      ws.broadcast(msg);
      const frame = socket.written[0];
      expect(frame[0]).toBe(0x81); // FIN + text opcode
      expect(frame[1]).toBe(msg.length); // no masking, length inline
      expect(decodeServerFrame(frame)).toBe(msg);
    });

    it('encodes medium messages (126-65535 bytes) with 2-byte extended length', () => {
      const ws = createWSServer();
      const socket = fakeSocket();
      ws.handleUpgrade(upgradeRequest('key1=='), socket, Buffer.alloc(0));
      socket.written = [];

      const msg = 'x'.repeat(200);
      ws.broadcast(msg);
      const frame = socket.written[0];
      expect(frame[0]).toBe(0x81);
      expect(frame[1]).toBe(126); // extended length marker
      const len = frame.readUInt16BE(2);
      expect(len).toBe(200);
      expect(decodeServerFrame(frame)).toBe(msg);
    });
  });
});
