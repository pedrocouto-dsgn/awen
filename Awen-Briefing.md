# Briefing: banco de referências pessoal

30 de setembro de 2026 · Pedro

> Nota para agentes de IA (Claude Code, Codex): a seção "Atualizações posteriores ao briefing" no fim deste arquivo prevalece sobre o restante em caso de conflito. O design system vigente está em `awen-DESIGN.md`. Nunca inclua chaves ou senhas no código ou no repositório.

Awen é uma plataforma web privada onde guardas, analisas e reutilizas imagens, vídeos e prompts de IA, pensada para o trabalho de direção criativa e não como um Pinterest com outro nome.

## Decisões fechadas
- **Acesso:** web app privada, só para uso pessoal, acessível de qualquer dispositivo.
- **Conteúdo:** imagens, vídeos e prompts. Música fica de fora por enquanto.
- **Idioma:** interface em português; descrições, tags e análises em inglês.
- **Vocabulário:** listas fixas (tipo de plano, mood, etc.), com possibilidade de acrescentar termos novos.
- **Aprovação:** a IA sugere, tu aprovas ou editas antes de a referência entrar na biblioteca.
- **IA:** Gemini na camada gratuita. Nenhuma referência é confidencial, por isso passar pela camada gratuita não é problema.
- **Vídeos locais:** dimensionar para cerca de 20 GB. YouTube e Vimeo não ocupam espaço, tocam por incorporação.
- **Integrações:** Pinterest e Instagram de forma manual (colar link ou guardar a imagem). Sem ligação automática.
- **Prompts:** sem limite de caracteres em nenhum campo. Prompt e resultado ficam sempre juntos na mesma entrada.
- **Prompt estruturado:** a plataforma não gera prompts. Isso continua a ser feito no Claude, fora daqui.

## Entrada de referências

Todas as vias acabam no mesmo fluxo: a referência entra como pendente, a IA analisa e tu aprovas no card.

| **Via**                        | **Como funciona**                                                                               | **Fase** |
|--------------------------------|-------------------------------------------------------------------------------------------------|----------|
| Upload e drag and drop         | Arrastar ficheiros para a página, vários de uma vez                                             | 1        |
| Colar da área de transferência | Ctrl+V com uma imagem copiada                                                                   | 1        |
| Colar link                     | YouTube, Vimeo, Pinterest, Instagram e sites. Puxa miniatura e metadados automaticamente        | 1        |
| Extensão de Chrome             | Botão direito numa imagem ou vídeo, "Salvar no banco". Com opção de enviar para o projeto ativo | 2        |
| Importação em lote             | Enviar centenas de ficheiros de uma vez, para as 500+ referências existentes                    | 3        |
| Autosync de pasta              | Script que vigia uma pasta no computador e envia o que cair lá                                  | 3        |

**Extensão de Chrome.** Não é complexa na versão básica: envia a imagem ou o link para a API da plataforma com um token pessoal. Instala-se direto no Chrome em modo desenvolvedor, sem passar pela Chrome Web Store.

**Play de vídeo.** Links do YouTube e Vimeo tocam dentro do card por incorporação, com clique na miniatura para iniciar. Vídeos do computador são hospedados e tocam no próprio player. Instagram e Pinterest têm player incorporado instável, por isso nesses casos guarda-se o ficheiro por upload ou a miniatura com o link de origem.

## Card de análise

Cada referência gera um card com três tipos de dados. Tu revês o card e aprovas, editas ou rejeitas; só depois a referência entra na biblioteca.

| **Origem**                   | **Dados**                                                                                                                                                                                                                       |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Automático (código)          | Dimensões, proporção, formato, peso, duração e fps (vídeo), link de origem, data de entrada, paleta de 5 a 6 cores com hex e percentagem, impressão digital para detetar duplicados                                             |
| IA (sugestão para aprovares) | Tipo de plano, ângulo, movimento de câmara (vídeo), iluminação, mood, estilo de direção visual, textura e grão, cenário, época, sujeito, descrição em texto, tags sugeridas, diretor ou artista provável com nível de confiança |
| Tu                           | Notas, diretor, fotógrafo ou artista confirmado, projeto, avaliação, tipo de uso (personagem, location, prop, estilo, shot)                                                                                                     |

A paleta é calculada por código e não pela IA, porque assim é exata e não gasta tokens. A lente fica de fora, por ser subjetiva e difícil de ver na imagem. A atribuição a um artista famoso aparece sempre como sugestão, porque a IA erra e tu confirmas.

