# ローカルSupabaseでのGoogle認証設定手順

本ドキュメントは、ローカル開発環境でSupabaseを使用したGoogle OAuth認証を設定・テストするための手順を説明します。

## 全体手順

Google認証をローカルで確認するには、以下の3つのステップを行います。

- [ローカルSupabaseでのGoogle認証設定手順](#ローカルsupabaseでのgoogle認証設定手順)
  - [全体手順](#全体手順)
    - [1. Google Cloud Consoleでの設定](#1-google-cloud-consoleでの設定)
    - [2. ローカル環境変数（.env.local）の設定](#2-ローカル環境変数envlocalの設定)
    - [3. Supabase設定（supabase/config.toml）の有効化と再起動](#3-supabase設定supabaseconfigtomlの有効化と再起動)

---

### 1. Google Cloud Consoleでの設定

1. **プロジェクトの作成 / 選択**
   - [Google Cloud Console](https://console.cloud.google.com/) にアクセスします。
   - 画面左上のプロジェクト選択プルダウンから、新しいプロジェクトを作成するか、既存のプロジェクトを選択します。

2. **OAuth同意画面（Consent Screen）の設定**
   - 左側メニューから「APIとサービス」 > 「OAuth同意画面」に移動します。
   - Google Auth Platformの「開始」を押します。
   - 適当に進めて「User Type」で **外部（External）** を選択し、「作成」ボタンを押します。

3. **OAuthクライアントIDの作成**
   - 左側メニューから「APIとサービス」 > 「認証情報」に移動します。
   - 画面上部の「+ 認証情報を作成」をクリックし、「OAuth クライアント ID」を選択します。
   - **アプリケーションの種類**: `ウェブ アプリケーション` を選択します。
   - **名前**: `supabase local`（任意の分かりやすい名前）
   - **承認済みのリダイレクト URI**:
     - 「+ URI を追加」をクリックし、以下を入力します：
       ```text
       http://127.0.0.1:54321/auth/v1/callback
       ```
   - 「作成」をクリックします。

4. **クライアントIDとクライアントシークレットの取得**
   - 作成完了後に表示されるダイアログ、または作成した認証情報の編集画面から、**クライアント ID** と **クライアント シークレット** をコピーして控えておきます。

---

### 2. ローカル環境変数（.env.local）の設定

1. プロジェクトのルートディレクトリにある `.env.local` ファイルを開きます（まだ作成していない場合は、`.env.example` をコピーして作成します）。
2. 先ほど Google Cloud Console で取得した値を設定します。

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=取得したクライアントID.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=取得したクライアントシークレット
```

---

### 3. Supabase設定（supabase/config.toml）の有効化と再起動

1. [`supabase/config.toml`](file:///Users/junhat6/ghq/github.com/engineer-first/idea-flow-app/supabase/config.toml) を開き、`[auth.external.google]` セクションを確認します。
2. `enabled` が `true` になっていることを確認します（もし `false` になっている場合は `true` に変更します）。

```toml
[auth.external.google]
enabled = true
```

3. 設定を反映するため、Supabaseを再起動します。

```bash
# Supabaseを再起動
npm run supabase:stop
npm run supabase:start
```

これでローカル開発環境でのGoogle認証が有効になり、ログイン画面からGoogleでのログインが確認できるようになります。
