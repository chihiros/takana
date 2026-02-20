# App Spec

## Purpose
- AI とチャットしながら AI-DLC の開発内容を計画するためのコラボ Web アプリ。

## 要件
- GitHub Pages 単体で動作（P2P）。
- リアルタイム: 参加者のカーソル位置と入力の動きが全員に反映される。
- AI 連携: Web ページ上の設定または環境変数（`public/env.js` 経由）で設定可能。
- ルーム: パスワード付きのルームを作成し、知っている人だけが参加可能。

## 実装概要
- Realtime: P2P（WebRTC + public trackers）で presence/チャットを同期。
- ルームパスワード: roomId+password のハッシュでスワーム分離。パスワードを設定した場合はE2E暗号化（AES‑GCM, PBKDF2）を適用。
- 履歴: IndexedDBにルーム毎の直近約200件を保存。ピア間では直近メッセージを相互同期。
- AI: OpenAI 互換 API にブラウザから直接 fetch（ユーザー持ちキー）またはプロキシ URL を利用。
- 同期: `presence` ノードに `{x,y,name,color,typing}` を保存し、キャンバスにカーソル描画。
- チャット: `messages` ノードに `{role, content, author, ts}` を push。

## 設定
- アプリ内の Settings で AI API Key / Proxy、モデル名、プロフィールを保存（localStorage）。
- `public/env.js` で既定値を注入可能（例: `public/env.example.js`）。

## セキュリティ
- 本実装はデモ用途。P2PはE2E暗号ではないため、秘匿情報は扱わないでください。AIプロキシの導入を推奨。
