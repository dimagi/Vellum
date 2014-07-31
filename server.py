"""
Modification of SimpleHTTPServer that doesn't redirect for urls with ?query
"""

import SimpleHTTPServer
import SocketServer
import sys

PORT = 8000


class CustomHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):

    def __init__(self, req, client_addr, server):
        SimpleHTTPServer.SimpleHTTPRequestHandler.__init__(self, req, client_addr, server)

    def do_GET(self):
        # cut off a query string
        if '?' in self.path:
            self.path = self.path.split('?')[0]
        SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)


class MyTCPServer(SocketServer.ThreadingTCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    if any(arg in sys.argv for arg in ["-h", "--help"]):
        print("USAGE: {} [PORT]".format(sys.argv[0]))
        sys.exit()
    if len(sys.argv) > 1:
        try:
            PORT = int(sys.argv[-1])
        except ValueError:
            sys.stderr.write("unknown port: {}\n".format(sys.argv[-1]))
    httpd = MyTCPServer(('localhost', PORT), CustomHandler)
    httpd.allow_reuse_address = True
    print "Serving at port", PORT
    httpd.serve_forever()