**Fila de revisão.** Uma vista própria mostra um card de cada vez, com aprovar, editar ou rejeitar por atalho de teclado, para 500 itens não virarem uma tarefa pesada.

**Vocabulário inicial (lista fixa, editável).**

| **Campo**           | **Valores**                                                                                                                                                        |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tipo de plano       | extreme close-up, close-up, medium close-up, medium, medium wide, wide, extreme wide, insert, over-the-shoulder, POV, top shot, low angle, high angle, dutch angle |
| Movimento de câmara | static, handheld, dolly in, dolly out, tracking, pan, tilt, crane, drone, orbit, whip pan, zoom, steadicam                                                         |
| Iluminação          | hard light, soft light, backlight, rim light, low key, high key, golden hour, blue hour, neon, practical, silhouette                                               |
| Mood                | melancholic, tense, serene, epic, intimate, eerie, nostalgic, energetic, raw, dreamlike, cold, warm                                                                |

Estas listas são um ponto de partida para ajustares na primeira utilização.

## Busca, filtros e organização
- **Busca por linguagem natural:** "hard light, desert, feeling of isolation" encontra a referência mesmo sem essa tag. Inclui também as tuas notas.
- **Busca por imagem parecida:** arrastas uma referência e aparecem as mais próximas do banco.
- **Busca por cor:** escolhes uma cor e aparecem as referências com essa paleta.
- **Filtros combináveis:** tipo de plano, mood, iluminação, proporção, pessoa, projeto, imagem ou vídeo, fonte, data e avaliação.
- **Pessoas:** diretores, fotógrafos e artistas são uma entidade própria, não só uma tag. Escreves o nome uma vez, ficam com autocomplete e cada pessoa tem uma página com todas as suas referências.
- **Coleções:** a mesma referência pode estar em vários projetos ao mesmo tempo.
- **Tags:** sugeridas pela IA a partir do vocabulário fixo e aprovadas por ti.

## Projetos, moodboards e anotações
- **Projeto:** cada trabalho tem o seu board. É usado no início do projeto e também a meio, quando surgem ideias novas para shots.
- **Projeto ativo:** fixas um projeto como ativo e tudo o que guardares pela extensão vai direto para ele.
- **Moodboard:** canvas livre para arrastar, redimensionar e legendar imagens, com layouts em grelha. Exporta a imagem completa do moodboard (PNG e PDF) e também as imagens separadas, cada uma no tamanho original.
- **Anotações por referência:** campo de notas livre em cada item, pesquisável.
- **Anotações sobre a imagem:** marcas uma zona e escreves "quero esta luz" ou "só o movimento de câmara", porque uma referência raramente serve inteira.
- **Notas em vídeo:** guardas um trecho (por exemplo 0:12 a 0:19) ou um frame, com nota, sem guardar o vídeo inteiro.

## Biblioteca de prompts

Uma aba própria, ao lado das referências. Cada entrada é um par: o texto do prompt e o resultado que ele gerou (imagem ou vídeo), sempre juntos. Serve para replicar mais tarde um tipo de vídeo ou imagem que já funcionou, seja teu ou de terceiros.

| **Campo**           | **Detalhe**                                                                                                                                       |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Prompt              | Texto completo, com botão de copiar e contador de caracteres. Sem limite de tamanho: pode ter 100 ou 30 mil caracteres                            |
| Resultado           | Imagem ou vídeo gerado, obrigatório. Mais as imagens ou vídeos de entrada usados (first frame, referências)                                       |
| Ferramenta e modelo | Lista editável. Inicial, imagem: Nano Banana, GPT Image, Seedream. Vídeo: Kling, Seedance, Google Omni. Plataformas: Magnific, Runway, Higgsfield |
| Tipo                | text-to-video, image-to-video, imagem, edição                                                                                                     |
| Parâmetros          | Proporção, duração, resolução, seed (todos opcionais)                                                                                             |
| Origem              | Teu ou de terceiros, com autor e link                                                                                                             |
| Estado              | Funcionou, funcionou em parte, falhou                                                                                                             |
| Notas               | O que funcionou e o que ajustar                                                                                                                   |
| Tags                | Do vocabulário fixo, sugeridas pela IA e aprovadas por ti                                                                                         |

**Como entram os prompts**
- **Teus:** colas o prompt e anexas o resultado.
- **De terceiros:** colas o link da página ou fazes upload manual do texto e do resultado. Na Fase 2 a extensão de Chrome guarda prompt e resultado de uma só vez.

