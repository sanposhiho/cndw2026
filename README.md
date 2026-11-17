# Kubernetes Schedulingの最前線から見る景色（CloudNative Days Winter 2026）

20分のキーノート用スライドです。`index.html` 1ファイルで完結しています（フォントと2枚目のプロフィール画像も埋め込み済み）。資料の表示に外部ファイルは不要です。コメントを有効にしているときは、ブラウザからコメントサーバへ polling します。

スライド、コメント投稿・管理ページ、配信サーバ、OSS Showcase 用の Kubernetes マニフェストをこのリポジトリで管理しています。

## ソースからビルドする

Node.js 22 系と Python 3 を使います。HTMLとYAMLの生成に追加パッケージは不要です。

```sh
git clone https://github.com/sanposhiho/cndw2026.git
cd cndw2026
python3 showcase/render.py
python3 comments/render.py
```

`index.html`、`showcase/apps/sanposhiho/`、`comments/apps/comments/` が生成されます。生成物もコミットしているので、clone 直後でも `index.html` をブラウザで開けます。スライドだけをビルドし直す場合は `node build.mjs` を使います。

管理用の合言葉を手元の `comments/.admin-token` に保存する場合、そのファイルは `.gitignore` で除外されます。YAML に入るのは SHA-256 だけです。

## 置き方

`index.html` を静的ホスティング（GitHub Pages など）に置くだけです。手元ではファイルをブラウザで直接開いても動きます。

### OSS Showcase で資料も公開する

`showcase/apps/sanposhiho/` は、資料を `https://sanposhiho.showcase.cloudnativedays.jp` で配信するための構成です。現時点では公開用ファイルの準備とローカル検証までで、PR は作成していません。

| 用途 | 公開時のURL |
| --- | --- |
| 資料 | `https://sanposhiho.showcase.cloudnativedays.jp/` |
| コメント・質問の投稿 | `https://comments.showcase.cloudnativedays.jp/` |
| コメントの管理 | `https://comments.showcase.cloudnativedays.jp/admin`（合言葉が必要） |

資料とコメントサーバは別のテナントです。資料を開いた各ブラウザが、公開されたコメントサーバから新着コメントを1秒おきに取得します。API は別オリジンからの読み取りに対応しています。資料配信サーバからコメントサーバへの通信はありません。

視聴者はそれぞれ好きなページを開けます。ページ送りは端末ごとに独立しており、発表者の操作とは同期しません。新着コメントは各端末で開いているページの上を流れます。発表者も公開URLを使えますし、手元の `index.html` から同じコメントサーバに接続しても構いません。

資料や配信サーバを直したら、次のコマンドでHTMLとYAMLをまとめて作り直します。

```sh
python3 showcase/render.py
```

`showcase/server.js` は Node.js の標準ライブラリだけで `/`・`/index.html`・`/healthz` を配信します。公式の `node:22-alpine` を使い、コードとHTMLは ConfigMap に含めるため、独自イメージのビルドやレジストリへの push は不要です。gzip 配信と ETag に対応し、HTMLを更新するとチェックサムによって Pod も更新されます。

