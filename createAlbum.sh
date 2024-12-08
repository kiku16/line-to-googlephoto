#!/bin/bash

# 環境変数ファイルをコマンドライン引数から受け取る
if [ -z "$1" ]; then
    echo "環境変数ファイルを指定してください。例: .env.dev または .env.prod"
    exit 1
fi

ENV_FILE=$1

# 指定された環境変数ファイルから環境変数を読み込む
export $(grep -v '^#' $ENV_FILE | xargs)

# jq コマンドがインストールされているか確認
if ! command -v jq &> /dev/null
then
    echo "jq コマンドが見つかりません。インストールしてください。"
    exit 1
fi

# curl コマンドを実行し、結果を変数に保存
response=$(curl -X POST https://www.googleapis.com/oauth2/v4/token -H "Content-Type: application/json" -d "{\"refresh_token\":\"$REFRESH_TOKEN\",\"client_id\":\"$CLIENT_ID\",\"client_secret\":\"$CLIENT_SECRET\",\"grant_type\": \"refresh_token\"}")

# curl コマンドのエラーハンドリング
if [ $? -ne 0 ]; then
    echo "curl コマンドの実行に失敗しました。"
    exit 1
fi

# access_token を抽出
access_token=$(echo $response | jq -r .access_token)

# access_token をデバッグ出力
echo "Access Token: $access_token"

# access_token が取得できているか確認
if [ -z "$access_token" ]; then
    echo "access_token の取得に失敗しました。"
    exit 1
fi

# Google Photos のアルバムを作成
album_response=$(curl -X POST https://photoslibrary.googleapis.com/v1/albums -H "Authorization: Bearer $access_token" -H "Content-Type: application/json" -d "{\"album\":{\"title\":\"$ALBUM_NAME\"}}")

# 作成したアルバムの情報をデバッグ出力
echo "Album Response: $album_response"

