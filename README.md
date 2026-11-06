# Caderno · Redação Enem

Biblioteca de estudo em português com redações das cartilhas do Inep, modelos comentados e propostas de treino para a edição de 2026.

- **Acervo oficial.** Cada ficha indica a autoria, o ano, a nota verificada quando disponível e a página do texto integral na cartilha original. As notas de leitura são editoriais.
- **Modelos com IA.** Textos originais para treino com a estrutura de sala de aula, conectivos e repertórios com fontes. O leitor alterna entre texto corrido e estrutura.
- **Temas de treino.** As propostas foram elaboradas a partir de recortes sociais e de um histórico das edições regulares. A análise e as fontes ficam na seção Temas.
- **Minha biblioteca.** Cadastro com nome e senha, marcadores e leituras concluídas. As contas e as marcações ficam em SQLite.

## Executar localmente

Use Node.js 22.15 ou mais recente.

```sh
npm ci
npm run build
npm start
```

Abra `http://127.0.0.1:3764`. Para trabalhar com atualização automática da interface, mantenha `npm start` em um terminal e use `npm run dev` em outro.

O conteúdo do acervo fica em `data/`. As contas e sessões ficam no arquivo `var/caderno.sqlite` por padrão. Em produção, configure `NODE_ENV=production`, `PUBLIC_ORIGIN` com a origem HTTPS e `DB_PATH` para um caminho persistente. Veja [a configuração da VPS](deploy/README.md).

Os ícones Solar são de [480 Design](https://www.figma.com/community/file/1166831539721848736) sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). As fontes Plus Jakarta Sans e Newsreader são distribuídas sob a SIL Open Font License. As licenças acompanham os arquivos servidos em `public/licencas/`.
