const metric = (id, name, meaning, calculation, options = {}) => ({
  id,
  name,
  meaning,
  calculation,
  status: options.status || "active",
  example: options.example || "",
});

const page = (id, title, intro, metrics) => ({ id, title, intro, metrics });

export const METRICS_DOCUMENTATION = [
  page("visao-geral", "Visão Geral", "Mostra uma fotografia rápida dos clientes e dos recursos mais usados.", [
    metric("clientes-cadastrados", "Clientes cadastrados", "Clientes que realmente fazem parte da base usada pelo dashboard.", "Pegamos os usuários do App Pharus e retiramos contas internas, contas de demonstração e usuários excluídos."),
    metric("onboarding-concluido", "Onboarding concluído", "Clientes que terminaram o onboarding do App.", "Conta cada cliente que chegou à etapa final do onboarding e possui uma data de conclusão."),
    metric("jornada-completa", "Jornada completa", "Clientes que chegaram à Central de Inteligência.", "Conta cada cliente que alcançou a etapa Central de Inteligência. Ela acontece depois do onboarding."),
    metric("com-open-finance", "Com Open Finance", "Clientes com uma conexão Open Finance válida.", "Conta clientes cuja conexão está marcada como Open Finance e foi atualizada corretamente."),
    metric("com-mecanismos", "Com mecanismos", "Clientes que já têm pelo menos um mecanismo implementado.", "Conta o cliente uma única vez quando ele possui um ou mais mecanismos com o status usado pelo Pharus para implementação."),
    metric("com-patrimonio", "Com patrimônio cadastrado", "Clientes que cadastraram algum investimento ou bem.", "Conta o cliente quando existe pelo menos um ativo cadastrado. Dívidas e financiamentos não entram como patrimônio positivo."),
    metric("com-formulario", "Com formulário respondido", "Clientes que terminaram pelo menos um formulário.", "Conta cada cliente que possui ao menos uma resposta enviada."),
    metric("com-reunioes", "Com reuniões", "Clientes que participaram de pelo menos uma reunião concluída.", "Conta cada cliente uma única vez quando existe ao menos uma reunião realizada."),
    metric("cobertura-recursos", "Cobertura por recurso", "Mostra qual parte da base já usa cada recurso.", "Divide a quantidade de clientes com o recurso pelo total de clientes oficiais."),
    metric("funil-resumido", "Funil resumido", "Mostra quantos clientes chegaram a cada grande etapa da jornada.", "Conta os clientes que concluíram ou alcançaram cada etapa. As barras usam a base oficial como referência."),
    metric("distribuicao-atual", "Distribuição atual da jornada", "Mostra onde os clientes estão agora.", "Agrupa os clientes pelo estágio atual informado pelo App."),
    metric("parados-30", "Clientes parados há mais de 30 dias", "Clientes que ainda não chegaram ao fim da jornada e estão sem avanço recente.", "Conta quem não avançou nos últimos 30 dias ou nunca teve um avanço concluído."),
    metric("sem-open-finance", "Sem Open Finance", "Clientes que ainda não possuem uma conexão Open Finance válida.", "Pega o total de clientes e tira os clientes com Open Finance válido."),
    metric("sem-mecanismos", "Sem mecanismos", "Clientes que ainda não possuem mecanismos implementados.", "Pega o total de clientes e tira os clientes que já têm mecanismos."),
  ]),

  page("clientes", "Clientes", "Explica quem está na base e quais informações já existem para cada cliente.", [
    metric("total-clientes", "Total de clientes", "Quantidade de clientes dentro do recorte escolhido.", "Começa com os clientes oficiais e aplica a busca e os filtros selecionados."),
    metric("situacao-uso", "Situação de uso no App", "Indicaria se o cliente está ativo ou inativo no aplicativo.", "Regra ainda em definição. Ainda não existe uma regra comprovada para dizer que um cliente está ativo no App.", { status: "pending" }),
    metric("novos-periodo", "Novos no período", "Clientes cadastrados durante o período escolhido.", "Conta os clientes cuja data de cadastro está dentro das datas selecionadas."),
    metric("onboarding-clientes", "Onboarding concluído", "Clientes do recorte que terminaram o onboarding.", "Conta os clientes com a etapa final do onboarding concluída."),
    metric("dados-pessoais", "Dados pessoais concluídos", "Clientes que terminaram a primeira etapa de dados pessoais.", "Conta os clientes que concluíram a etapa Dados pessoais."),
    metric("sem-atividade", "Sem atividade operacional recente", "Clientes sem movimentação recente nas áreas acompanhadas.", "Olha avanços da jornada, formulários, reuniões e mecanismos. Conta quem não possui atividade ou cuja última atividade ocorreu há mais de 30 dias."),
    metric("segmentos-tier", "Clientes por segmento", "Distribui os clientes em grupos de perfil financeiro.", "Usa renda, reserva e aporte informados. Tier 1 atende a pelo menos um critério alto. Os demais grupos usam faixas de renda. Sem dados suficientes aparece separado."),
    metric("dividas-segmentacao", "Dívidas na segmentação", "Mostraria se as dívidas mudam o segmento do cliente.", "Regra ainda em definição. O dashboard não usa dívidas para mudar o Tier enquanto essa regra não for aprovada.", { status: "pending" }),
  ]),

  page("patrimonio", "Patrimônio", "Resume os ativos e as dívidas cadastrados pelos clientes.", [
    metric("patrimonio-bruto", "Patrimônio bruto", "Soma de todos os investimentos e bens cadastrados.", "Soma ações, renda fixa, fundos, previdência, outros investimentos, imóveis, bens móveis e consórcios."),
    metric("passivos", "Passivos", "Total das dívidas e dos saldos devedores cadastrados.", "Soma financiamentos e empréstimos."),
    metric("patrimonio-liquido", "Patrimônio líquido", "Valor que sobra depois de descontar as dívidas.", "Patrimônio bruto menos passivos.", { example: "Se os ativos somam R$ 500 mil e as dívidas somam R$ 100 mil, o patrimônio líquido é R$ 400 mil." }),
    metric("clientes-patrimonio", "Clientes com patrimônio", "Clientes que cadastraram pelo menos um ativo.", "Conta cada cliente uma vez quando ele possui investimento ou bem. Ter somente uma dívida não entra nessa conta."),
    metric("patrimonio-mediano", "Patrimônio mediano", "O valor central entre os patrimônios dos clientes.", "Ordena os patrimônios do menor para o maior e escolhe o valor do meio. Isso reduz o peso de patrimônios muito altos."),
    metric("composicao-ativos", "Composição dos ativos", "Mostra quanto cada tipo de ativo representa no total.", "Soma os valores de cada classe e compara com o patrimônio bruto."),
    metric("passivos-classe", "Passivos por classe", "Mostra como as dívidas estão divididas.", "Agrupa e soma separadamente financiamentos e empréstimos."),
    metric("completude-financeira", "Completude de dados financeiros", "Mostra se o cliente possui uma visão financeira mais completa.", "Completo significa ter ativos, dívidas e Open Finance. Incompleto significa ter pelo menos um desses itens. Sem dados significa não ter nenhum."),
  ]),

  page("open-finance", "Open Finance", "Mostra as conexões bancárias que foram registradas pelo App.", [
    metric("clientes-conectados", "Clientes conectados", "Clientes com pelo menos uma conexão Open Finance válida.", "Conta cada cliente uma única vez quando existe uma conexão Open Finance atualizada corretamente."),
    metric("conexoes-validas", "Conexões válidas", "Quantidade de conexões que passaram pela regra de validade.", "Conta todas as conexões marcadas como Open Finance e atualizadas corretamente. Um cliente pode ter mais de uma."),
    metric("contas-conectadas", "Contas conectadas", "Quantidade de contas bancárias dos clientes conectados.", "Conta cada registro de conta pertencente a um cliente com conexão válida, sem repetir a mesma conta por causa de várias conexões."),
    metric("media-contas-cliente", "Média de contas por cliente", "Quantidade média de contas entre os clientes com Open Finance válido.", "Deduplica as contas conectadas, divide o total pelo número de clientes conectados e arredonda somente o valor exibido no card.", { example: "898 contas divididas por 131 clientes resultam em 6,85. O KPI exibe 7." }),
    metric("cobertura-open-finance", "Cobertura", "Percentual de clientes com Open Finance válido.", "Divide os clientes conectados pelo total de clientes do recorte."),
    metric("conexoes-erro", "Com erro", "Conexões que retornaram algum problema.", "Conta conexões marcadas com erro ou que possuem um código de erro."),
    metric("novas-conexoes", "Novas conexões válidas", "Mostra quantas conexões válidas foram criadas em cada mês.", "Agrupa as conexões válidas pelo mês em que foram registradas."),
    metric("status-conexoes", "Status das conexões", "Mostra como as conexões estão distribuídas por resultado.", "Agrupa as conexões pelo resultado ou status informado."),
    metric("instituicoes-conectadas", "Instituições conectadas", "Mostra quais bancos e instituições aparecem nas conexões válidas.", "Agrupa as conexões válidas pelo nome da instituição."),
    metric("contas-tipo", "Contas por tipo", "Mostra os tipos de conta encontrados.", "Agrupa as contas dos clientes conectados por tipo, como conta-corrente ou investimento."),
  ]),

  page("mecanismos", "Mecanismos", "Mostra quais mecanismos já foram implementados para os clientes.", [
    metric("clientes-mecanismos", "Clientes com mecanismos", "Clientes que possuem pelo menos um mecanismo implementado.", "No Pharus, o status “suggested” representa um mecanismo implementado. Cada cliente entra apenas uma vez."),
    metric("implementacoes", "Implementações", "Quantidade total de mecanismos implementados.", "Conta as combinações de cliente e mecanismo dentro do recorte."),
    metric("cobertura-mecanismos", "Cobertura de clientes", "Percentual de clientes que já possuem mecanismos.", "Divide os clientes com mecanismos pelo total de clientes do recorte."),
    metric("mecanismos-disponiveis", "Mecanismos disponíveis", "Quantidade de opções existentes no catálogo do App.", "Conta os mecanismos cadastrados no catálogo atual."),
    metric("media-mecanismos", "Média de mecanismos por cliente", "Quantidade média de mecanismos entre os clientes que já possuem algum.", "Divide o total de implementações pelo número de clientes com mecanismos e mostra o resultado arredondado."),
    metric("clientes-sem-mecanismos", "Clientes sem mecanismos", "Clientes que ainda não possuem mecanismos implementados.", "Pega o total de clientes do recorte e tira os clientes com mecanismos."),
    metric("ultimo-mecanismo", "Último implementado", "Data da implementação mais recente.", "Procura a data mais nova entre as implementações do recorte."),
    metric("mais-implementados", "Mecanismos mais implementados", "Ranking dos mecanismos usados mais vezes.", "Agrupa as implementações por mecanismo e ordena da maior quantidade para a menor."),
    metric("mecanismos-categoria", "Implementação por categoria", "Mostra em quais grupos os mecanismos se concentram.", "Agrupa as implementações pela categoria do mecanismo."),
    metric("evolucao-mecanismos", "Evolução mensal", "Mostra quantas implementações aconteceram em cada mês.", "Agrupa as implementações pela data em que foram registradas."),
    metric("quantidade-cliente", "Quantidade por cliente", "Mostra quantos clientes possuem zero, um ou vários mecanismos.", "Conta quantos mecanismos cada cliente possui e depois agrupa clientes com a mesma quantidade."),
  ]),

  page("reunioes", "Reuniões", "Resume a agenda e as avaliações das reuniões com clientes.", [
    metric("reunioes-agendadas", "Reuniões agendadas", "Quantidade total de reuniões consideradas no recorte.", "Conta os registros de reunião dentro do período e dos filtros escolhidos."),
    metric("reunioes-realizadas", "Realizadas", "Quantidade de reuniões que realmente aconteceram.", "Conta reuniões cujo status é “completed”."),
    metric("comparecimento", "Comparecimento", "Percentual das reuniões consideradas que foram realizadas.", "Divide as reuniões realizadas pelo total de reuniões.", { example: "808 realizadas em 1.000 reuniões resultam em 80,8%." }),
    metric("avaliacoes", "Avaliações", "Reuniões que receberam uma nota.", "Conta as reuniões que possuem uma nota registrada."),
    metric("nota-media", "Nota média", "Média das notas recebidas pelas reuniões.", "Soma todas as notas e divide pela quantidade de avaliações. O card mostra uma casa decimal, mas o cálculo usa os valores completos."),
    metric("destaques-positivos", "Destaques positivos", "Quantidade de pontos positivos escolhidos nas avaliações.", "Soma todas as dimensões marcadas como destaque positivo."),
    metric("pontos-atencao", "Pontos de atenção", "Quantidade de pontos que pedem acompanhamento.", "Soma todas as dimensões marcadas como ponto de atenção."),
    metric("reunioes-mes", "Reuniões por mês", "Compara reuniões agendadas e realizadas ao longo do tempo.", "Agrupa as reuniões pelo mês e separa o total considerado do total realizado."),
    metric("reunioes-tipo", "Reuniões por tipo", "Mostra quais tipos de reunião aparecem mais.", "Agrupa as reuniões pelo tipo informado."),
    metric("reunioes-status", "Status das reuniões", "Mostra a quantidade em cada situação.", "Agrupa as reuniões pelo status informado."),
    metric("distribuicao-notas", "Avaliações por nota", "Mostra quantas avaliações deram cada nota.", "Agrupa as avaliações pelo número de estrelas ou pontos recebidos."),
    metric("avaliacao-tipo", "Avaliação por tipo", "Compara a nota média dos diferentes tipos de reunião.", "Calcula a média das notas dentro de cada tipo e também informa quantas avaliações entraram no cálculo."),
  ]),

  page("formularios", "Formulários", "Mostra quais formulários existem e como estão sendo preenchidos.", [
    metric("formularios-disponiveis", "Formulários disponíveis", "Quantidade de formulários existentes no App.", "Conta os formulários cadastrados no catálogo atual."),
    metric("respostas-iniciadas", "Respostas iniciadas", "Quantidade de preenchimentos que foram começados.", "Conta os registros de preenchimento dentro do período e dos filtros."),
    metric("respostas-concluidas", "Respostas concluídas", "Quantidade de preenchimentos enviados até o fim.", "Conta as respostas que possuem uma data de envio."),
    metric("taxa-conclusao", "Taxa de conclusão", "Percentual dos preenchimentos iniciados que foram concluídos.", "Divide as respostas concluídas pelas respostas iniciadas."),
    metric("clientes-respondentes", "Clientes respondentes", "Clientes que concluíram pelo menos um formulário.", "Conta cada cliente uma única vez quando ele possui uma resposta concluída."),
    metric("preenchimento-formulario", "Preenchimento por formulário", "Mostra quais formulários receberam mais respostas.", "Agrupa os preenchimentos pelo nome do formulário."),
    metric("evolucao-respostas", "Evolução de respostas", "Mostra quantos preenchimentos começaram em cada mês.", "Agrupa os registros pelo mês de início."),
    metric("conclusao-formularios", "Situação das respostas", "Compara respostas iniciadas e concluídas.", "Agrupa cada preenchimento conforme ele tenha ou não uma data de conclusão."),
  ]),

  page("jornada", "Jornada", "Mostra o caminho dos clientes pelas etapas do App.", [
    metric("clientes-validos", "Clientes válidos", "Clientes oficiais dentro do recorte atual.", "Começa com a base oficial e aplica os filtros escolhidos."),
    metric("onboarding-jornada", "Onboarding concluído", "Clientes que terminaram o onboarding.", "Conta clientes com a etapa final do onboarding concluída e com data de conclusão."),
    metric("jornada-central", "Jornada completa", "Clientes que chegaram à Central de Inteligência.", "Conta clientes que alcançaram a etapa Central de Inteligência, mesmo que ela ainda não possua data de conclusão."),
    metric("tempo-total-mediano", "Tempo total mediano", "Tempo central gasto pelos clientes que chegaram à Central.", "Calcula os dias entre o início da jornada e a chegada à Central para cada cliente. Depois escolhe o valor do meio."),
    metric("funil-jornada", "Funil da jornada", "Mostra quantos clientes chegaram a cada etapa principal.", "Conta os clientes que concluíram ou alcançaram cada etapa e compara com a base inicial."),
    metric("estagio-atual", "Distribuição atual", "Mostra em qual etapa os clientes estão agora.", "Agrupa os clientes pelo estágio atual informado pelo App."),
    metric("tempo-etapas", "Tempo entre etapas", "Tempo típico para passar de uma etapa para a seguinte.", "Calcula o intervalo de cada cliente com datas válidas e usa o valor mediano."),
    metric("saude-jornada", "Saúde operacional", "Mostra clientes sem avanço ou parados por vários dias.", "Considera somente clientes que ainda não chegaram à Central e cria faixas de mais de 7, 15 e 30 dias desde o último avanço."),
  ]),

  page("utilizacao-app", "Utilização do App", "Mostra utilização e comportamento da plataforma pelo Google Analytics, com informações técnicas do Expo/EAS.", [
    metric("fonte-uso", "Fonte atual", "Indica de onde vêm as informações desta página.", "O Google Analytics fornece métricas de utilização e comportamento da plataforma. O Expo/EAS complementa com informações técnicas do aplicativo, como builds, versões, updates e runtime. A base Pharus fornece o contexto de negócio. A property atual está classificada como WEB na Data API; essa distinção técnica não aparece na página operacional."),
    metric("usuarios-ativos-1d", "Usuários ativos 1 dia", "Usuários distintos ativos no último dia do período.", "Usa a métrica oficial active1DayUsers da Google Analytics Data API. Não soma usuários diários."),
    metric("usuarios-ativos-7d", "Usuários ativos 7 dias", "Usuários distintos ativos em 7 dias.", "Usa a métrica oficial active7DayUsers da Google Analytics Data API. Não soma usuários diários."),
    metric("usuarios-ativos-28d", "Usuários ativos 28 dias", "Usuários distintos ativos em 28 dias.", "Usa a métrica oficial active28DayUsers da Google Analytics Data API. O painel Firebase pode mostrar 30 dias, o que gera diferença esperada."),
    metric("sessoes", "Sessões", "Quantidade de sessões no período consultado.", "Usa a métrica oficial sessions da Data API no recorte selecionado."),
    metric("novos-usuarios", "Novos usuários", "Usuários que tiveram o primeiro engajamento no período.", "Usa a métrica oficial newUsers da Data API."),
    metric("sessoes-por-usuario", "Sessões por usuário", "Média de sessões por usuário ativo.", "Usa a métrica oficial sessionsPerUser da Data API."),
    metric("serie-utilizacao", "Evolução de utilização", "Mostra usuários ativos por dia.", "Usa date + activeUsers da Data API e começa na primeira data que possui informação real, sem preencher lacunas com zero. A página operacional não explica essa regra."),
    metric("plataformas", "Android, iOS e Web", "Classificação técnica da property na Data API.", "Agrupa activeUsers pela dimensão platform. A property atual é WEB; ANDROID e iOS não retornam dados. Essa classificação fica na documentação, não na página de utilização."),
    metric("versoes", "Versões", "Versões técnicas do aplicativo encontradas no Expo/EAS.", "Não exibido atualmente no dashboard de produção. A origem continua sendo o EAS Observe. Não substitui os usuários ativos do Google Analytics.", { status: "hidden" }),
    metric("eventos-app", "Eventos", "Principais eventos registrados no aplicativo.", "Usa eventName + eventCount da Data API, mantendo a lista bruta devolvida pela API."),
    metric("engajamento", "Tempo médio de engajamento", "Tempo médio de engajamento por usuário ativo.", "Quando as duas métricas oficiais existem, divide userEngagementDuration por activeUsers. Não inventa fórmula alternativa."),
    metric("retencao", "Retenção", "Retenção de usuários ao longo dos dias.", "Não disponível pela integração atual porque a Data API não oferece um equivalente simples da retenção do painel Firebase.", { status: "pending" }),
    metric("builds", "Builds", "Pacotes do aplicativo criados para instalação ou publicação.", "Lista os builds retornados pelo EAS, com plataforma, versão, status e data."),
    metric("channels", "Channels", "Canais usados para distribuir atualizações do aplicativo.", "Mostra os canais encontrados no EAS. Um canal ajuda a direcionar uma atualização para um grupo do aplicativo."),
    metric("updates", "Updates e runtimes", "Atualizações publicadas e versões de execução usadas pelo aplicativo.", "Lista as atualizações retornadas pelo EAS e informa canal, branch, runtime e data."),
    metric("observe", "Saúde e performance", "Eventos técnicos de inicialização, renderização e carregamento do aplicativo.", "Não exibido atualmente no dashboard de produção. A origem continua sendo o resumo do EAS Observe por plataforma e versão. Eventos anônimos não são usuários da base Pharus.", { status: "hidden" }),
    metric("contexto-pharus", "Contexto da base Pharus", "Fotografia agregada dos clientes e recursos do Pharus.", "Mostra totais da base oficial separadamente. Não existe hoje uma chave confirmada para ligar um usuário do Google Analytics a um cliente específico."),
  ]),

  page("pagamentos", "Pagamentos", "Mostra registros de ciclos e datas de pagamento existentes no App.", [
    metric("clientes-registro", "Clientes com registro", "Clientes que possuem pelo menos um registro de pagamento.", "Conta cada cliente uma única vez quando existe uma data de pagamento."),
    metric("registros-pagamento", "Registros de pagamento", "Quantidade de registros encontrados no período.", "Conta todos os registros que passaram pelos filtros. Um cliente pode ter mais de um."),
    metric("cobertura-pagamentos", "Cobertura", "Percentual de clientes que possuem registro de pagamento.", "Divide os clientes com registro pelo total de clientes do recorte."),
    metric("ultimo-pagamento", "Último pagamento", "Data de pagamento mais recente encontrada.", "Ordena as datas válidas e mostra a mais nova."),
    metric("pagamentos-mes", "Registros por mês", "Mostra quantos registros de pagamento existem em cada mês.", "Agrupa os registros pela data de pagamento."),
    metric("valor-pagamentos", "Valor pago", "Indicaria o valor financeiro dos pagamentos.", "Regra ainda em definição porque a fonte atual possui datas e ciclos, mas não possui valor monetário. O dashboard não estima receita.", { status: "pending" }),
  ]),

  page("csat", "CSAT", "O CSAT mostra o quanto a pessoa ficou satisfeita com uma experiência. Esta página separa as notas das reuniões das notas das telas do Pharus.", [
    metric("csat", "CSAT", "O CSAT mostra o quanto a pessoa ficou satisfeita com uma experiência.", "Conta as avaliações reais de cada fonte e mostra a nota média sem misturar reuniões e plataforma como se fossem a mesma pesquisa."),
    metric("csat-reunioes", "CSAT de reuniões", "Usamos as notas deixadas depois das reuniões.", "Lê core.scheduled_meeting_evaluation. A nota é o campo stars, de 1 a 5."),
    metric("csat-plataforma", "CSAT da plataforma", "Usamos os feedbacks enviados dentro das telas do Pharus.", "Não existe a tabela metrics.feedback. A página lê metrics.feedback_surveys e metrics.feedback_responses com metric_type = csat."),
    metric("nota-media", "Nota média", "Somamos todas as notas e dividimos pela quantidade de avaliações.", "Usa somente notas registradas. O resultado aparece com uma casa decimal, por exemplo 4,8."),
    metric("distribuicao", "Distribuição", "Mostra quantas pessoas deram 1, 2, 3, 4 ou 5 estrelas.", "Agrupa as avaliações pela nota inteira. Estrelas sem resposta aparecem com zero."),
    metric("pontos-positivos", "Pontos positivos", "Mostra o que os clientes disseram que funcionou bem.", "Usa as tags com polaridade positive gravadas no banco, não uma inferência pela nota."),
    metric("pontos-melhoria", "Pontos de melhoria", "Mostra o que os clientes disseram que poderia melhorar.", "Usa as tags com polaridade improvement gravadas no banco, não uma inferência pela nota."),
    metric("nota-4", "Classificação da nota 4", "Ainda não está definido se a nota 4 entra como ponto positivo ou de melhoria.", "Regra ainda em definição. A regra recebida cita 4 nos dois lados. Enquanto isso não for confirmado, a nota 4 fica pendente e as tags do banco continuam valendo.", { status: "pending" }),
  ]),

  page("qualidade-dados", "Qualidade dos Dados", "Mostra onde existem informações e onde ainda faltam dados.", [
    metric("base-recorte", "Base do recorte", "Quantidade de clientes usada na análise de qualidade.", "Aplica os filtros sobre os clientes oficiais."),
    metric("cobertura-dominio", "Cobertura por domínio", "Percentual de clientes com informação em cada área.", "Divide os clientes com dado pelo total de clientes do recorte."),
    metric("com-dado", "Com dado", "Clientes que possuem informação naquela área.", "Conta os clientes que atendem à regra da área, como ter patrimônio, Open Finance ou reunião realizada."),
    metric("sem-dado", "Sem dado", "Clientes que ainda não possuem informação naquela área.", "Pega o total do recorte e tira os clientes com dado."),
    metric("status-qualidade", "Status da qualidade", "Sinal simples para facilitar a leitura da cobertura.", "Boa significa pelo menos 70% de cobertura. Atenção significa de 40% até menos de 70%. Crítica significa menos de 40%."),
  ]),
];

export const DOCUMENTED_METRIC_COUNT = METRICS_DOCUMENTATION.reduce(
  (total, item) => total + item.metrics.length,
  0,
);

export function normalizeDocumentationSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function documentationSearchKey(value) {
  return normalizeDocumentationSearch(value)
    .replace(/\b([a-z]+)oes\b/g, "$1ao")
    .replace(/\b([a-z]{4,})s\b/g, "$1");
}

export function searchMetricsDocumentation(query) {
  const normalized = documentationSearchKey(query);
  const all = METRICS_DOCUMENTATION.flatMap((item) =>
    item.metrics.map((entry) => ({ ...entry, pageId: item.id, pageTitle: item.title })),
  );
  if (!normalized) return all;
  return all.filter((entry) => documentationSearchKey([
    entry.name,
    entry.pageTitle,
    entry.meaning,
    entry.calculation,
    entry.example,
    entry.status === "pending" ? "regra ainda em definicao em construcao" : "",
  ].join(" ")).includes(normalized));
}
