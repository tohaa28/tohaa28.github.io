import importlib.util
import json
import shutil
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

src = Path(__file__).resolve().parents[1] / "tools" / "gwb-vector-bridge.py"
spec = importlib.util.spec_from_file_location("gwb_vector_bridge", src)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

class VectorBridgeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        bridge.ThreadedTest = None
        cls.server = bridge.ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
        cls.port = cls.server.server_address[1]
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def call(self, route, *, method="GET", data=None, origin="https://gifts.ru", authorize=True, headers=None):
        h = {"Origin": origin}
        if authorize:
            h["X-GWB-Nonce"] = bridge.TOKEN
        h.update(headers or {})
        request = urllib.request.Request("http://127.0.0.1:"+str(self.port)+route,
                                         data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_public_status_respects_exact_origin(self):
        self.assertEqual(self.call("/api/status", authorize=False)[0], 200)
        self.assertEqual(self.call("/api/status", authorize=False, origin="https://evil.example")[0], 403)
        self.assertEqual(self.call("/api/status", authorize=False, origin="https://fake-gifts.ru")[0], 403)
        self.assertEqual(self.call("/api/status", authorize=False, origin="https://tohaa28.github.io")[0], 200)
        self.assertEqual(self.call("/api/sessions/notvalid/status")[0], 404)
        self.assertEqual(self.call("/api/sessions/notvalid/status", authorize=False)[0], 403)

    def test_upload_and_save_status_only_publish_stable_edited_source(self):
        original=b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H1"/></svg>'
        changed=b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H2"/></svg>'
        status, raw=self.call("/api/sessions",method="POST",data=original,
                             headers={"X-GWB-File-Name":"logo.svg","Content-Type":"application/octet-stream"})
        self.assertEqual(status,200)
        item=json.loads(raw)
        self.assertEqual(self.call("/api/sessions/"+item["id"]+"/status")[0],200)
        self.assertFalse(json.loads(self.call("/api/sessions/"+item["id"]+"/status")[1])["changed"])
        session=bridge.SESSIONS[item["id"]]
        session["path"].write_bytes(changed)
        self.assertFalse(json.loads(self.call("/api/sessions/"+item["id"]+"/status")[1])["changed"])
        time.sleep(1.15)
        update=json.loads(self.call("/api/sessions/"+item["id"]+"/status")[1])
        self.assertTrue(update["changed"])
        self.assertEqual(update["revision"],bridge.digest(changed))
        self.assertEqual(self.call("/api/sessions/"+item["id"]+"/file")[1],changed)
        shutil.rmtree(session["path"].parent)
        bridge.SESSIONS.pop(item["id"],None)

    def test_nonvector_upload_is_rejected(self):
        status,_=self.call("/api/sessions",method="POST",data=b"not a vector",
                           headers={"X-GWB-File-Name":"logo.png"})
        self.assertEqual(status,400)
        status,_=self.call("/api/sessions",method="POST",data=b"evil",
                           headers={"X-GWB-File-Name":"../../something.exe"})
        self.assertEqual(status,400)

if __name__=="__main__":
    unittest.main()
