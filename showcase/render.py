#!/usr/bin/env python3
"""資料をビルドし、OSS Showcase に置く apps/<名前>/ の YAML を作る。

使い方: python3 showcase/render.py [名前（既定: sanposhiho）]
ビルド済みの index.html をそのまま配信する。外部パッケージは不要。
"""
import hashlib
import re
import subprocess
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
root = here.parent
name = sys.argv[1] if len(sys.argv) > 1 else "sanposhiho"
if not re.fullmatch(r"[a-z0-9]([-a-z0-9]{0,57}[a-z0-9])?", name):
    sys.exit("名前は英小文字・数字・ハイフンで59文字以内、先頭と末尾は英数字にしてください")
subprocess.run(["node", "build.mjs"], cwd=root, check=True)
data = {
    "server.js": (here / "server.js").read_text(encoding="utf-8"),
    "index.html": (root / "index.html").read_text(encoding="utf-8"),
}
size = sum(len(text.encode()) for text in data.values())
if size > 1024 * 1024:
    sys.exit("ConfigMap の1MiB上限を超えています。画像・フォントを小さくするか、イメージに含める構成に変えてください")
digest = hashlib.sha256("".join(f + "\0" + text for f, text in data.items()).encode()).hexdigest()


def block(text):
    if not text.endswith("\n") or "\r" in text:
        raise ValueError("入力ファイルはLFで改行し、末尾にも改行を入れてください")
    return "".join("    " + line + "\n" for line in text[:-1].split("\n"))


configmap = f"""# showcase/render.py が生成。server.js とビルド済みの資料。
apiVersion: v1
kind: ConfigMap
metadata:
  name: {name}
  annotations:
    # HTMLが大きいため、last-applied-configuration annotation の256KiB制限を避ける。
    argocd.argoproj.io/sync-options: ServerSideApply=true
data:
""" + "".join(f"  {f}: |\n{block(text)}" for f, text in data.items())

app = f"""# showcase/render.py が生成。静的な資料の配信用テナント。
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {name}
  template:
    metadata:
      labels:
        app: {name}
      annotations:
        slides/code-sha256: "{digest}"
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          image: node:22-alpine
          command: ["node", "/app/server.js"]
          env:
            - name: PORT
              value: "8080"
          ports:
            - containerPort: 8080
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
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
              cpu: 500m
              memory: 128Mi
          volumeMounts:
            - name: app
              mountPath: /app
              readOnly: true
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

route = f"""# https://{name}.showcase.cloudnativedays.jp で資料を配信する
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
for filename, text in {"configmap.yaml": configmap, "app.yaml": app, "httproute.yaml": route}.items():
    (out / filename).write_text(text, encoding="utf-8")
print(f"wrote {out} (ConfigMap data: {size} bytes, sha256: {digest[:12]}…)")
