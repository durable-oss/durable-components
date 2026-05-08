import { describe, it, expect, vi } from 'vitest';
import { handleHttpRequest } from '../../showcase/handler';
import { EventEmitter } from 'node:events';

function fakeRes() {
  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = '';
  const res = new EventEmitter() as any;
  res.writeHead = (code: number, hdrs?: Record<string, string>) => {
    statusCode = code;
    if (hdrs) headers = { ...headers, ...hdrs };
  };
  res.end = (data?: string) => { if (data) body += data; };
  return { res, getStatus: () => statusCode, getHeaders: () => headers, getBody: () => body };
}

function fakeReq(url: string) {
  return { url } as any;
}

describe('handleHttpRequest', () => {
  it('responds 200 for /', () => {
    const { res, getStatus } = fakeRes();
    handleHttpRequest(fakeReq('/'), res, 3000);
    expect(getStatus()).toBe(200);
  });

  it('sets Content-Type: text/html for /', () => {
    const { res, getHeaders } = fakeRes();
    handleHttpRequest(fakeReq('/'), res, 3000);
    expect(getHeaders()['Content-Type']).toContain('text/html');
  });

  it('returns HTML body for /', () => {
    const { res, getBody } = fakeRes();
    handleHttpRequest(fakeReq('/'), res, 3000);
    expect(getBody()).toContain('<!DOCTYPE html>');
  });

  it('responds 200 for empty string URL', () => {
    const { res, getStatus } = fakeRes();
    handleHttpRequest(fakeReq(''), res, 3000);
    expect(getStatus()).toBe(200);
  });

  it('responds 404 for unknown paths', () => {
    const { res, getStatus } = fakeRes();
    handleHttpRequest(fakeReq('/unknown'), res, 3000);
    expect(getStatus()).toBe(404);
  });

  it('responds 404 for /favicon.ico', () => {
    const { res, getStatus } = fakeRes();
    handleHttpRequest(fakeReq('/favicon.ico'), res, 3000);
    expect(getStatus()).toBe(404);
  });

  it('responds 404 for /api/anything', () => {
    const { res, getStatus } = fakeRes();
    handleHttpRequest(fakeReq('/api/anything'), res, 3000);
    expect(getStatus()).toBe(404);
  });

  it('passes wsPort to shell HTML generation', () => {
    const { res, getBody } = fakeRes();
    handleHttpRequest(fakeReq('/'), res, 8888);
    // The shell HTML should embed the WS port somewhere
    expect(getBody()).toContain('8888');
  });
});
