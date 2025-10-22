
# Copilot Review Prompt Editor
- 「Copilot Review Prompt Editor」は、Copilot Chat に貼り付けるコードレビュー用のプロンプトを編集し、クリップボードにコピーするVSCodeの拡張です
- 指定したブランチと現在のブランチの差分をパッチファイルとして保存して、差分をレビューすることができます

## 主な機能
- コマンドパレットから「Save Git Diff Files」を実行し、比較先ブランチ名と保存先フォルダを指定して差分ファイルを作成
- 比較先ブランチ名・保存先フォルダは設定に記憶され、次回以降自動入力

## 設定項目
- `copilotReviewPromptEditor.saveDirectory`: 差分ファイルの保存先フォルダ
- `copilotReviewPromptEditor.lastCompareBranch`: 前回比較したブランチ名

## 使い方
1. コマンドパレット（Ctrl+Shift+P）で「Save Git Diff Files」を実行
2. 比較したいブランチ名を入力（前回値が自動入力）
3. 保存先フォルダを選択（初回のみ）
4. 差分パッチファイルが保存されます
5. Copilot Chat用のプロンプトがクリップボードにコピーされるのでそのまま貼り付けて使ってください
6. 既に保存済みの差分ファイルを使う場合は「Copy Diff Review Prompt」が使えます
7. 差分を使わず、現在のプロジェクトを全体的にレビューする場合は「Copy Review Prompt (No Diff)」を使います

## 注意事項
- gitコマンドが利用できる環境でご利用ください
- 差分がない場合はファイルは作成されません
- デフォルト設定はUnityプロジェクト向けのプロンプトです

---