**Funcionalidades**
- **Ligação com as referências:** um prompt aponta para as referências que o inspiraram, e na página de uma referência vês os prompts que já a recriaram.
- **Versões:** cada prompt pode ter versões (v2, v3) com nota do que mudou, e comparação lado a lado.
- **Blocos reutilizáveis:** guardas pedaços como iluminação, sistema de câmara ou materiais e reaproveitas em vários prompts.
- **Modelos com variáveis:** um prompt com campos como {subject} e {location}, para reutilizar a estrutura trocando só o conteúdo.
- **Análise por IA:** lê o resultado, sugere tags e separa o texto do prompt em secções (câmara, luz, estilo, áudio) para pesquisares por elas. A IA só organiza e etiqueta, não escreve prompts.
- **Busca e filtros:** por linguagem natural, ferramenta, tipo, estado, projeto e tag.
- **Uso em projetos:** cada prompt fica ligado aos projetos em que foi usado.

## Extras
- **Modo aleatório:** abre 6 referências ao acaso para desbloquear ideias, com filtro opcional (uma tag, um diretor).
- **Cópia local:** cada referência guarda uma cópia da imagem além do link, porque links do Pinterest e do Instagram morrem.
- **Duplicados:** deteção na importação em lote.
- **Comparar:** duas referências lado a lado.
- **Usada em:** regista em que projetos cada referência já foi usada.
- **Análise de lacunas:** "tens muitos close-ups e nenhum plano geral" num board.
- **Paleta do projeto:** paleta média do board e aviso quando uma referência nova destoa.
- **Reanálise em lote:** quando surgir um modelo melhor, reanalisas o banco todo.
- **Exportação total:** dados e ficheiros, para o banco nunca ficar preso à plataforma.
- **Ritmo do vídeo** (número de cortes, duração média do plano): exige processamento pesado que não cabe na Vercel gratuita. Fica para o fim, como serviço à parte.

## Canvas infinito (versão futura)

Um espaço livre, no espírito do Figma mas sem as ferramentas de edição, só para organizar referências à tua maneira.
- **Campo infinito:** zoom e deslocamento livres, com as imagens e vídeos colocados exatamente onde quiseres.
- **Notas soltas:** caixas de texto em qualquer posição, para apontamentos e títulos.
- **Personalização:** tamanho, agrupamento e ordem de cada elemento à tua escolha.
- **Drag and drop do computador:** arrastas um ficheiro para o canvas e ele aparece logo no sítio onde o largaste.
- **Entrada na fila de pendentes:** o ficheiro largado no canvas é guardado e analisado em segundo plano. Os dados dele (plano, mood, paleta, etc.) esperam aprovação na aba de pendentes, separada do canvas, para não interromper o teu fluxo de trabalho.
- **Ligação com a biblioteca:** os itens do canvas podem vir da biblioteca ou ser novos; depois de aprovados, passam a fazer parte dela.

Não entra na Fase 1 nem na Fase 2. A estrutura de dados dos moodboards deve guardar posição e tamanho de cada item desde já, para o canvas poder reaproveitar.

## Stack e arquitetura

| **Camada**                     | **Escolha**                                               | **Nota**                                                                                                                                 |
|--------------------------------|-----------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Front-end e API                | Next.js, TypeScript, Tailwind, na Vercel (plano gratuito) | Interface minimalista tipo galeria, com as imagens como protagonistas                                                                    |
| Base de dados e login          | Supabase (Postgres com pgvector)                          | Login só para ti, dados privados. pgvector guarda os embeddings da busca semântica                                                       |
| Ficheiros                      | Cloudflare R2                                             | 10 GB gratuitos e custo baixo acima disso, sem custo de saída. O Supabase gratuito tem só 1 GB e limite por ficheiro, pequeno para vídeo |
| IA                             | API do Gemini                                             | Visão para análise de imagem e vídeo, e embeddings para busca. Camada gratuita                                                           |
| Extensão                       | Chrome Manifest V3                                        | Instalada em modo desenvolvedor                                                                                                          |
| Processamento em segundo plano | Fila de tarefas                                           | A Vercel gratuita limita tempo de execução, por isso a análise corre em fila e os uploads vão direto para o armazenamento                |

**Regras de desenho**
- A paleta e as dimensões são calculadas por código, não pela IA.
- Nos vídeos enviados, o navegador extrai alguns frames e só esses vão para a IA.
- A grelha usa miniaturas e previews leves; o ficheiro original só carrega no play.
- Os limites e preços dos planos gratuitos mudam, por isso confirmam-se antes de fechar a arquitetura.

