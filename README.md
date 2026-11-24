# Dicionário Warao ⇄ Português

Protótipo de dicionário Warao–português para usar no celular, inclusive sem internet.
Todas as entradas são **provisórias** até serem conferidas com falantes Warao.

## O que tem

- **374 entradas** com Warao, português, espanhol, categoria, fonte e página.
- Busca nos dois sentidos (Warao → português, português → Warao ou ambos), sem acentos nem maiúsculas.
- A busca também acha as **21 variantes** registradas entre as fontes. Por exemplo, buscar "muabasi" mostra "Mojabasi" (cinco).
- Filtro **Revisar com falante** com as 12 entradas de leitura duvidosa, para conferir em campo.
- **Gravador de pronúncia** em cada entrada. As gravações ficam no aparelho (IndexedDB) até serem exportadas.
- Funciona offline depois da primeira visita (service worker) e pode ser instalado como app na tela inicial.

## Arquivos

| Caminho | Para quê |
|---|---|
| `index.html`, `style.css`, `app.js` | O app |
| `dados/vocabulario.js` | Os dados que o app usa (gerado, não edite à mão) |
| `dados/vocabulario.json` | Os mesmos dados em JSON, para outros usos |
| `audio/` | Gravações aprovadas. `audio/index.json` diz qual arquivo é de qual entrada |
| `sw.js`, `manifest.webmanifest`, `icon*` | Modo offline e instalação |
| `ferramentas/gerar-dados.py` | Regera `dados/` a partir da planilha `vocabulario-warao.csv` |
| `.nojekyll` | Faz o GitHub Pages servir os arquivos como estão |

## Como gravar e guardar áudios

1. Abra uma entrada, toque em **Gravar pronúncia**, grave e pare. Pode anotar quem falou.
2. No rodapé, toque em **Exportar áudios**. Sai um `.zip` com a pasta `audio/`: os arquivos de som, um `index.json` atualizado e um `gravacoes.csv` com quem gravou e quando.
3. Copie o conteúdo do `.zip` por cima da pasta `audio/` do repositório e publique. A partir daí todo mundo que usa o app ouve essas gravações.

Atenção: limpar os dados do navegador apaga as gravações que ainda não foram exportadas. Peça sempre o consentimento de quem for gravado antes de publicar a voz.

## Atualizar os dados

Edite a planilha `vocabulario-warao.csv` e rode, de dentro desta pasta:

```
python3 ferramentas/gerar-dados.py .
```

O script lê a planilha no caminho indicado no começo dele (`SRC`); ajuste se ela estiver em outro lugar.
Depois aumente a versão em `sw.js` (`warao-v2` → `warao-v3`) para os celulares baixarem a versão nova.

## Publicar no GitHub Pages

Coloque o conteúdo desta pasta na raiz de um repositório (ou numa pasta `docs/`) e ative o Pages em
Settings → Pages. Todos os caminhos são relativos, então funciona em `usuario.github.io/nome-do-repo/`.
O gravador e o modo offline só funcionam em `https` (o Pages já é `https`).

## Fontes

- **Glossário Warao**. UNICEF e Aldeias Infantis SOS, Belém e Ananindeua (PA), 2022. 187 entradas.
- **Cartilha de apoio linguístico para interações em saúde**. Universidade Federal do Rio Grande do Norte (UFRN), Natal, 2023. Variante Warao de Mariusa, Delta Amacuro. 187 entradas.

Os direitos sobre o conteúdo são dessas instituições. Este repositório traz só o vocabulário transcrito,
sem os PDFs nem as ilustrações, para uso pessoal e de pesquisa enquanto a autorização é solicitada.
