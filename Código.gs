/**
 * Painel Fazenda Reall - servidor do Apps Script
 *
 * doGet         -> entrega a pagina do painel
 * lerDados      -> devolve Lancamentos e Recorrentes para o painel
 * gravarDados   -> reescreve Lancamentos e Recorrentes
 *
 * Nao toca nas abas Painel, Premissas, Custo da Fabrica, Pendencias e Historico.
 * IMPLANTAR COMO: App da Web. Nunca como Biblioteca.
 */

const ID_DA_PLANILHA = '13UrPInC-ND-AXIGoLlgxTxsQeF9XqZ13JigyQjHYJLE';

const ABA_LANC = 'Lancamentos';
const ABA_REC  = 'Recorrentes';
const LINHA_1_LANC = 5;   // primeira linha de dados
const LINHA_1_REC  = 5;

/* ---------- pagina ---------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Painel')
    .setTitle('Fazenda Reall - Painel de Custo da Obra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- chamadas do painel ---------- */

function lerDados() {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  return { lanc: lerLancamentos(ss), rec: lerRecorrentes(ss) };
}

function gravarDados(dados) {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  if (dados.lanc) gravarLancamentos(ss, dados.lanc);
  if (dados.rec)  gravarRecorrentes(ss, dados.rec);
  SpreadsheetApp.flush();
  return Utilities.formatDate(new Date(), 'America/Bahia', 'dd/MM HH:mm');
}

/* ---------- leitura ---------- */

function lerLancamentos(ss) {
  const ab = ss.getSheetByName(ABA_LANC);
  const n = ab.getLastRow() - LINHA_1_LANC + 1;
  if (n < 1) return [];
  // A:ID  B:Data  C:Item  D:Categoria  E:Tipo  F:Valor  G:Obs
  const v = ab.getRange(LINHA_1_LANC, 1, n, 7).getValues();
  const out = [];
  v.forEach(function (r) {
    // ignora a linha de total, que nao tem ID numerico
    if (typeof r[0] !== 'number') return;
    out.push({
      id: r[0],
      data: r[1] instanceof Date ? Utilities.formatDate(r[1], 'America/Bahia', 'yyyy-MM-dd') : '',
      item: String(r[2] || ''),
      cat: String(r[3] || 'A classificar'),
      tipo: String(r[4] || 'Realizado'),
      valor: Number(r[5]) || 0,
      obs: String(r[6] || '')
    });
  });
  return out;
}

function lerRecorrentes(ss) {
  const ab = ss.getSheetByName(ABA_REC);
  const n = ab.getLastRow() - LINHA_1_REC + 1;
  if (n < 1) return [];
  // A:Mes  B:Ano  C:Condominio  D:Mensalidade  E:Agua  F:Luz  G:Total  H:Pago
  const v = ab.getRange(LINHA_1_REC, 1, n, 8).getValues();
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const out = [];
  v.forEach(function (r) {
    if (typeof r[1] !== 'number') return;           // sem ano = nao e linha de dado
    const m = MES.indexOf(String(r[0]).toLowerCase().slice(0, 3));
    if (m < 0) return;
    const mm = ('0' + (m + 1)).slice(-2);
    out.push({
      ym: r[1] + '-' + mm,
      label: MES[m].toUpperCase() + '/' + String(r[1]).slice(2),
      condominio: Number(r[2]) || 0,
      mensalidade: Number(r[3]) || 0,
      embasa: Number(r[4]) || 0,
      coelba: Number(r[5]) || 0,
      pago: String(r[7]).trim().toLowerCase() === 'sim'
    });
  });
  return out;
}

/* ---------- gravacao ---------- */

function gravarLancamentos(ss, lanc) {
  const ab = ss.getSheetByName(ABA_LANC);
  const ultima = ab.getLastRow();

  // preserva a linha de total, que fica logo abaixo dos dados
  const linhasAntigas = Math.max(ultima - LINHA_1_LANC + 1, 0);
  if (linhasAntigas > 0) ab.getRange(LINHA_1_LANC, 1, linhasAntigas, 7).clearContent();

  const linhas = lanc.map(function (e, i) {
    return [
      i + 1,
      e.data ? new Date(e.data + 'T12:00:00') : '',
      e.item || '',
      e.cat || 'A classificar',
      e.tipo || 'Realizado',
      Number(e.valor) || 0,
      e.obs || ''
    ];
  });
  if (linhas.length) ab.getRange(LINHA_1_LANC, 1, linhas.length, 7).setValues(linhas);

  // total com SUBTOTAL, duas linhas abaixo do ultimo lancamento
  const lTot = LINHA_1_LANC + linhas.length;
  ab.getRange(lTot, 3).setValue('TOTAL DOS LANCAMENTOS');
  ab.getRange(lTot, 6).setFormula('=SUBTOTAL(109,F' + LINHA_1_LANC + ':F' + (lTot - 1) + ')');
  ab.getRange(lTot, 6).setNumberFormat('R$ #,##0.00');
}

function gravarRecorrentes(ss, rec) {
  const ab = ss.getSheetByName(ABA_REC);
  const mapa = {};
  rec.forEach(function (x) { mapa[x.ym] = x; });

  const n = ab.getLastRow() - LINHA_1_REC + 1;
  const v = ab.getRange(LINHA_1_REC, 1, n, 8).getValues();
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  for (let i = 0; i < v.length; i++) {
    if (typeof v[i][1] !== 'number') continue;
    const m = MES.indexOf(String(v[i][0]).toLowerCase().slice(0, 3));
    if (m < 0) continue;
    const ym = v[i][1] + '-' + ('0' + (m + 1)).slice(-2);
    const x = mapa[ym];
    if (!x) continue;
    ab.getRange(LINHA_1_REC + i, 3, 1, 4)
      .setValues([[x.condominio || 0, x.mensalidade || 0, x.embasa || 0, x.coelba || 0]]);
    ab.getRange(LINHA_1_REC + i, 8).setValue(x.pago ? 'Sim' : '');
  }
}

/* ---------- teste manual ----------
   Rode testar() no editor do Apps Script para conferir a leitura
   antes de publicar o Web App.                                      */
function testar() {
  const ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  const l = lerLancamentos(ss);
  const r = lerRecorrentes(ss);
  Logger.log('lancamentos: %s | total: %s', l.length,
    l.reduce(function (s, e) { return s + e.valor; }, 0));
  Logger.log('recorrentes: %s | pagos: %s', r.length,
    r.filter(function (x) { return x.pago; }).length);
}

/* ---------- utilitario ---------- */
function urlPlanilha() {
  return SpreadsheetApp.openById(ID_DA_PLANILHA).getUrl();
}
