# Session Hand‑Off

このドキュメントは作業の引き継ぎと再開のための最小コンテキストです。次回のエージェント/人間は本ファイルを起点に続行してください。

## Summary
- 目的: AI-DLCのImplement Plan用の協調チャット。P2P(WebRTC)で参加者同期、AI回答、行単位/範囲レビューで提案→確定。
- 実装: TypeScript + Vite。依存はnpm管理（CDN不使用）。左カラムのみのUI。

## Current State（実装状況）
- ビルド/起動: `make setup` → `make run`（Vite dev: http://localhost:5173）
- 環境変数: `.env` or `.env.local`（VITE_AI_MODEL / VITE_AI_PROXY_URL / VITE_AI_API_KEY）
- P2P: p2ptのIIFEをpostinstallで`public/vendor/p2pt.iife.js`に配置。ブラウザUMDを動的ロード。
- UI/UX:
  - 画面: 左カラムのみ。送信フォームはフッター固定。カーソルは全画面オーバーレイで表示。
  - AI応答: 送信＝AIへの問い合わせのみ（ユーザー発話は履歴に投稿しない）。AI応答はルームに共有。
  - 表示: プレーンテキスト（Markdown整形OFF、改行保持）。
  - 初回: 履歴が空なら20行のサンプル質問をAIメッセージとして自動投稿。
- レビュー機能:
  - AIメッセージ左に行ガター（行番号/レビュー有りドット表示）。
  - 行ガターのドラッグで「開始–終了」範囲を選択→範囲直後にインラインレビューUIを挿入。
  - コメント/置換案を投稿可。置換案は「Apply」で該当範囲のテキスト置換を全員に反映。
  - P2P: `review`/`apply`フレームで同期。applyはメッセージ本文を再描画。

## Known Gaps / TODO
- レビュー永続化: 現状はインメモリ。IndexedDBへ保存して再読込で復元したい。
- スレッドUI: 返信・解決(Resolved)・履歴/ロールバックなどの整備。
- 権限/承認フロー: 「提案→Approve→確定」のワークフロー化（現状は即確定）。
- 範囲選択のUX: 選択ハイライト/キャンセルUI/閉じるボタン、スクロール追従の最適化。
- エラーハンドリング: AI/CORS/ネットワーク時のトースト表示。
- E2E: Playwrightで範囲選択→スレッド→適用の主要導線テストを追加。

## E2E（Playwright）
- 構成: `playwright.config.ts` + `tests/e2e/basic.spec.ts`
- 実行前提: `@playwright/test` の導入（ブラウザDLは別途 `npx playwright install`）
- 実行方法:
  - `make e2e`（優先。`npm run test:e2e` があれば利用、なければ `npx playwright test`）
  - 直接: `npm run test:e2e` / `npx playwright test`
- テスト内容（最小）:
  - トップ表示→Joinクリック→`Joined (P2P):` 表示→初回20行サンプルの先頭行（「プランニングを始めましょう」）を検出→AIメッセージのガターUI存在確認。
- 注意: CI/ローカルで実行する際は、ネットワークに依存するP2Pは「Join直後のUI状態」のみを検証し、トラッカー疎通は前提としない。

## How To Resume（再開手順）
1) 本ファイルを確認（上の Known Gaps/TODO を優先付け）
2) ローカル起動
- `npm ci`（または `make setup`）
- `.env.local` を設定（`VITE_AI_MODEL=gpt-4o-mini` か `mock`）
- `make run` で http://localhost:5173 を開く
3) 動作確認
- ルームJoin → 20行サンプル表示確認
- 行ガターをドラッグして範囲選択→インラインレビューUI表示→コメント/置換案→Applyで置換反映
4) 次にやること（例）
- レビューのIndexedDB永続化（保存/復元）
- スレッドUIの返信/解決/閉じるUI、選択キャンセル操作
- 承認フロー（提案→Approve→確定）

## Notes（補足）
- 右カラムは削除済み。UIは左チャット全幅。
- AI出力は常にプレーンテキスト。Markdown整形は不要のため無効化。
- P2PT読み込み不具合はIIFE＋ベンダリングで回避済み。CDN不要。
