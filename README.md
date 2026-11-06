# TEAM LINK 戦術ボード

React + TypeScript + Viteで動作する独立したバスケットボール戦術ボードです。

## 起動

```powershell
npm.cmd install
npm.cmd run dev
```

表示されたURLをブラウザで開いてください。

## ビルド

```powershell
npm.cmd run build
```

`dist/` に公開用ファイルが生成されます。`vite.config.ts` の `base: './'` はGitHub Pagesなどのサブパス公開を考慮した設定です。

## 機能

- フルコート / ハーフコートの切り替え
- 赤5人・青5人の駒をドラッグ移動
- タッチ・マウスで線を描く（色・太さ変更）
- 三角コーン・フラットマーカーの追加と移動
- 消しゴム（描いた線・配置したマーカー）
- 元に戻す / やり直し
- ブラウザ内自動保存（localStorage）
- SVG画像として書き出し
- JSONバックアップ・復元

## 注意

- この版はPWA未設定です。GitHub公開後に `vite-plugin-pwa` 等を追加してください。
- 保存は端末・ブラウザ単位であり、クラウド同期はありません。
- ハーフコート表示はコート線の表示切替です。駒はそのままの座標に残ります。
