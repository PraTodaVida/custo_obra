# Painel Fazenda Reall — Custo da Obra

Web App em Google Apps Script que lê e grava uma planilha do Google Sheets com os custos da obra. A interface roda no navegador, os dados ficam na planilha.

> **Repositório privado.** O código contém o ID da planilha em texto puro e a base de lançamentos embutida no HTML (datas, itens e valores reais). Não tornar público sem antes remover os dois. Ver [Segurança](#segurança).

---

## Estrutura

| Arquivo | Nome no Apps Script | Função |
|---|---|---|
| `src/Codigo.gs` | `Codigo` | Servidor: `doGet`, leitura e gravação da planilha |
| `src/Painel.html` | `Painel` | Interface completa (HTML + CSS + JS em arquivo único) |
| `src/appsscript.json` | manifesto | Fuso, runtime V8 e configuração do Web App |
| `.clasp.json.example` | — | Modelo de configuração local do clasp |

O nome do arquivo HTML precisa ser exatamente `Painel` dentro do Apps Script — é o que `doGet` chama em `createHtmlOutputFromFile('Painel')`.

---

## Como funciona

```
Navegador (Painel.html)
   │  google.script.run
   ├── lerDados()      → { lanc: [...], rec: [...] }
   ├── gravarDados({lanc, rec}) → "dd/MM HH:mm"
   └── urlPlanilha()   → URL da planilha
        │
        ▼
Google Sheets (ID fixo em Codigo.gs)
```

O painel abre com os dados embutidos em `const D` (render instantâneo) e logo em seguida substitui tudo pelo que vem da planilha. Se a leitura falhar, ele continua exibindo os dados locais e sinaliza o erro no indicador de sincronia.

Gravação: manual pelo botão **Salvar**, ou automática a cada **120 segundos** enquanto houver alteração pendente.

---

## Planilha esperada

Só duas abas são lidas ou escritas. As abas `Painel`, `Premissas`, `Custo da Fabrica`, `Pendencias` e `Historico` não são tocadas pelo script.

### Aba `Lancamentos` — dados a partir da **linha 5**

| Coluna | Campo | Observação |
|---|---|---|
| A | ID | Numérico. Linhas sem número são ignoradas na leitura |
| B | Data | Data real (não texto) |
| C | Item | |
| D | Categoria | Padrão: `A classificar` |
| E | Tipo | Padrão: `Realizado` |
| F | Valor | Numérico |
| G | Obs | |

Após o último lançamento o script escreve a linha de total: `TOTAL DOS LANCAMENTOS` em C e `=SUBTOTAL(109;F5:F<última>)` em F.

### Aba `Recorrentes` — dados a partir da **linha 5**

| Coluna | Campo | Escrita pelo painel |
|---|---|---|
| A | Mês (`jan`…`dez`) | Não — é a chave |
| B | Ano | Não — é a chave |
| C | Condomínio | Sim |
| D | Mensalidade | Sim |
| E | Água | Sim |
| F | Luz | Sim |
| G | Total | Não — preserva a fórmula existente |
| H | Pago | Sim (`Sim` ou vazio) |

As linhas de `Recorrentes` são atualizadas no lugar, casadas por mês+ano. O painel não cria nem remove linhas nessa aba.

Categorias reconhecidas pelo painel: `Material`, `Mão de obra`, `Frete/Carreto`, `Taxas/Projeto`, `Alimentação`, `Serviços`, `A classificar`.

---

## Implantação

### Opção A — direto no editor do Apps Script

1. Abrir o projeto no [script.google.com](https://script.google.com).
2. Colar o conteúdo de `src/Codigo.gs` no arquivo `Codigo` e o de `src/Painel.html` no arquivo `Painel`.
3. Conferir `ID_DA_PLANILHA` no topo do `Codigo.gs`.
4. Rodar a função `testar()` e checar o log — ela mostra a contagem de lançamentos e recorrentes lidos, sem gravar nada.
5. **Implantar → Nova implantação → App da Web.** Nunca como Biblioteca.

### Opção B — via clasp (linha de comando)

```bash
npm install -g @google/clasp
clasp login

cp .clasp.json.example .clasp.json
# preencher o scriptId (está na URL do projeto: /projects/<scriptId>/edit)

clasp pull          # traz o estado real do projeto ANTES de qualquer push
git diff            # conferir o que mudou em relação ao repositório
clasp push          # envia o que está em src/
clasp deploy        # nova versão do Web App
```

> **Atenção ao `clasp push`:** ele sobrescreve o manifesto `appsscript.json` do projeto no Google. O manifesto deste repositório está com `"access": "MYSELF"` por precaução. Se o painel hoje é acessado por outras pessoas, rode `clasp pull` primeiro para trazer a configuração real e commite ela — senão o push derruba o acesso dos demais.

---

## Pontos de atenção conhecidos

Levantados na leitura do código. Nenhum é bug ativo, mas todos afetam a operação:

1. **IDs não são estáveis.** `gravarLancamentos` limpa o bloco inteiro e reescreve os IDs sequencialmente (`i + 1`) a cada gravação. Um lançamento excluído renumera todos os seguintes — não use o ID como referência externa.
2. **Gravação é destrutiva.** O bloco de dados é apagado antes de ser reescrito. Se o painel enviar uma lista vazia por qualquer motivo, a aba é zerada. Não existe backup automático — o histórico de versões do Sheets é o único recurso de recuperação.
3. **Autosave sem confirmação.** A cada 120 segundos, qualquer alteração pendente vai para a planilha sem perguntar.
4. **Linhas iniciais fixas.** `LINHA_1_LANC` e `LINHA_1_REC` estão fixados em 5. Inserir ou remover linhas de cabeçalho quebra a leitura e a gravação.
5. **Premissas duplicadas no front.** `PREM` (venda, comissão, parcela, nº de parcelas, condomínio) e `LIM_PAGO` estão fixos no `Painel.html` e **não** são lidos da aba `Premissas`. Mudar a premissa na planilha não muda o painel — é preciso editar o HTML e reimplantar.
6. **`LIM_PAGO` define o que conta como pago** quando a coluna H está vazia: todo mês menor ou igual a `2026-03` é assumido como pago.

---

## Segurança

| Item | Onde | Situação |
|---|---|---|
| ID da planilha | `src/Codigo.gs`, linha 12 | Em texto puro |
| Base de lançamentos reais | `src/Painel.html`, `const D` | Embutida no código |

Enquanto esses dois pontos existirem, o repositório precisa permanecer **privado**. Para poder abri-lo depois:

- mover o ID para `PropertiesService.getScriptProperties()` e ler em runtime;
- substituir o conteúdo de `const D` por uma amostra fictícia (o painel funciona igual — os dados reais vêm da planilha na carga).

Todo número exibido pelo painel é insumo para conferência, não fechamento contábil.
