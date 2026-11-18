# Kubernetes Schedulingの最前線から見る景色（CloudNative Days Winter 2026）

20分のキーノート用スライドです。日本語版は `index.html`、英語版は `en.html` です。各ファイルにフォントと2枚目のプロフィール画像を埋め込んでいるので、それぞれ単独で表示できます。右上の `English` / `日本語` で、スライド番号とクエリ設定を引き継いで切り替えられます（言語を切り替えると、そのスライドの最初のステップから表示します）。コメントを有効にしているときは、ブラウザからコメントサーバへ polling します。

スライド、コメント投稿・管理ページ、配信サーバ、OSS Showcase 用の Kubernetes マニフェストをこのリポジトリで管理しています。

## ソースからビルドする

Node.js 22 系と Python 3 を使います。HTMLとYAMLの生成に追加パッケージは不要です。

```sh
git clone https://github.com/sanposhiho/cndw2026.git
cd cndw2026
python3 showcase/render.py
python3 comments/render.py
```

`index.html`、`en.html`、`showcase/apps/sanposhiho/`、`comments/apps/comments/` が生成されます。生成物もコミットしているので、clone 直後でも両言語のHTMLをブラウザで開けます。スライドだけをビルドし直す場合は `node build.mjs` を使います。

管理用の合言葉を手元の `comments/.admin-token` に保存する場合、そのファイルは `.gitignore` で除外されます。YAML に入るのは SHA-256 だけです。

## 置き方

`index.html` と `en.html` を同じディレクトリに置いて静的ホスティングできます。手元ではファイルをブラウザで直接開いても動きます。

### GitHub Pages に公開する

`.github/workflows/pages.yml` が両言語をビルドし、GitHub Pages に公開します。公開用ディレクトリ `_site/` に入れるのは2つのHTMLとフォントのライセンスだけです。

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
2. この変更を `main` に push する。以後、スライドのソース・画像・フォント・ビルド設定の更新時に自動公開されます。
3. 初回や再公開は **Actions → Deploy slides to GitHub Pages → Run workflow** からも実行できます。

| 言語 | 公開後のURL |
| --- | --- |
| 日本語 | `https://sanposhiho.github.io/cndw2026/` |
| English | `https://sanposhiho.github.io/cndw2026/en.html` |

特定のスライドは `en.html#p12` のように共有できます。コメントを無効にして共有するときは `en.html?comments=off#p12` です。GitHub Pages が配信するのは静的な資料で、コメントは既存の OSS Showcase のコメントサーバを使います。サーバが停止していても資料は表示できます。

公開用ファイルを手元で確認する場合：

```sh
node build.mjs --out-dir _site
cp fonts/LICENSE-IBM-Plex.txt _site/LICENSE-IBM-Plex.txt
python3 -m http.server 8000 --directory _site
```

`http://localhost:8000/` と `http://localhost:8000/en.html` を開きます。GitHub側の設定は [GitHub Pages の公式ガイド](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) を参照してください。

### OSS Showcase で資料も公開する

