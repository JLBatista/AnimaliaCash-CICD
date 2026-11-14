// Resume a cobertura de testes (coverage/coverage-summary.json, gerado pelo Vitest).
// Mostra o total do site e, separado, as regras de negócio, para o número não enganar.
// Uso:  node scripts/coverage-summary.mjs coverage/coverage-summary.json            -> tabela (resumo da execução)
//       node scripts/coverage-summary.mjs coverage/coverage-summary.json --notice   -> aviso curto
import { readFileSync } from 'node:fs';

const summary = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const files = Object.entries(summary).filter(([name]) => name !== 'total');

// Áreas do sistema, pela pasta do arquivo
const AREAS = [
  { name: 'Regras de negócio (cálculos e permissões)', match: '/src/utils/' },
  { name: 'Serviços (estoque e sincronização)', match: '/src/services/' },
  { name: 'Telas e componentes (React)', match: ['/src/pages/', '/src/components/', '/src/App.jsx'] },
  { name: 'Dados e estado da aplicação', match: ['/src/store/', '/src/data/', '/src/supabase.js'] },
];

const normalize = (path) => path.replace(/\\/g, '/');
const inArea = (path, match) => [].concat(match).some((m) => normalize(path).includes(m));

function percent(entries) {
  const total = entries.reduce((sum, [, data]) => sum + data.lines.total, 0);
  const covered = entries.reduce((sum, [, data]) => sum + data.lines.covered, 0);
  return { covered, total, pct: total ? Math.round((covered / total) * 1000) / 10 : 0 };
}

const overall = { pct: summary.total.lines.pct, covered: summary.total.lines.covered, total: summary.total.lines.total };
const areas = AREAS.map((area) => ({ ...area, ...percent(files.filter(([name]) => inArea(name, area.match))) }));
const rules = areas[0];

if (process.argv[3] === '--notice') {
  console.log(`::notice title=Cobertura de testes::📊 Regras de negócio: ${rules.pct}% das linhas · Site inteiro: ${overall.pct}% (as telas ainda não têm testes automáticos)`);
  process.exit(0);
}

const bar = (pct) => '🟩'.repeat(Math.round(pct / 10)) + '⬜'.repeat(10 - Math.round(pct / 10));
const lines = [
  '## 📊 Cobertura de testes',
  '',
  'Quanto do código é executado pelos testes automáticos (medido por linhas).',
  '',
  '| Área | Cobertura | Linhas testadas |',
  '|---|---|---|',
  ...areas.map((area) => `| ${area.name} | ${bar(area.pct)} **${area.pct}%** | ${area.covered} de ${area.total} |`),
  `| **Site inteiro** | ${bar(overall.pct)} **${overall.pct}%** | ${overall.covered} de ${overall.total} |`,
  '',
  '> Os testes atuais são **unitários**: conferem as regras de negócio isoladas. As telas ainda não têm testes automáticos, por isso o total do site é menor.',
  '',
];
console.log(lines.join('\n'));
