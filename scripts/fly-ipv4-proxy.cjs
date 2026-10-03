/* eslint-disable @typescript-eslint/no-require-imports -- This Fly helper runs as CommonJS. */
const http = require('node:http');
const net = require('node:net');
const dns = require('node:dns').promises;

const server = http.createServer((_request, response) => {
  response.writeHead(405);
  response.end();
});

server.on('connect', async (request, client, head) => {
  const [hostname, rawPort] = request.url.split(':');
  if (!hostname || Number(rawPort) !== 443) {
    client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }

  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    const upstream = net.connect({ host: address, port: 443 });
    upstream.once('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.once('error', () => client.destroy());
    client.once('error', () => upstream.destroy());
  } catch {
    client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
  }
});

server.listen(18765, '127.0.0.1');
