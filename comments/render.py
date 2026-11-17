#!/usr/bin/env python3
"""server.js・post.html・admin.html から、OSS Showcase に出す YAML（apps/comments/）を作る。

  configmap.yaml  コード
  app.yaml        Deployment と Service
  httproute.yaml  外への公開（OSS Showcase のクラスタ用。手元のクラスタでは使わない）

使い方: python3 comments/render.py [アプリの名前] [管理用の合言葉の SHA-256]
  アプリの名前を変えると、URL（<名前>.showcase.cloudnativedays.jp）も変わる。
  SHA-256 を省くと、今の YAML に入っている値をそのまま使う。合言葉そのものは YAML に書かない。
"""
import hashlib, re, sys
from pathlib import Path

here = Path(__file__).resolve().parent
name = sys.argv[1] if len(sys.argv) > 1 else "comments"
old = here / "apps" / name / "app.yaml"
if len(sys.argv) > 2:
    admin = sys.argv[2].strip().lower()
elif (here / ".admin-token").exists():      # 合言葉を書いたファイルが手元にあれば、そこから計算する
    admin = hashlib.sha256((here / ".admin-token").read_text().strip().encode()).hexdigest()
elif old.exists() and re.search(r'ADMIN_SHA256\s*\n\s*value: "?([0-9a-f]{64})"?', old.read_text()):   # なければ、今の YAML の値をそのまま使う
    admin = re.search(r'ADMIN_SHA256\s*\n\s*value: "?([0-9a-f]{64})"?', old.read_text()).group(1)
else:
    sys.exit("管理用の合言葉の SHA-256 を、2つ目の引数で渡してください（作り方は README.md）")
assert len(admin) == 64 and all(c in "0123456789abcdef" for c in admin), "SHA-256 は16進64文字"

files = ["server.js", "post.html", "admin.html"]
data = {f: (here / f).read_text(encoding="utf-8") for f in files}
digest = hashlib.sha256("".join(f + "\0" + data[f] for f in files).encode()).hexdigest()

def block(text):
    assert not text.startswith((" ", "\n")) and text.endswith("\n") and "\t" not in text and "\r" not in text
    return "".join(("    " + line if line else "") + "\n" for line in text[:-1].split("\n"))

configmap = f"""# コメントサーバのコード。comments/render.py が server.js・post.html・admin.html から作る（手では直さない）
apiVersion: v1
kind: ConfigMap
metadata:
  name: {name}
data:
""" + "".join(f"  {f}: |\n{block(data[f])}" for f in files)

app = f"""# 発表中のスライド下部に、聴衆のコメントを表示するための小さなサーバ。
# 投稿ページ（/）、投稿の受付、スライドへの受け渡し、一括停止（/admin）を持つ。状態はメモリだけで、Pod が作り直されると消える。
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {name}
spec:
  replicas: 1   # コメントをメモリに持つので、増やさない
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: {name}
  template:
    metadata:
      labels:
        app: {name}
      annotations:
        # コードが変わったら Pod を作り直すための印
        comments/code-sha256: "{digest}"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
      containers:
        - name: app
          image: node:22-alpine
          command: ["node", "/app/server.js"]
          env:
            - name: PORT
              value: "8080"
            # 管理用の合言葉の SHA-256。合言葉そのものは、このリポジトリには書いていない
            - name: ADMIN_SHA256
              value: "{admin}"
          ports:
            - containerPort: 8080
          securityContext:
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 20
          resources:
            requests:
              cpu: 20m
              memory: 48Mi
            limits:
              memory: 128Mi
          volumeMounts:
            - name: app
              mountPath: /app
      volumes:
        - name: app
          configMap:
            name: {name}
---
apiVersion: v1
kind: Service
metadata:
  name: {name}
spec:
  selector:
    app: {name}
  ports:
    - port: 80
      targetPort: 8080
"""

# 外への公開。OSS Showcase のクラスタの Gateway に繋ぐ。手元のクラスタで試すときは、このファイルだけ適用しない
route = f"""# https://{name}.showcase.cloudnativedays.jp で公開する
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {name}
spec:
  parentRefs:
    - name: showcase
      namespace: gateway
  hostnames:
    - {name}.showcase.cloudnativedays.jp
  rules:
    - backendRefs:
        - name: {name}
          port: 80
"""

out = here / "apps" / name
out.mkdir(parents=True, exist_ok=True)
(out / "configmap.yaml").write_text(configmap, encoding="utf-8")
(out / "app.yaml").write_text(app, encoding="utf-8")
(out / "httproute.yaml").write_text(route, encoding="utf-8")
print(f"wrote {out}/app.yaml, configmap.yaml, httproute.yaml  (code sha256 {digest[:12]}…, admin sha256 {admin[:12]}…)")
