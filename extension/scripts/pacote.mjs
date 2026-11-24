// Gera advox-whatsapp-<versão>.zip a partir de dist/ para instalar no Chrome e
// publica uma cópia em ../public/ (o Painel AdvoxChat → Instalar baixa dali).
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const { version } = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const nome = `advox-whatsapp-${version}.zip`;
execSync(`rm -f ${nome} && cd dist && zip -qr ../${nome} .`);
copyFileSync(nome, '../public/advox-whatsapp.zip');
writeFileSync('../public/advox-whatsapp.json', JSON.stringify({ versao: version }) + '\n');
console.log(`pacote: extension/${nome} (cópia em public/advox-whatsapp.zip)`);