HTMLを含むConfigMapは1MiB以内に制限しています。通常の client-side apply では `last-applied-configuration` annotation の256KiB上限を超えるため、ローカルでは `--server-side` を使います。公開用ConfigMapにも Argo CD の `ServerSideApply=true` を指定しています。[Argo CD の説明](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/#server-side-apply)

Docker Desktop での確認：

```sh
kubectl --context docker-desktop create namespace sanposhiho-test
kubectl --context docker-desktop -n sanposhiho-test apply --server-side \
  -f showcase/apps/sanposhiho/configmap.yaml \
  -f showcase/apps/sanposhiho/app.yaml
kubectl --context docker-desktop -n sanposhiho-test rollout status deployment/sanposhiho
kubectl --context docker-desktop -n sanposhiho-test port-forward --address 127.0.0.1 service/sanposhiho 8081:80
```

コメントサーバの `localhost:8080` への port-forward も動かした状態で、`http://localhost:8081/?comments=http://localhost:8080` を開きます。コメントサーバの起動方法は、下の「手元の Kubernetes（Docker Desktop）で試す」にあります。更新で Pod が切り替わったら port-forward をやり直してください。

公開するときは、生成した3つのYAMLだけを [cloudnativedaysjp/oss-showcase](https://github.com/cloudnativedaysjp/oss-showcase) の `apps/sanposhiho/` に置きます。`python3 scripts/check.py` で検証した後、運営によるレビューとマージで公開されます。コメントサーバも公開しておく必要があります。OSS Showcase は1つのPRにつき1テナントというルールなので、資料の `apps/sanposhiho/` とコメントの `apps/comments/` は別々に提出します。

## プロフィール画像（2枚目）

`assets/avatar.jpg` を `node build.mjs` が `index.html` に埋め込みます。差し替えるときは同じ場所に `avatar.jpg`（`.png` `.webp` でも可）を置いてビルドし直してください。正方形の画像を想定しています。

`assets/` に画像が無い状態でビルドすると、表示時に `https://github.com/sanposhiho.png` を読みに行き、読めなければ頭文字「KN」のタイルになります。

## 操作

| 操作 | キー |
| --- | --- |
| 次へ / 戻る | `→` `Space` `Enter` `PageDown` / `←` `PageUp`（クリッカー対応。画面クリックでも進み、左端クリックで戻る） |
| スライド単位で移動 | `↓` / `↑`、先頭 `Home`、末尾 `End` |
| スライド一覧 | `O` または `Esc` |
| 全画面 | `F` |
| いまの動きをもう一度見せる | `R` |
| 暗転 | `B` または `.` |
| コメントの表示を消す / 戻す | `C`（流れているコメントとQRコードをまとめて消す） |
| コメント一覧を開く / 閉じる | `L`（届いたコメントを古い順に見返す。コピーと保存ができる） |

スマホでは、右側タップで次へ、左端タップで戻る、横スワイプでも移動できます。縦持ちでもスライドを画面中央に表示します。

URL の末尾に `#p12` を付けると12枚目から開きます。

## 画面の下端に出るもの

- 左：章の名前。機能パート（14〜22枚目）では Gang / Topology / Preemption / 階層 のどこにいるか
- 右：ページ番号と、その左の小さな点。点はそのスライドの残りクリック数

## コメントを流す（任意）

聴衆がスマホから送ったコメントを、スライドの上に右から左へ流せます。コメントサーバ（`comments/`）が別に要ります。

- スライドは、`build.mjs` の `COMMENTS_URL` に書いたサーバを1秒おきに読みに行きます。サーバに繋がらないあいだは、コメントもQRコードも出ません。発表はそのまま続けられます。
- QRコード（1枚目と2枚目）は、サーバに繋がっていて、受け付けているあいだだけ出ます。
- **`C` キー**で、流れているコメントとQRコードをまとめて消せます。もう一度押すと戻ります（消していた間の投稿は出ません）。
- **管理ページ**（`https://<サーバ>/admin`）で「コメントを止めて、画面から消す」を押すと、スライドからコメントが消え、新しい投稿も受け付けなくなります。発表者以外の人（運営など）が止めるためのものです。開くには管理用の合言葉が要ります。`https://<サーバ>/admin#<合言葉>` の形のURLを渡すと、そのまま入れます。
- 流れる範囲は、見出しの下から、下の一言の上までです。同時に流れるのは12件まで、1件は40文字までです。
- **流れたコメントは、あとから一覧で見返せます。**「？」を含むもの（質問らしいもの）は色を変えて目立たせます。
  - `L` キーで全部を古い順に見られます。何枚目のスライドで届いたかも付きます。「？」を含むものだけに絞る、コピーする、`comments.txt` に保存する、ができます。
  - 記録は、スライドを開いていたブラウザの中に残ります（開き直しても消えません。最大2000件）。`C` で表示を消していた間に届いた分も入ります。リハーサルの分を消すときは、一覧の「一覧を空にする」を押します。
  - スライドを開いていなかった間の投稿は、スライド側の一覧には入りません。管理ページには、サーバが覚えている直近1000件が時刻つきで出ます（サーバが作り直されると消えます）。
- 使わないとき：`build.mjs` の `COMMENTS_URL` を `''` にして `node build.mjs`。一時的に切るだけなら、URLの末尾に `?comments=off` を付けて開きます。
- 手元で試す：`node comments/server.js` を動かし、`index.html?comments=http://localhost:8080` を開きます。投稿ページは `http://localhost:8080/` です。管理ページも試すときは、`ADMIN_SHA256=<合言葉のSHA-256> node comments/server.js` で動かします（YAMLと同じ値は `comments/apps/comments/app.yaml` にあります）。Kubernetes の上で試す手順は、下の「手元の Kubernetes（Docker Desktop）で試す」にあります。
- Claude 上のアーティファクトのページからは、外のサーバに繋がらないことがあります。発表は、ダウンロードした `index.html` から行ってください。

### サーバを OSS Showcase のクラスタに置く

`comments/apps/comments/` の3つのYAML（`configmap.yaml`、`app.yaml`、`httproute.yaml`）を、[cloudnativedaysjp/oss-showcase](https://github.com/cloudnativedaysjp/oss-showcase) の `apps/comments/` に置いて Pull Request を出します。マージされると `https://comments.showcase.cloudnativedays.jp` で動きます。PR本文の下書きは `comments/PR.md` にあります。

- コードを直したら `python3 comments/render.py` でYAMLを作り直します。
- 名前を変えるとき：`python3 comments/render.py <名前> <合言葉のSHA-256>`、`python3 tools/qr.py https://<名前>.showcase.cloudnativedays.jp/`、`build.mjs` の `COMMENTS_URL` を直して `node build.mjs`。
- 管理用の合言葉そのものは、YAMLにもこのフォルダにも入っていません（YAMLにあるのは SHA-256 だけ）。作り直すとき：`node -e "const c=require('crypto'),t=c.randomBytes(15).toString('base64url');console.log(t,c.createHash('sha256').update(t).digest('hex'))"`
- 状態はメモリだけに持ちます。Pod が作り直されると、止めていた状態も元（受付中）に戻ります。

### 手元の Kubernetes（Docker Desktop）で試す

OSS Showcase に出すのと同じYAMLを、Docker Desktop の Kubernetes で動かして試せます。`httproute.yaml` だけは使いません（Docker Desktop には Gateway がないので、代わりに `kubectl port-forward` で繋ぎます）。

1. Docker Desktop の Settings → Kubernetes で「Enable Kubernetes」をオンにして、起動を待つ。
2. 向き先を Docker Desktop にして、試す用の namespace を作る。

   ```sh
   kubectl config use-context docker-desktop
   kubectl create namespace comments-test
   ```

3. コード（ConfigMap）と、Deployment・Service を入れる。Pod が Ready になるまで待つ。

   ```sh
   kubectl -n comments-test apply -f comments/apps/comments/configmap.yaml -f comments/apps/comments/app.yaml
   kubectl -n comments-test rollout status deployment/comments
   ```

4. 手元の 8080 番を Service に繋ぐ。このコマンドは動かしたままにする。

   ```sh
   kubectl -n comments-test port-forward service/comments 8080:80
   ```

5. ブラウザで開く。

   | 開くもの | URL |
   | --- | --- |
   | スライド | `index.html?comments=http://localhost:8080`（ファイルを開いて、URLの末尾に足す） |
   | 投稿ページ | `http://localhost:8080/` |
   | 管理ページ | `http://localhost:8080/admin#<管理用の合言葉>` |

6. 確かめること。
   - スライドの1枚目と2枚目にQRコードが出る（QRコードの中身は本番のURLなので、手元では読み取らずに、投稿ページを直接開く）。
   - 投稿ページから送ると、1〜2秒でスライドの上を流れる。
   - スライドで `C` を押すと、コメントとQRコードが消える。もう一度押すと戻る。
   - スライドで `L` を押すと、届いたコメントの一覧が開く。もう一度 `L` または `Esc` で閉じる。
   - 管理ページで「コメントを止めて、画面から消す」を押すと、スライドから消え、投稿ページの入力欄が使えなくなる（投稿ページへの反映は最大5秒）。「再開する」で戻る。
   - 4 の `port-forward` を止めると、10秒ほどでQRコードが消える。スライドはそのまま操作できる。もう一度繋ぐと、10秒ほどで戻る。

スマホから試すときは、4 を `kubectl -n comments-test port-forward --address 0.0.0.0 service/comments 8080:80` に変え、同じ Wi-Fi のスマホで `http://<PCのIPアドレス>:8080/` を開きます。

そのほか。

- ログを見る：`kubectl -n comments-test logs deployment/comments`（起動時に `listening on :8080 admin=on` と出ます）
- Pod を作り直す：`kubectl -n comments-test delete pod -l app=comments`。`port-forward` は切れるので、4 をやり直します。止めていた状態は、受付中に戻ります。
- コードを直したとき：`python3 comments/render.py` のあと、3 の `kubectl apply` をもう一度。Pod は自動で作り直されます（`port-forward` は切れるので、4 をやり直します）。
- 片付け：`kubectl delete namespace comments-test`
- 管理用の合言葉は、YAMLに入っている SHA-256 のもとになった文字列です。自分で決めたいときは、上の「作り直すとき」のコマンドで作り、`python3 comments/render.py comments <SHA-256>` でYAMLを作り直します。

本番と違うところ：外への公開（Gateway と HTTPRoute）、コンテナランタイム（本番は youki）、運営が入れている制限（リソースの既定値、通信の制限、seccomp など）は、手元では試せません。Kubernetes を使わずに動きだけ見るなら、上の「手元で試す」（`node comments/server.js`）で足ります。

## PDFにする

ブラウザの印刷（`Ctrl/Cmd + P`）で「PDFに保存」。全スライドが最終ステップの状態で1ページずつ出ます。背景のグラフィックを有効にしてください。

## 編集する

- スライドの文言を少し直すだけなら、`index.html` の `<section class="slide">` を直接編集できます。
- 図や構成を変えるなら `src/` を編集して `node build.mjs`（Node.js のみ、依存パッケージなし）。`index.html` が作り直されます。
- 図の中のPodに `cls: 'act'` を付けると、働いているかどうかのメーターが出ます。`t.cls(id, 'run')` で動き出し、外すと止まります（`src/scenes.js` の先頭に説明があります）。16枚目の線の上を動く点は、線の種類（`ng` は遅い、`ok` は速い）で速さが決まります。

| ファイル | 中身 |
| --- | --- |
| `src/slides.html` | スライド本体。`data-s="2"` を付けた要素はステップ2で現れる。`data-key` はスライドの識別名（個別のスタイル指定にも使う） |
| `src/scenes.js` | 図の定義。部品（Pod、Node、PodGroupの枠）の配置と、ステップごとの動き |
| `src/deck.css` | 見た目。先頭の `:root` に色とフォントをまとめてある |
| `src/engine.js` | スライド送り、コメント表示、図を動かす仕組み |
| `fonts/` | 欧文フォント IBM Plex Sans / Mono（SIL Open Font License） |
| `assets/` | 2枚目のプロフィール画像（`avatar.jpg`）、コメント投稿ページのQRコード（`comments-qr.svg`） |
| `comments/` | コメントサーバ。`server.js`（Node の標準ライブラリだけ）、投稿ページ `post.html`、管理ページ `admin.html`、YAMLを作る `render.py`、できたYAML `apps/comments/`、PR本文の下書き `PR.md` |
| `showcase/` | 資料の配信サーバ `server.js`、HTMLとYAMLを作る `render.py`、できたYAML `apps/sanposhiho/` |
| `tools/qr.py` | QRコードを作り直す |

図は、スライドの空きに合わせて自動で拡大・中央寄せされます。部品を足したり動かしたりしても、位置合わせをやり直す必要はありません。

## 発表前に確認すること

- **24枚目の v1.38 の列**：2026-11-15 時点の kubernetes/kubernetes master（04d3cc7）の feature gate と API に合わせてあります。Topology と CompositePodGroup の Beta 昇格はマージ済み、Workload / PodGroup API の GA 昇格と Job連携の Beta 昇格（PR #143188）は未マージでした。v1.38 のコードフリーズは 11月16日（AoE）＝日本時間 11月17日 21:00 なので、そのあとの状態に合わせてください。直し方は `src/slides.html` の24枚目のコメントにあります。
- **20枚目のYAML**：v1.37.0 と 2026-11-15 時点の master の API 型定義で確認済みです（topology のフィールドは `key`）。KEP-5547 / 6089 の本文は `level` と書いているので、v1.38 で変わる場合は直してください。
- **2枚目**：所属は「???」にしてあります。
- **コメントを流す場合**：サーバのYAMLが OSS Showcase にマージされているか、本番のURLでスマホから投稿してスライドに流れるか、`C` と管理ページで消えるかを、会場のネットワークで確かめてください。使わないと決めたら、`build.mjs` の `COMMENTS_URL` を `''` にして作り直すと、機能ごと外れます。
- **3枚目**：SIG Scheduling と Tech Lead の説明です。Tech Lead の仕事は3つに絞ってあります（KEP のレビューと承認、実装のレビューと承認、リリースに何を入れるか）。
- **4枚目のグラフ**：各リリース日の時点で、`kep.yaml` の `latest-milestone` がそのリリースになっている SIG Scheduling の KEP を数えたものです（kubernetes/enhancements、v1.38 は 2026-11-06 時点）。Release Team の公式な追跡リストとは一致しない可能性があります。数字は `src/slides.html` の4枚目の `data-kep` を直すだけで、棒、ラベル、平均が作り直されます。
- **25枚目（この先の景色）**：v1.37 のブログ「Advancing Workload-Aware Scheduling」の What's next、KEP-4671 の Future plans、KEP-5732 の Future Extensions、KEP-6089 の対応コントローラ一覧をまとめたものです。「賢くする」の中身は KEP に構想として書かれている段階です。「固める」（GA）は、コードフリーズ後の状態に合わせて言い方を変えてください。
- **5枚目**：DRA 以外の3つ（Gateway API Inference Extension、Agent Sandbox、AI Conformance）は 2026-11 時点の kubernetes/community の sigs.yaml と各リポジトリで確認した内容です。載せる顔ぶれは好みで入れ替えてください。
