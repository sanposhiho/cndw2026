<!-- cloudnativedaysjp/oss-showcase に出す Pull Request の本文（下書き）。出すファイルは comments/apps/comments/ の configmap.yaml、app.yaml、httproute.yaml の3つ -->

## アプリの名前

comments

## 一言紹介

キーノート「Kubernetes Schedulingの最前線から見る景色」で、会場のみなさんがスマホから送ったコメントを、スライド下部の専用バーに表示するためのサーバです。投稿ページ、投稿の受付、任意のニックネーム、定型投稿の区別、表示の一括停止を持っています。

## リポジトリの URL（あれば）

https://github.com/sanposhiho/cndw2026

実装は `comments/` にあります。提出する ConfigMap（`apps/comments/configmap.yaml`）は、この実装から `comments/render.py` で生成しています。

## コンテナイメージ

Docker Hub 公式の `node:22-alpine` です。自作のイメージはありません。コードは ConfigMap の `server.js` で、Node の標準ライブラリだけを使っています。

## 確かめたこと

- [x] `python3 scripts/check.py` で `ok` と出た
- [x] Secret とパスワードは、見られても困らないテスト用の値にした
- [x] 外のサービスに繋ぐなら、繋ぎ先を下に書いた

Secret は使っていません。表示を止める操作には管理用の合言葉が要りますが、YAML に書いてあるのはその SHA-256 だけです。
外への通信はありません。データはメモリにだけ持ち、Pod が作り直されると消えます。Pod は1つで、更新PRでは運営側のリソース設定を維持します。