`showcase/apps/sanposhiho/` は、資料を `https://sanposhiho.showcase.cloudnativedays.jp` で配信するための構成です。初回導入のPRは [資料公開 #37](https://github.com/cloudnativedaysjp/oss-showcase/pull/37) と [コメントアプリ #36](https://github.com/cloudnativedaysjp/oss-showcase/pull/36) で、いずれもマージ済みです。

| 用途 | 公開時のURL |
| --- | --- |
| 資料 | `https://sanposhiho.showcase.cloudnativedays.jp/` |
| コメント・質問の投稿 | `https://comments.showcase.cloudnativedays.jp/` |
| コメントの管理 | `https://comments.showcase.cloudnativedays.jp/admin`（合言葉が必要） |

資料とコメントサーバは別のテナントです。資料を開いた各ブラウザが、公開されたコメントサーバから新着コメントを1秒おきに取得します。API は別オリジンからの読み取りに対応しています。資料配信サーバからコメントサーバへの通信はありません。

視聴者はそれぞれ好きなページを開けます。ページ送りは端末ごとに独立しており、発表者の操作とは同期しません。新着コメントは、各端末の画面下部にある専用バーに表示されます。発表者も公開URLを使えますし、手元の `index.html` から同じコメントサーバに接続しても構いません。

資料や配信サーバを直したら、次のコマンドでHTMLとYAMLをまとめて作り直します。

```sh
python3 showcase/render.py
```

`showcase/server.js` は Node.js の標準ライブラリだけで `/`・`/index.html`・`/healthz` を配信します。公式の `node:22-alpine` を使い、コードとHTMLは ConfigMap に含めるため、独自イメージのビルドやレジストリへの push は不要です。gzip 配信と ETag に対応し、HTMLを更新するとチェックサムによって Pod も更新されます。

OSS Showcase は従来どおり日本語版を配信します。2言語分のHTMLを同じConfigMapに含めると1MiB上限を超えるため、`showcase/render.py` は埋め込む日本語版の `English` リンクを GitHub Pages の英語版へ向けます。このリンクを使う前に GitHub Pages を公開してください。自己紹介の資料用QRコードは、両言語とも従来の OSS Showcase の日本語版を指します。

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

既存テナントの更新では、運営の最新 `main` を土台に ConfigMap と Deployment の `code-sha256` を更新します。運営が追加した `priorityClassName`・レプリカ数・リソース量は維持し、手元向けの `app.yaml` で上書きしないでください。

## プロフィール画像（2枚目）

`assets/avatar.jpg` を `node build.mjs` が `index.html` に埋め込みます。差し替えるときは同じ場所に `avatar.jpg`（`.png` `.webp` でも可）を置いてビルドし直してください。正方形の画像を想定しています。

`assets/` に画像が無い状態でビルドすると、表示時に `https://github.com/sanposhiho.png` を読みに行き、読めなければ頭文字「KN」のタイルになります。

## QRコード（2枚目）

自己紹介の右側に、コメント投稿用と資料閲覧用を縦に2つ並べています。発表終了後、表紙のQRコードは両言語とも削除しました。QRコードのカード自体もリンクなので、クリック・タップで開けます。資料用はコメント機能の状態に関係なく表示されます。

URLを変えるときは `build.mjs` の `COMMENTS_URL` / `SLIDES_URL` を直し、対応するSVGを作り直します。QRコードの生成時だけ [Segno](https://pypi.org/project/segno/) が必要です。

```sh
python3 tools/qr.py https://comments.showcase.cloudnativedays.jp/
python3 tools/qr.py https://sanposhiho.showcase.cloudnativedays.jp/ assets/slides-qr.svg --label スライド資料のQRコード
python3 showcase/render.py
```

## 操作

| 操作 | キー |
| --- | --- |
| 次へ / 戻る | `→` `Space` `Enter` `PageDown` / `←` `PageUp`（クリッカー対応。画面クリックでも進み、左端クリックで戻る） |
| スライド単位で移動 | `↓` / `↑`、先頭 `Home`、末尾 `End` |
| スライド一覧 | `O` または `Esc` |
| 全画面 | `F` |
| いまの動きをもう一度見せる | `R` |
| 暗転 | `B` または `.` |
| コメントの表示を消す / 戻す | `C`（表示中のコメントと投稿用QRコードをまとめて消す） |
| コメント一覧を開く / 閉じる | `L`（届いたコメントを古い順に見返す。コピーと保存ができる） |

スマホでは、右側タップで次へ、左端タップで戻る、横スワイプでも移動できます。縦持ちでもスライドを画面中央に表示します。

URL の末尾に `#p12` を付けると12枚目から開きます。

## 画面の下端に出るもの

- 左：章の名前。機能パート（14〜22枚目）では Gang / Topology / Preemption / 階層 のどこにいるか
- 右：ページ番号と、その左の小さな点。点はそのスライドの残りクリック数

## コメントを表示する（任意）

聴衆がスマホから送ったコメントを、スライドとは独立した画面下部のバーに、1件ずつ表示できます。コメントサーバ（`comments/`）が別に要ります。

- スライドは、`build.mjs` の `COMMENTS_URL` に書いたサーバを1秒おきに読みに行きます。サーバに繋がらないあいだは、コメントと投稿用QRコードは出ません。発表はそのまま続けられます。
- 投稿用QRコード（2枚目）は、サーバに繋がっていて、受け付けているあいだだけ出ます。資料用QRコードは常に表示されます。
- **`C` キー**で、コメントと投稿用QRコードをまとめて消せます。もう一度押すと戻ります（消していた間の投稿は出ません）。
- **管理ページ**（`https://<サーバ>/admin`）で「コメントを止めて、画面から消す」を押すと、スライドからコメントが消え、新しい投稿も受け付けなくなります。発表者以外の人（運営など）が止めるためのものです。開くには管理用の合言葉が要ります。`https://<サーバ>/admin#<合言葉>` の形のURLを渡すと、そのまま入れます。
- バーの高さは画面の5%（36〜56px）です。スライドは、その上の表示領域に縦横比を保って収めるため、コメントと重なりません。コメント表示をオフにするかサーバが停止するとバーを隠し、資料の表示領域を戻します。
- 1件は40文字まで。バーに収まるコメントは、その場に表示して7秒間静止します。収まらない長文だけ、先頭を2秒見せてから、末尾まで左へ動かし、最後も2秒止めます（表示は最低7秒）。画面幅を変えると、表示中のコメントを測り直して先頭から表示します。待機中の案内文は出しません。
- 名前は任意で20文字まで入力できます（本文の40文字とは別枠）。入力すると、バー・スライドのコメント一覧・管理ページに「名前: コメント」と表示されます。空欄なら本文だけを表示します。「ひとことで送る」にも入力中の名前を付けます。コピー・保存にも名前が入ります。
- 表示待ちは最大3件で、手入力のコメントを「ひとことで送る」より先に表示します。枠を超えると定型コメントを古い順に外し、手入力だけならその中で最新3件を残します。同じ種類では到着順で、表示中のコメントは途中で切り替えません。表示しなかった分もコメント一覧には残ります。コメント同士の位置・速度の比較や、行の振り分けは行いません。
- **届いたコメントは、あとから一覧で見返せます。**「？」を含むもの（質問らしいもの）は色を変えて目立たせます。
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
   - スライドの2枚目に投稿用・資料用の2つのQRコードが出る（中身は本番のURLなので、手元では投稿ページを直接開く）。
   - 投稿ページから送ると、1〜2秒で受信し、下部バーが空いていればその場に表示される。連続投稿は1件ずつ順番に表示され、バーに収まらない長文だけ左へ動く。
   - スライドで `C` を押すと、コメントバーと投稿用QRコードが消え、資料の表示領域が広がる。資料用QRコードは残る。もう一度押すと戻る。
   - スライドで `L` を押すと、届いたコメントの一覧が開く。もう一度 `L` または `Esc` で閉じる。
   - 管理ページで「コメントを止めて、画面から消す」を押すと、スライドから消え、投稿ページの入力欄が使えなくなる（投稿ページへの反映は最大5秒）。「再開する」で戻る。
   - 4 の `port-forward` を止めると、10秒ほどで投稿用QRコードが消える。スライドはそのまま操作できる。もう一度繋ぐと、10秒ほどで戻る。

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

- 本文は日本語版 `src/slides.html`、英語版 `src/slides.en.html` を編集します。同じスライドの `data-key`・`data-scene`・ステップ構成を両言語でそろえてください。
- 図と動作は共通の `src/scenes.js`・`src/engine.js`、見た目は `src/deck.css` です。図・操作メニューの文言は `localize('日本語', 'English')` で切り替えます。
- `node build.mjs`（Node.js のみ、依存パッケージなし）で `index.html` と `en.html` を作り直します。生成済みHTMLへの直接編集は次回ビルドで上書きされるため、ソースを編集してください。
- 図の中のPodに `cls: 'act'` を付けると、働いているかどうかのメーターが出ます。`t.cls(id, 'run')` で動き出し、外すと止まります（`src/scenes.js` の先頭に説明があります）。16枚目の線の上を動く点は、線の種類（`ng` は遅い、`ok` は速い）で速さが決まります。

| ファイル | 中身 |
| --- | --- |
| `src/slides.html` / `src/slides.en.html` | 日本語版 / 英語版のスライド本体。`data-s="2"` を付けた要素はステップ2で現れる。`data-key` はスライドの識別名（個別のスタイル指定にも使う） |
| `src/scenes.js` | 図の定義。部品（Pod、Node、PodGroupの枠）の配置と、ステップごとの動き |
| `src/deck.css` | 見た目。先頭の `:root` に色とフォントをまとめてある |
| `src/engine.js` | スライド送り、コメント表示、図を動かす仕組み |
| `fonts/` | 欧文フォント IBM Plex Sans / Mono（SIL Open Font License） |
| `assets/` | 2枚目のプロフィール画像（`avatar.jpg`）、投稿用・資料用QRコード（`comments-qr.svg`、`slides-qr.svg`） |
| `comments/` | コメントサーバ。`server.js`（Node の標準ライブラリだけ）、投稿ページ `post.html`、管理ページ `admin.html`、YAMLを作る `render.py`、できたYAML `apps/comments/`、PR本文の下書き `PR.md` |
| `showcase/` | 資料の配信サーバ `server.js`、HTMLとYAMLを作る `render.py`、できたYAML `apps/sanposhiho/` |
| `tools/qr.py` | QRコードを作り直す |

図は、スライドの空きに合わせて自動で拡大・中央寄せされます。部品を足したり動かしたりしても、位置合わせをやり直す必要はありません。

## 発表前に確認すること

- **24枚目のステータス表**：v1.35〜v1.37 はリリース済み実装、v1.38 は2026-11-17時点の [kubernetes/kubernetes master（67dc8f1）](https://github.com/kubernetes/kubernetes/blob/67dc8f12b970187a4b3f888328be62723714fb3a/pkg/features/kube_features.go) に合わせてあります。Workload API / Gang Scheduling は v1.35 で Alpha、独立した PodGroup API は v1.36 で Alpha のため、行を分けています。Job連携は v1.36 で Alpha、v1.38 で Beta（[PR #143188](https://github.com/kubernetes/kubernetes/pull/143188)、11月17日20:08 JSTにマージ）。Topology と CompositePodGroup も v1.38 で Beta です。表中の機能はまだ GA ではなく、Beta もデフォルト無効です。v1.38 は開発版の確認結果なので、発表前に最新状態を再確認してください。直し方は `src/slides.html` の24枚目のコメントにあります。
- **20枚目のYAML**：v1.37.0 と 2026-11-15 時点の master の API 型定義で確認済みです（topology のフィールドは `key`）。KEP-5547 / 6089 の本文は `level` と書いているので、v1.38 で変わる場合は直してください。
- **2枚目**：所属は「???」にしてあります。
- **コメントを流す場合**：サーバのYAMLが OSS Showcase にマージされているか、本番のURLでスマホから投稿してスライドに流れるか、`C` と管理ページで消えるかを、会場のネットワークで確かめてください。使わないと決めたら、`build.mjs` の `COMMENTS_URL` を `''` にして作り直すと、機能ごと外れます。
- **3枚目**：SIG Scheduling と Tech Lead の説明です。Tech Lead の仕事は3つに絞ってあります（KEP のレビューと承認、実装のレビューと承認、リリースに何を入れるか）。
- **4枚目のグラフ**：各リリース日の時点で、`kep.yaml` の `latest-milestone` がそのリリースになっている SIG Scheduling の KEP を数えたものです（kubernetes/enhancements、v1.38 は 2026-11-06 時点）。Release Team の公式な追跡リストとは一致しない可能性があります。数字は `src/slides.html` と `src/slides.en.html` の4枚目の `data-kep` を同じ値に直すと、棒、ラベル、平均が作り直されます。
- **25枚目（この先の景色）**：v1.37 のブログ「Advancing Workload-Aware Scheduling」の What's next、KEP-4671 の Future plans、KEP-5732 の Future Extensions、KEP-6089 の対応コントローラ一覧をまとめたものです。「賢くする」の中身は KEP に構想として書かれている段階です。「固める」（GA）は、コードフリーズ後の状態に合わせて言い方を変えてください。
- **5枚目**：DRA 以外の3つ（Gateway API Inference Extension、Agent Sandbox、AI Conformance）は 2026-11 時点の kubernetes/community の sigs.yaml と各リポジトリで確認した内容です。載せる顔ぶれは好みで入れ替えてください。
