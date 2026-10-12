"""Static server that gzips, like every real host. Serving uncompressed made
the LCP measurement meaningless: the browser was pulling ~380 KB of raw
JavaScript where GitHub Pages or Cloudflare would send ~118 KB."""
import http.server, socketserver, gzip, io, os, sys
ROOT = sys.argv[1]; PORT = int(sys.argv[2])
COMPRESS = ('.js', '.css', '.html', '.json', '.svg')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path): path = os.path.join(path, 'index.html')
        if not os.path.isfile(path): return super().send_head()
        accepts = 'gzip' in self.headers.get('Accept-Encoding', '')
        data = open(path, 'rb').read()
        ctype = self.guess_type(path)
        if accepts and path.endswith(COMPRESS):
            data = gzip.compress(data, 6)
            self.send_response(200); self.send_header('Content-Encoding', 'gzip')
        else:
            self.send_response(200)
        self.send_header('Content-type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        return io.BytesIO(data)
    def log_message(self, *a): pass
    # A browser is not a script. It opens several sockets at once and holds
    # them open, and `TCPServer` serves exactly one connection at a time — so
    # the first idle keep-alive connection blocked `serve_forever` and the
    # server answered nothing for two days while still holding the port. The
    # link looked correct and the page never loaded, which is the worst shape a
    # failure can take. Sequential tools (curl, the Playwright walks) never
    # revealed it because they only ever opened one connection at a time.
    protocol_version = 'HTTP/1.1'   # safe: every response above sets Content-Length
class Threaded(socketserver.ThreadingTCPServer):
    daemon_threads = True           # a stuck request cannot keep the process alive
    allow_reuse_address = True
with Threaded(('127.0.0.1', PORT), H) as s:
    print(f'serving {ROOT} on http://127.0.0.1:{PORT}/  (loopback only)', flush=True)
    s.serve_forever()