## Fases de desenvolvimento

| **Fase**                    | **Conteúdo**                                                                                                                                                                                                                                |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. MVP                     | Login, upload, drag and drop, colar imagem e link, dados técnicos e paleta, card de IA com fila de aprovação, biblioteca com filtros, pessoas, notas, projetos, play de vídeo (YouTube e upload). Estrutura de dados dos prompts já pensada |
| 2\. Ferramentas de trabalho | Extensão de Chrome, projeto ativo, moodboard com exportação (imagem completa e imagens separadas), busca semântica e por imagem parecida, modo aleatório, anotações sobre a imagem, biblioteca de prompts completa                          |
| 3\. Escala e extras         | Importação em lote das 500+ referências, autosync de pasta, frames e trechos de vídeo, duplicados, análise de lacunas, exportação total, canvas infinito (versão futura)                                                                    |

## Riscos e pontos a confirmar
- **Instagram:** vídeos do Instagram muitas vezes não podem ser capturados pela extensão nem incorporados. Nesses casos: upload do ficheiro ou link com miniatura.
- **Pinterest e Instagram:** não há API para puxar os teus pins e salvos de forma livre. A importação inicial é manual ou em lote.
- **Limites gratuitos:** Gemini, Supabase, Vercel e Cloudflare R2 mudam limites e preços. Confirmar antes de começar a Fase 1.
- **Atribuição de artistas:** a IA erra autoria de estilos famosos. Por isso é sempre sugestão com confiança e nunca dado final.
- **Volume real do banco:** a estimativa é de mais de 500 referências, sem número exato. O número real define o custo da importação em lote e da análise.
- **Interface:** ainda sem referências visuais. Procurar algumas galerias minimalistas antes de desenhar as telas.

# Atualizações posteriores ao briefing (30/09/2026)

Decisões tomadas depois da versão acima. Onde houver conflito, valem estas.

## Design system
- O design system vigente é o arquivo awen-DESIGN.md, que junta duas paletas com funções separadas: grafite para a estrutura (#111111, \#3A3A3A, \#4D4D4D, \#B7BABB, \#B4C7CC) e azul para a atmosfera e a ação (#1E3A52, \#4B708D, \#8EB0C9, \#CADCEA).
- Botão primário em Frost \#CADCEA com texto \#111111. Cantos retos, tipografia Inter, mídia sempre em destaque.
- Gradientes são a assinatura visual (8 tokens: canvas, glow, card, dusk, accent, steel, scrim, hairline), no máximo dois proeminentes por tela. A referência Ferrari foi abandonada.

## Infraestrutura
- **Supabase:** projeto na região eu-west-1 (Irlanda). Data API ligada, auto-exposição de tabelas nova desligada, RLS automático ligado. Cada tabela precisa de RLS e GRANT só para o papel authenticated, com policies owner_id = auth.uid(). Migrações em /supabase/migrations, aplicadas manualmente. Chaves novas: publishable (cliente) e secret (só servidor).
- **Vercel:** região das funções dub1 (Dublin).
- **Cloudflare R2:** bucket privado awen-references, uploads diretos do navegador por URL pré-assinada, com CORS para localhost:3000 e awen.vercel.app.
- **Segredos:** ficam só no .env.local (nunca no GitHub; .gitignore com .env\*) e nas variáveis de ambiente da Vercel.

## IA
- O Gemini apresentou erro de pagamento. Causas prováveis: GEMINI_MODEL vazio e chave de projeto com faturamento ligado. Correção: chave criada no Google AI Studio em projeto novo e modelo com plano gratuito (gemini-3.1-flash-lite).
- Custo estimado se um dia for pago: cerca de US\$ 0,002 por imagem e US\$ 0,003 por vídeo de 30 s (estimativas com base nos preços publicados).
- A análise passa por um adaptador de provedor (AI_PROVIDER, AI_MODEL, AI_API_KEY) com o mesmo JSON de saída, para trocar de provedor só por configuração. Alternativas avaliadas: Qwen-VL via OpenRouter; DeepSeek não lê imagem; Kimi não tem plano gratuito (recarga mínima de US\$ 1).

## Ordem de construção
- Primeiro as fundações com o Claude Code: login mínimo, migrações, upload para o R2, paleta e dados técnicos, fila de análise.
- Depois o layout do Claude Design (exportar como project archive para a pasta design/, refeito com o novo design system), e só então as telas.
