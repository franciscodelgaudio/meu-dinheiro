# MeuDinheiro

Aplicação web de controle financeiro pessoal com dashboard mensal, organização de gastos por grupos, gestão de dívidas, perfil financeiro e insights com IA.

> Este é o diretório da aplicação Next.js. O README principal do repositório está um nível acima.

## Rodando o projeto

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Variáveis de ambiente

Crie um arquivo `.env.local`:

```env
MONGODB_URI="mongodb+srv://usuario:senha@cluster/meudinheiro"
AUTH_SECRET="sua_chave_secreta"
AUTH_GOOGLE_ID="seu_google_client_id"
AUTH_GOOGLE_SECRET="seu_google_client_secret"
GEMINI_API_KEY="sua_chave_do_gemini"
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
