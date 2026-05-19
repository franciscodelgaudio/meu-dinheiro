# MeuDinheiro

MeuDinheiro é uma aplicação web para controle financeiro pessoal, feita para organizar renda, gastos, dívidas, metas de poupança e decisões do mês em um único dashboard.

O projeto combina planejamento mensal com registro real de gastos, permitindo comparar o que foi previsto com o que já foi consumido. Também conta com insights de IA para apontar riscos, grupos críticos e recomendações práticas para manter o orçamento sob controle.

## Sobre o aplicativo

O MeuDinheiro foi criado para quem quer ter clareza sobre o próprio dinheiro sem depender de planilhas soltas. A ideia central é simples: registrar sua renda, separar os gastos por grupos, acompanhar dívidas e entender quanto ainda sobra para gastar, poupar ou ajustar ao longo do mês.

Além do controle manual, o app usa IA para analisar o cenário financeiro do usuário e sugerir cuidados práticos, como alertas de comprometimento da renda, limite recomendado para lazer e atenção a categorias que estão passando do planejado.

## Funcionalidades

- Login com Google usando NextAuth.
- Dashboard mensal com renda total, gastos planejados, gasto real e saldo planejado.
- Navegação por mês de referência.
- Cadastro de perfil financeiro com renda, moeda, intervalo de recebimento e observações.
- Organização de gastos por grupos/categorias.
- Registro de lançamentos reais.
- Gestão de dívidas e compras parceladas.
- Controle de renda extra por mês.
- Definição de valor mensal para poupança.
- Insights financeiros com IA usando Gemini.
- Interface responsiva com componentes baseados em Radix UI, Tailwind CSS e lucide-react.

## Tecnologias

- Next.js 16
- React 19
- TypeScript
- Prisma
- PostgreSQL
- NextAuth
- Tailwind CSS
- Radix UI
- Google Gemini API

## Estrutura do projeto

```txt
MeuDinheiro/
├── README.md
└── project/
    ├── app/
    ├── components/
    ├── hooks/
    ├── lib/
    ├── prisma/
    ├── package.json
    └── prisma.config.ts
```

## Como rodar localmente

Entre na pasta da aplicação:

```bash
cd project
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env.local` com as variáveis necessárias:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/meudinheiro"
AUTH_SECRET="sua_chave_secreta"
AUTH_GOOGLE_ID="seu_google_client_id"
AUTH_GOOGLE_SECRET="seu_google_client_secret"
GEMINI_API_KEY="sua_chave_do_gemini"
```

Sincronize o banco com o schema do Prisma:

```bash
npm run db:push
```

Opcionalmente, rode o seed:

```bash
npm run db:seed
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:3000
```

## Scripts disponíveis

```bash
npm run dev          # inicia o servidor local
npm run build        # gera o Prisma Client e faz o build do Next.js
npm run start        # inicia a aplicação em produção
npm run lint         # executa o ESLint
npm run db:generate  # gera o Prisma Client
npm run db:push      # aplica o schema no banco
npm run db:seed      # popula dados iniciais
```

## Banco de dados

O schema Prisma inclui modelos para:

- Usuários e autenticação.
- Perfil financeiro.
- Grupos de despesa.
- Lançamentos.
- Compras no cartão e dívidas parceladas.
- Rendas extras.
- Alocação mensal para poupança.

## IA financeira

Os insights de IA são gerados com o modelo `gemini-2.5-flash`. Para ativar esse recurso, configure a variável:

```env
GEMINI_API_KEY="sua_chave_do_gemini"
```

Caso a chave não esteja configurada, o app continua funcionando, mas exibirá uma recomendação informando que os insights de IA precisam ser ativados.

## Status

Projeto em desenvolvimento.

