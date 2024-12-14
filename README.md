
# Line Messaging API to Google Photo
 
## aws

ローカルにアクセスキーを設定してください。

```shell
aws configure
```

## line

Line Messaging APIを設定し、`sls deploy`時のurlをWebhook URLに指定してください。  
- https://developers.line.biz/ja/docs/messaging-api/getting-started/
- https://manager.line.biz/

## google

OAuth 2.0 クライアント IDをウェブアプリケーションで設定してください。この時、URIには`sls deploy`時のURL及び`http://localhost:3000`を指定してください。  
承認済みのリダイレクトURIには`http://localhost:3000`を指定してください。
- https://console.cloud.google.com/projectselector2/apis/credentials

また、アプリがテストの公開ステータスの場合、7日でrefresh_tokenが切れるため、本番環境へ設定してください。

### REFRESH_TOKENを手動で生成
1. OAuth 同意画面 から、テストユーザーにGoogle Photoのアカウントメールアドレスを指定します。
2. ブラウザで以下にアクセス。CLIENT_IDはGoogleCloudから取得

```
https://accounts.google.com/o/oauth2/auth?client_id={CLIENT_ID}&redirect_uri=http://localhost:3000&response_type=code&scope=https://www.googleapis.com/auth/photoslibrary&access_type=offline&prompt=consent
```

3. ブラウザで認証後、redirect先のURLからcodeを取得し、以下コマンドを実行

```shell
curl -X POST --data 'code={CODE}&client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}&redirect_uri=http://localhost:3000&grant_type=authorization_code' https://oauth2.googleapis.com/token
```

4. レスポンスのrefresh_tokenを取得

## アルバム作成

```shell
/bin/bash createAlbum.sh .env.dev
# レスポンスのidを.envファイルのG_ALBUM_IDに指定してください
```

## 環境変数

以下をそれぞれ自らの値で設定してください。

```
L_CHANNEL_SECRET=
L_CHANNEL_ACCESS_TOKEN=
G_CLIENT_ID=
G_CLIENT_SECRET=
G_REFRESH_TOKEN=
G_ALBUM_ID=
G_ALBUM_NAME=
START_DATETIME=2025-01-01T00:00:00+09:00
END_DATETIME=2025-01-01T00:00:00+09:00
```

## テスト

`event-body.json`に、webhook URLに送られるLineからのrequest bodyを保存し実行。

```shell
sls offline --stage dev
curl -X POST -d @event-body.json http://localhost:3000
```

## デプロイ

```shell
sls deploy --stage dev
# sls deploy --stage prod
```

## ログ確認

```
sls logs --stage dev --function callback
```

## 他

lambda APIは公開されるため、制限を行いたい場合は別途設定を追加してください。