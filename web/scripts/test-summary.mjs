// Transforma o resultado do Vitest (JSON) em uma tabela no resumo da execução do GitHub Actions.
// Uso: node scripts/test-summary.mjs test-results.json >> "$GITHUB_STEP_SUMMARY"
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const AREAS = {
  'costCalculations.test.js': 'Cálculo de custos e comissão',
  'stockService.test.js': 'Estoque (validade, saldo e baixa)',
  'accessControl.test.js': 'Permissões de cada perfil',
};

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// Com --notice, gera só um aviso curto (avisos aparecem na página da execução até para quem não está logado)
if (process.argv[3] === '--notice') {
  const areas = report.testResults.map((file) => `${AREAS[basename(file.name)] ?? basename(file.name)}: ${file.assertionResults.filter((t) => t.status === 'passed').length}`);
  const ok = report.numPassedTests === report.numTotalTests;
  console.log(`::${ok ? 'notice' : 'error'} title=Testes automáticos::${ok ? '✅' : '❌'} ${report.numPassedTests} de ${report.numTotalTests} testes passaram — ${areas.join(' · ')}`);
  process.exit(0);
}
const icon = (status) => (status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️');

const lines = [
  '## 🧪 Testes automáticos (Vitest)',
  '',
  `**${report.numPassedTests} de ${report.numTotalTests} testes passaram** em ${report.testResults.length} áreas do sistema.`,
  '',
];

for (const file of report.testResults) {
  const name = basename(file.name);
  lines.push(`### ${AREAS[name] ?? name}`, '', '| | Teste |', '|---|---|');
  for (const test of file.assertionResults) {
    const title = [...test.ancestorTitles, test.title].join(' › ');
    lines.push(`| ${icon(test.status)} | ${title} |`);
  }
  lines.push('');
}

console.log(lines.join('\n'));
