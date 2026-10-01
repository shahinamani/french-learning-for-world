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
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), H) as s: s.serve_forever()
