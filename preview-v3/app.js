const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const API_URL = 'https://script.google.com/macros/s/AKfycbwanjoMA8Kd9pdtGWlraMN7agGTdlY_8zMaXBQQQL_7zRBPwZltu8oVMfUQFHgAQOKzbA/exec';

const PROFILE_KEY = 'cctProfileV2';
const MODALIDADE_IDS = {
  'Futsal Feminino':'FUT-F',
  'Futsal Masculino':'FUT-M',
  'Vôlei Feminino':'VOL-F',
  'Vôlei Masculino':'VOL-M',
  'Basquete Feminino':'BAS-F',
  'Basquete Masculino':'BAS-M',
  'Handebol Feminino':'HAN-F',
  'Handebol Masculino':'HAN-M'
};

let apiData = {
  jogos: [],
  classificacao: [],
  classificacao_geral: [],
  cenarios: [],
  competicoes: [],
  modalidades: [],
  agenda: [],
  avisos: [],
  conteudos: [],
  locais: [],
  pessoas: [],
  eventos: [],
  destaques: []
};

let jogosUI = {
  competicao: 'INTERLAJE-2026',
  tipo: 'todos',
  filtro: 'todos',
  aba: 'jogos',
  classificacaoModalidade: '',
  classificacaoTipo: 'modalidade'
};

function parseBrDate(data, hora='00:00'){
  const p=String(data||'').split('/').map(Number);
  if(p.length!==3 || p.some(Number.isNaN)) return null;
  const h=String(hora||'00:00').split(':').map(Number);
  return new Date(p[2],p[1]-1,p[0],h[0]||0,h[1]||0,0,0);
}

function sameDay(a,b){
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function selectedSportIds(){
  try{
    const p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');
    if(Array.isArray(p?.sportIds) && p.sportIds.length) return p.sportIds.filter(Boolean);
    return (p?.sports||[]).map(x=>MODALIDADE_IDS[x]||x).filter(Boolean);
  }catch(e){ return []; }
}

function competitionName(id){
  const c=apiData.competicoes.find(x=>x.ID_COMPETICAO===id);
  if(c) return `${c.NOME || id}${c.ANO ? ' '+c.ANO : ''}`;
  return id==='INTERLAJE-2026' ? 'Interlaje 2026' : id;
}

function modalidadeNome(id){
  const m=apiData.modalidades.find(x=>x.ID_MODALIDADE===id);
  if(m) return `${m.NOME || id}${m.NAIPE ? ' '+m.NAIPE : ''}`.trim();
  const fallback={
    'FUT-F':'Futsal Feminino','FUT-M':'Futsal Masculino',
    'VOL-F':'Vôlei Feminino','VOL-M':'Vôlei Masculino',
    'BAS-F':'Basquete Feminino','BAS-M':'Basquete Masculino',
    'HAN-F':'Handebol Feminino','HAN-M':'Handebol Masculino'
  };
  return fallback[id]||id||'';
}

function modalidadeBase(id){
  const prefixo=String(id||'').split('-')[0];
  const mapa={FUT:'Futsal',VOL:'Vôlei',BAS:'Basquete',HAN:'Handebol',NAT:'Natação',ATL:'Atletismo'};
  if(mapa[prefixo]) return {prefixo,nome:mapa[prefixo]};
  const completo=modalidadeNome(id);
  const nome=String(completo||id||'').replace(/\s+(Feminino|Masculino|Misto)$/i,'').trim();
  return {prefixo,nome:nome||prefixo};
}

function jogoTemCCT(jogo){
  return String(jogo.EQUIPE_A||'').trim().toUpperCase()==='CCT' ||
         String(jogo.EQUIPE_B||'').trim().toUpperCase()==='CCT';
}

function isFinalizado(jogo){
  return String(jogo.STATUS||'').trim().toUpperCase()==='FINALIZADO';
}

function placarOuHora(jogo){
  const temPlacar=jogo.PLACAR_A!=='' && jogo.PLACAR_B!=='';
  return temPlacar ? `${jogo.PLACAR_A} × ${jogo.PLACAR_B}` : (jogo.HORA||'--:--');
}

function cenarioDaModalidade(idModalidade){
  return apiData.cenarios.find(c =>
    c.ID_COMPETICAO===jogosUI.competicao &&
    c.ID_MODALIDADE===idModalidade
  );
}

function pessoaJogoHtml(nome,foto,titulo,classe=''){
  nome=String(nome||'').trim();
  if(!nome) return '';
  foto=normalizeImageUrl(foto||'');
  const iniciais=nome.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  return `
    <div class="match-representative ${classe}">
      ${foto
        ? `<img src="${escapeHtml(foto)}" alt="Foto de ${escapeHtml(nome)}" />`
        : `<div class="representative-placeholder">${escapeHtml(iniciais||'CCT')}</div>`}
      <div><small>${escapeHtml(titulo)}</small><strong>${escapeHtml(nome)}</strong></div>
    </div>`;
}

function representanteHtml(jogo){
  if(!jogoTemCCT(jogo)) return '';
  return pessoaJogoHtml(jogo.REPRESENTANTE,jogo.FOTO_REPRESENTANTE,'REPRESENTANTE DA MODALIDADE');
}

function representacaoCctHtml(jogo){
  const nome=String(jogo.RESPONSAVEL_REPRESENTACAO || jogo.REPRESENTACAO_RESPONSAVEL || '').trim();
  const foto=jogo.FOTO_RESP_REPRESENTACAO || jogo.FOTO_RESPONSAVEL_REPRESENTACAO || jogo.FOTO_REPRESENTACAO || '';
  const marcado=String(jogo.REPRESENTACAO_CCT||'').trim().toUpperCase()==='SIM';
  if(!marcado && !nome) return '';
  if(!nome) return `<div class="representation-pending"><small>REPRESENTAÇÃO CCT</small><strong>Responsável a definir</strong></div>`;
  return pessoaJogoHtml(nome,foto,'REPRESENTAÇÃO CCT','is-representation');
}

function matchCard(jogo,{home=false}={}){
  const cctA=String(jogo.EQUIPE_A||'').trim().toUpperCase()==='CCT';
  const cctB=String(jogo.EQUIPE_B||'').trim().toUpperCase()==='CCT';
  const fase=jogo.GRUPO ? `GRUPO ${jogo.GRUPO}` : (jogo.FASE||'');
  const status=jogo.STATUS||'';
  const comp=competitionName(jogo.ID_COMPETICAO);
  const modalidade=modalidadeNome(jogo.ID_MODALIDADE);
  const cenario=jogoTemCCT(jogo) ? cenarioDaModalidade(jogo.ID_MODALIDADE) : null;

  return `
    <article class="match-card ${home?'':'compact'} ${jogoTemCCT(jogo)?'is-cct':''}">
      <div class="match-top">
        <span class="chip">${escapeHtml(modalidade)}</span>
        <span class="muted">${escapeHtml(home?comp:fase)}</span>
      </div>
      <div class="teams">
        <div class="team ${cctA?'cct-team':''}">
          ${cctA?'<img src="assets/logo-jogos-cct.png" alt="CCT" />':''}
          <strong>${escapeHtml(jogo.EQUIPE_A||'A DEFINIR')}</strong>
        </div>
        <div class="score">
          <b>${escapeHtml(placarOuHora(jogo))}</b>
          <small>${escapeHtml(status)}</small>
        </div>
        <div class="team opponent ${cctB?'cct-team':''}">
          ${cctB?'<img src="assets/logo-jogos-cct.png" alt="CCT" />':''}
          <strong>${escapeHtml(jogo.EQUIPE_B||'A DEFINIR')}</strong>
        </div>
      </div>
      <div class="match-foot">
        <span>📍 ${escapeHtml(jogo.LOCAL||'Local a definir')}</span>
        <span>${escapeHtml(jogo.DATA||'')}</span>
      </div>
      ${cenario ? `<button class="scenario-link" type="button" data-open-scenario-modality="${escapeHtml(jogo.ID_MODALIDADE)}">🎯 Situação da classificação <b>›</b></button>` : ''}
      ${representanteHtml(jogo)}
      ${representacaoCctHtml(jogo)}
    </article>`;
}

function jogosFiltrados(){
  const now=new Date();
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const sports=selectedSportIds();

  return apiData.jogos
    .filter(j=>j.ID_COMPETICAO===jogosUI.competicao)
    .filter(j=>{
      if(jogosUI.tipo==='representacoes') {
        return String(j.REPRESENTACAO_CCT||'').trim().toUpperCase()==='SIM';
      }
      if(jogosUI.tipo==='meus') {
        return jogoTemCCT(j) && (!sports.length || sports.includes(j.ID_MODALIDADE));
      }
      return true;
    })
    .filter(j=>{
      if(jogosUI.filtro==='todos') return true;
      if(jogosUI.filtro.startsWith('modalidade:')){
        const prefixo=jogosUI.filtro.split(':')[1]||'';
        return String(j.ID_MODALIDADE||'').startsWith(prefixo+'-');
      }
      const d=parseBrDate(j.DATA,j.HORA);
      if(jogosUI.filtro==='hoje') return sameDay(d,now);
      if(jogosUI.filtro==='amanha') return sameDay(d,tomorrow);
      return true;
    })
    .sort((a,b)=>(parseBrDate(a.DATA,a.HORA)?.getTime()||0)-(parseBrDate(b.DATA,b.HORA)?.getTime()||0));
}

function renderizarFiltrosModalidades(){
  const select=$('#modalidadeFiltro');
  if(!select) return;

  const ids=[...new Set(
    apiData.jogos
      .filter(j=>j.ID_COMPETICAO===jogosUI.competicao)
      .map(j=>j.ID_MODALIDADE)
      .filter(Boolean)
  )];

  const bases=[];
  const vistos=new Set();

  ids.forEach(id=>{
    const base=modalidadeBase(id);
    if(!base.prefixo || vistos.has(base.prefixo)) return;
    vistos.add(base.prefixo);
    bases.push(base);
  });

  bases.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));

  const atual=jogosUI.filtro.startsWith('modalidade:')
    ? jogosUI.filtro.split(':')[1]
    : '';

  select.innerHTML=[
    '<option value="">Todas</option>',
    ...bases.map(x=>`<option value="${escapeHtml(x.prefixo)}" ${x.prefixo===atual?'selected':''}>${escapeHtml(x.nome)}</option>`)
  ].join('');
}

function renderizarJogos(){
  const container=$('#jogosContainer');
  if(!container) return;
  const jogos=jogosFiltrados();
  const resumo=$('#jogosResumo');
  if(resumo) resumo.textContent=`${jogos.length} ${jogos.length===1?'jogo encontrado':'jogos encontrados'}`;
  container.innerHTML=jogos.length
    ? jogos.map(j=>matchCard(j)).join('')
    : '<div class="games-empty">Nenhum jogo encontrado com esses filtros.</div>';
}

function renderizarProximoJogoHome(){
  const container=$('#homeNextGameContainer');
  if(!container) return;
  const now=new Date();
  const sports=selectedSportIds();
  let candidatos=apiData.jogos
    .filter(j=>jogoTemCCT(j) && !isFinalizado(j))
    .map(j=>({j,d:parseBrDate(j.DATA,j.HORA)}))
    .filter(x=>x.d && x.d.getTime()>=now.getTime())
    .sort((a,b)=>a.d-b.d);

  const preferidos=candidatos.filter(x=>!sports.length || sports.includes(x.j.ID_MODALIDADE));
  const proximo=(preferidos[0]||candidatos[0])?.j;
  container.innerHTML=proximo
    ? matchCard(proximo,{home:true})
    : '<div class="games-empty">Nenhum próximo jogo da CCT encontrado.</div>';
}

function modalidadesClassificacao(){
  return [...new Set(
    apiData.classificacao
      .filter(x=>x.ID_COMPETICAO===jogosUI.competicao)
      .map(x=>x.ID_MODALIDADE)
      .filter(Boolean)
  )];
}

function renderizarSeletorClassificacao(){
  const select=$('#classificacaoModalidade');
  if(!select) return;
  const ids=modalidadesClassificacao();

  if(!ids.length){
    jogosUI.classificacaoModalidade='';
    select.innerHTML='<option value="">Sem classificação disponível</option>';
    select.disabled=true;
    return;
  }

  select.disabled=false;
  if(!ids.includes(jogosUI.classificacaoModalidade)) jogosUI.classificacaoModalidade=ids[0];
  select.innerHTML=ids.map(id=>`<option value="${escapeHtml(id)}" ${id===jogosUI.classificacaoModalidade?'selected':''}>${escapeHtml(modalidadeNome(id))}</option>`).join('');
}

function classificacaoGrupoHtml(grupo,linhas){
  const ordenadas=[...linhas].sort((a,b)=>(Number(a.POSICAO)||999)-(Number(b.POSICAO)||999));
  return `
    <section class="classification-group">
      <div class="classification-group-title">
        <strong>${escapeHtml(grupo ? `Grupo ${grupo}` : 'Classificação')}</strong>
        <small>${ordenadas.length} equipes</small>
      </div>
      <div class="standings standings-wide">
        <div class="stand-head">
          <span>#</span><span>Equipe</span><span>J</span><span>V</span><span>E</span><span>D</span><span>Pts</span><span>Saldo</span>
        </div>
        ${ordenadas.map(r=>{
          const destaque=String(r.DESTAQUE_CCT||'').toUpperCase()==='SIM' || String(r.EQUIPE||'').toUpperCase()==='CCT';
          return `<div class="${destaque?'qual cct-standing':''}">
            <span>${escapeHtml(r.POSICAO||'')}</span>
            <b>${escapeHtml(r.EQUIPE||'')}</b>
            <span>${escapeHtml(r.JOGOS||'0')}</span>
            <span>${escapeHtml(r.VITORIAS||'0')}</span>
            <span>${escapeHtml(r.EMPATES||'0')}</span>
            <span>${escapeHtml(r.DERROTAS||'0')}</span>
            <strong>${escapeHtml(r.PONTOS||'0')}</strong>
            <span>${escapeHtml(r.SALDO||'')}</span>
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

function classificacaoGeralHtml(){
  const linhas=apiData.classificacao_geral
    .filter(x=>x.ID_COMPETICAO===jogosUI.competicao)
    .sort((a,b)=>(Number(a.POSICAO)||999)-(Number(b.POSICAO)||999));
  if(!linhas.length) return '';
  return `
    <section class="general-ranking">
      <div class="section-head compact-head"><div><i></i><h3>CLASSIFICAÇÃO GERAL</h3></div></div>
      <div class="general-ranking-list">
        ${linhas.map(r=>`<div class="${String(r.DESTAQUE_CCT||'').toUpperCase()==='SIM'?'cct-general':''}">
          <b>${escapeHtml(r.POSICAO||'')}</b>
          <strong>${escapeHtml(r.EQUIPE||'')}</strong>
          <span>${escapeHtml(r.PONTOS||'0')} pts</span>
          <small>${[r.OUROS&&`${r.OUROS} 🥇`,r.PRATAS&&`${r.PRATAS} 🥈`,r.BRONZES&&`${r.BRONZES} 🥉`].filter(Boolean).join(' • ')}</small>
        </div>`).join('')}
      </div>
    </section>`;
}

function renderizarClassificacao(){
  const container=$('#classificacaoContainer');
  if(!container) return;

  const toolbar=$('#classificacaoToolbar');
  const geralDisponivel=apiData.classificacao_geral.some(x=>x.ID_COMPETICAO===jogosUI.competicao);
  const btnGeral=document.querySelector('[data-classificacao-tipo="geral"]');
  if(btnGeral) btnGeral.disabled=!geralDisponivel;
  if(jogosUI.classificacaoTipo==='geral' && !geralDisponivel) jogosUI.classificacaoTipo='modalidade';

  $$('#classificacaoTipo [data-classificacao-tipo]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.classificacaoTipo===jogosUI.classificacaoTipo));

  if(jogosUI.classificacaoTipo==='geral'){
    if(toolbar) toolbar.hidden=true;
    const geral=classificacaoGeralHtml();
    container.innerHTML=geral || '<div class="games-empty">Esta competição ainda não possui classificação geral publicada.</div>';
    return;
  }

  if(toolbar) toolbar.hidden=false;
  renderizarSeletorClassificacao();

  if(!jogosUI.classificacaoModalidade){
    container.innerHTML='<div class="games-empty">Esta competição ainda não possui classificação por modalidade publicada.</div>';
    return;
  }

  const linhas=apiData.classificacao.filter(x=>
    x.ID_COMPETICAO===jogosUI.competicao &&
    x.ID_MODALIDADE===jogosUI.classificacaoModalidade
  );

  const grupos=new Map();
  linhas.forEach(r=>{
    const chave=r.GRUPO||'';
    if(!grupos.has(chave)) grupos.set(chave,[]);
    grupos.get(chave).push(r);
  });

  container.innerHTML=linhas.length
    ? [...grupos.entries()].map(([g,rs])=>classificacaoGrupoHtml(g,rs)).join('')
    : '<div class="games-empty">Nenhuma classificação encontrada para esta modalidade.</div>';
}

function proximoJogoCenarioHtml(idJogo){
  if(!idJogo) return '';
  const j=apiData.jogos.find(x=>x.ID_JOGO===idJogo);
  if(!j) return `<span>${escapeHtml(idJogo)}</span>`;
  return `<span>${escapeHtml(j.DATA||'')} • ${escapeHtml(j.HORA||'')}<small>${escapeHtml((j.EQUIPE_A||'A DEFINIR')+' × '+(j.EQUIPE_B||'A DEFINIR'))}</small></span>`;
}

function renderizarCenarios(){
  const container=$('#cenariosContainer');
  if(!container) return;
  const linhas=apiData.cenarios.filter(c=>c.ID_COMPETICAO===jogosUI.competicao);

  container.innerHTML=linhas.length ? linhas.map(c=>`
    <article class="scenario-detail-card" data-scenario-card="${escapeHtml(c.ID_MODALIDADE||'')}">
      <div class="scenario-detail-head">
        <div>
          <span class="chip">${escapeHtml(modalidadeNome(c.ID_MODALIDADE))}</span>
          <h3>${escapeHtml(c.STATUS||'Situação')}</h3>
        </div>
        <span class="target">🎯</span>
      </div>
      <div class="scenario-detail-body">
        <div><small>CENÁRIO ATUAL</small><p>${escapeHtml(c.CENARIO_ATUAL||'Aguardando atualização.')}</p></div>
        <div><small>O QUE A CCT PRECISA</small><strong>${escapeHtml(c.O_QUE_PRECISA||'Aguardando definição.')}</strong></div>
        ${c.PROXIMO_JOGO?`<div class="scenario-next"><small>PRÓXIMO JOGO</small>${proximoJogoCenarioHtml(c.PROXIMO_JOGO)}</div>`:''}
      </div>
    </article>
  `).join('') : '<div class="games-empty">Nenhum cenário de classificação publicado para esta competição.</div>';
}


function destaqueIcone(tipo){
  const t=String(tipo||'').trim().toUpperCase();
  const mapa={
    OURO:'🥇', PRATA:'🥈', BRONZE:'🥉', CAMPEAO:'🏆', 'CAMPEÃO':'🏆',
    RECORDE:'⚡', DESTAQUE:'⭐', PREMIACAO:'🎖️', 'PREMIAÇÃO':'🎖️'
  };
  return mapa[t]||'⭐';
}

function renderizarDestaques(){
  const container=$('#destaquesContainer');
  if(!container) return;

  const linhas=apiData.destaques
    .filter(d=>d.ID_COMPETICAO===jogosUI.competicao)
    .sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999));

  container.innerHTML=linhas.length ? linhas.map(d=>{
    const foto=normalizeImageUrl(d.FOTO_URL||'');
    const nome=String(d.NOME||'').trim();
    const modalidade=d.ID_MODALIDADE ? modalidadeNome(d.ID_MODALIDADE) : '';
    return `
      <article class="highlight-card">
        <div class="highlight-medal">${destaqueIcone(d.TIPO)}</div>
        <div class="highlight-main">
          <div class="highlight-top">
            <span class="chip">${escapeHtml(d.TIPO||'DESTAQUE')}</span>
            ${modalidade?`<small>${escapeHtml(modalidade)}</small>`:''}
          </div>
          <h3>${escapeHtml(d.TITULO||'Destaque da CCT')}</h3>
          ${nome?`<strong class="highlight-name">${escapeHtml(nome)}</strong>`:''}
          ${d.RESULTADO?`<div class="highlight-result">${escapeHtml(d.RESULTADO)}</div>`:''}
          ${d.DESCRICAO?`<p>${escapeHtml(d.DESCRICAO)}</p>`:''}
        </div>
        ${foto?`<img class="highlight-photo" src="${escapeHtml(foto)}" alt="${escapeHtml(nome||d.TITULO||'Destaque CCT')}" />`:''}
      </article>`;
  }).join('') : '<div class="games-empty">Nenhum destaque publicado para esta competição ainda.</div>';
}

function renderizarAbaCompeticao(){
  const mapas={
    jogos:['#painelJogos','Jogos'],
    classificacao:['#painelClassificacao','Classificação'],
    cenarios:['#painelCenarios','Cenários'],
    destaques:['#painelDestaques','Destaques']
  };
  Object.entries(mapas).forEach(([aba,[sel]])=>{
    const el=$(sel);
    if(el) el.hidden=aba!==jogosUI.aba;
  });
  $$('#competitionTabs [data-comp-tab]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.compTab===jogosUI.aba));
  const titulo=$('#competicaoTitulo');
  if(titulo) titulo.textContent=mapas[jogosUI.aba]?.[1]||'Jogos';

  if(jogosUI.aba==='jogos') renderizarJogos();
  if(jogosUI.aba==='classificacao') renderizarClassificacao();
  if(jogosUI.aba==='cenarios') renderizarCenarios();
  if(jogosUI.aba==='destaques') renderizarDestaques();
}

function abrirCenarioModalidade(idModalidade){
  jogosUI.aba='cenarios';
  renderizarAbaCompeticao();
  requestAnimationFrame(()=>{
    const card=document.querySelector(`[data-scenario-card="${CSS.escape(idModalidade)}"]`);
    if(card){
      card.classList.add('scenario-focus');
      card.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>card.classList.remove('scenario-focus'),1800);
    }
  });
}

function bindCompeticaoUI(){
  $('#tipoJogos')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-tipo-jogos]');
    if(!btn) return;
    jogosUI.tipo=btn.dataset.tipoJogos;
    $$('#tipoJogos [data-tipo-jogos]').forEach(x=>x.classList.toggle('selected',x===btn));
    renderizarJogos();
  });

  $('#filtrosJogos')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-filtro]');
    if(!btn) return;
    jogosUI.filtro=btn.dataset.filtro;
    $$('#filtrosJogos [data-filtro]').forEach(x=>x.classList.toggle('selected',x===btn));
    const select=$('#modalidadeFiltro');
    if(select) select.value='';
    renderizarJogos();
  });

  $('#modalidadeFiltro')?.addEventListener('change',e=>{
    const prefixo=e.target.value;
    jogosUI.filtro=prefixo ? `modalidade:${prefixo}` : 'todos';
    $$('#filtrosJogos [data-filtro]').forEach(x=>x.classList.toggle('selected',!prefixo && x.dataset.filtro==='todos'));
    renderizarJogos();
  });

  $('#competitionTabs')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-comp-tab]');
    if(!btn) return;
    jogosUI.aba=btn.dataset.compTab;
    renderizarAbaCompeticao();
  });

  $('#classificacaoModalidade')?.addEventListener('change',e=>{
    jogosUI.classificacaoModalidade=e.target.value;
    renderizarClassificacao();
  });

  $('#classificacaoTipo')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-classificacao-tipo]');
    if(!btn || btn.disabled) return;
    jogosUI.classificacaoTipo=btn.dataset.classificacaoTipo;
    renderizarClassificacao();
  });

  $('#competicaoBtn')?.addEventListener('click',abrirSeletorCompeticao);

  $('#jogosContainer')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-open-scenario-modality]');
    if(!btn) return;
    abrirCenarioModalidade(btn.dataset.openScenarioModality);
  });

  $('#homeNextGameContainer')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-open-scenario-modality]');
    if(!btn) return;
    go('jogos');
    abrirCenarioModalidade(btn.dataset.openScenarioModality);
  });
}

function abrirSeletorCompeticao(){
  const publicadas=apiData.competicoes.filter(c=>!('PUBLICADO' in c) || String(c.PUBLICADO).toUpperCase()==='SIM');
  const comps=publicadas.length?publicadas:[{ID_COMPETICAO:jogosUI.competicao,NOME:competitionName(jogosUI.competicao)}];
  const body=$('#modalContent');
  if(!body) return;

  body.innerHTML=`<span class="chip">COMPETIÇÕES</span><h2>Escolha o campeonato</h2><div class="competition-list">${comps.map(c=>`<button class="competition-option ${c.ID_COMPETICAO===jogosUI.competicao?'active':''}" data-competition-id="${escapeHtml(c.ID_COMPETICAO)}"><span>${escapeHtml(c.NOME||c.ID_COMPETICAO)}<small>${escapeHtml(c.ANO||'')}</small></span><b>›</b></button>`).join('')}</div>`;
  $('#modal')?.classList.add('open');

  $$('[data-competition-id]').forEach(btn=>btn.addEventListener('click',()=>{
    jogosUI.competicao=btn.dataset.competitionId;
    jogosUI.filtro='todos';
    jogosUI.classificacaoModalidade='';
    jogosUI.classificacaoTipo='modalidade';
    const filtroModalidade=$('#modalidadeFiltro');
    if(filtroModalidade) filtroModalidade.value='';
    const nome=$('#competicaoNome');
    if(nome) nome.textContent=competitionName(jogosUI.competicao);
    $('#modal')?.classList.remove('open');
    renderizarFiltrosModalidades();
    renderizarSeletorClassificacao();
    renderizarAbaCompeticao();
  }));
}

async function carregarDadosAPI(){
  try{
    const resposta=await fetch(API_URL,{cache:'no-store'});
    if(!resposta.ok) throw new Error('HTTP '+resposta.status);
    const dados=await resposta.json();

    apiData.jogos=dados.jogos||[];
    apiData.classificacao=dados.classificacao||[];
    apiData.classificacao_geral=dados.classificacao_geral||[];
    apiData.cenarios=dados.cenarios||[];
    apiData.competicoes=dados.competicoes||[];
    apiData.modalidades=dados.modalidades||[];
    apiData.agenda=dados.agenda||[];
    apiData.avisos=dados.avisos||[];
    apiData.conteudos=dados.conteudos||[];
    apiData.locais=dados.locais||[];
    apiData.pessoas=dados.pessoas||[];
    apiData.eventos=dados.eventos||[];
    apiData.destaques=dados.destaques||[];

    if(!apiData.competicoes.some(c=>c.ID_COMPETICAO===jogosUI.competicao) && apiData.competicoes[0]){
      jogosUI.competicao=apiData.competicoes[0].ID_COMPETICAO;
    }

    const nome=$('#competicaoNome');
    if(nome) nome.textContent=competitionName(jogosUI.competicao);

    renderizarFiltrosModalidades();
    renderizarSeletorClassificacao();
    renderizarAbaCompeticao();
    renderizarProximoJogoHome();
    renderizarModulosGerais();

    console.log('API CCT carregada:',apiData);
  }catch(erro){
    console.error('Erro ao carregar API CCT:',erro);
    const container=$('#jogosContainer');
    if(container) container.innerHTML='<div class="games-empty">Não foi possível atualizar os jogos agora.</div>';
    const home=$('#homeNextGameContainer');
    if(home) home.innerHTML='<div class="games-empty">Não foi possível atualizar o próximo jogo agora.</div>';
    const cls=$('#classificacaoContainer');
    if(cls) cls.innerHTML='<div class="games-empty">Não foi possível atualizar a classificação agora.</div>';
    const cen=$('#cenariosContainer');
    if(cen) cen.innerHTML='<div class="games-empty">Não foi possível atualizar os cenários agora.</div>';
    const des=$('#destaquesContainer');
    if(des) des.innerHTML='<div class="games-empty">Não foi possível atualizar os destaques agora.</div>';
  }
}

bindCompeticaoUI();
carregarDadosAPI();

function go(screen){
  $$('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen===screen));
  $$('.bottom-nav button[data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===screen));
  closeDrawer();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

const drawer=$('#drawer'), backdrop=$('#drawerBackdrop');
function openDrawer(){drawer.classList.add('open');backdrop.classList.add('open')}
function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open')}
$('#menuBtn').onclick=openDrawer; $('#closeDrawer').onclick=closeDrawer; backdrop.onclick=closeDrawer;

const modal=$('#modal'), mc=$('#modalContent');
const modalData={
  scenario:`<span class="chip live">CENÁRIOS</span><h2>🎯 Situação da classificação</h2><p>Abra a aba <strong>Cenários</strong> dentro da competição para acompanhar os dados atualizados da CCT.</p>`,
  media:`<span class="chip">MÍDIA CCT</span><h2>Fotos e vídeos</h2><div class="modal-list"><div><strong>📸 Fotos da competição</strong><small>Abrir álbum no Google Drive</small></div><div><strong>🎥 Vídeos</strong><small>Melhores momentos e conteúdos da CCT</small></div><div><strong>🖼️ Galeria</strong><small>Registros de jogos, torcida e eventos</small></div></div>`,
  docs:`<span class="chip">DOCUMENTOS</span><h2>Central de arquivos</h2><div class="modal-list"><div><strong>Regulamento Interlaje 2026</strong><small>Abrir documento</small></div><div><strong>Tabela oficial</strong><small>Abrir arquivo</small></div><div><strong>Caderno de jogos</strong><small>Abrir arquivo</small></div></div>`,
  places:`<span class="chip">LOCAIS</span><h2>Onde precisamos estar?</h2><div class="modal-list"><div><strong>📍 Ginásio Central</strong><small>Abrir no mapa</small></div><div><strong>📍 Salinha da Atlética</strong><small>UDESC Joinville</small></div><div><strong>📍 Local do evento</strong><small>Abrir no mapa</small></div></div>`,
  about:`<span class="chip">ATLÉTICA CCT</span><h2>Sobre a Atlética</h2><p>Área reservada para história, identidade, mascote, conquistas, títulos e informações institucionais da Atlética CCT.</p>`,
  partners:`<span class="chip">PARCEIROS</span><h2>Quem fortalece a CCT</h2><p>Espaço para logos, benefícios e links de parceiros e patrocinadores.</p>`,
  contacts:`<span class="chip">CONTATOS</span><h2>Fale com a CCT</h2><div class="modal-list"><div><strong>WhatsApp</strong><small>Contato oficial</small></div><div><strong>Instagram</strong><small>Rede social da Atlética</small></div><div><strong>Organização</strong><small>Contatos importantes durante a competição</small></div></div>`,
  help:`<span class="chip">AJUDA</span><h2>Como usar o app</h2><p>Aqui teremos instruções de instalação, uso do perfil, notificações e dúvidas frequentes.</p>`,
  forms:`<span class="chip">FORMULÁRIOS</span><h2>Pedidos e Vendas</h2><p>O aplicativo funcionará como uma central de acesso aos Google Forms usados pela Atlética.</p><div class="modal-list"><div><strong>🛍️ Produtos da Atlética</strong><small>Abrir Forms de pedido/venda</small></div><div><strong>🎽 Kits de atletas</strong><small>Abrir Forms da campanha ativa</small></div><div><strong>👕 Uniformes</strong><small>Abrir Forms de encomenda</small></div><div><strong>📦 Retiradas</strong><small>Abrir Forms de controle interno</small></div></div>`
};
function openModal(type){ mc.innerHTML=modalData[type]||modalData.help; modal.classList.add('open'); closeDrawer(); }
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
$('#modalClose').onclick=()=>modal.classList.remove('open');
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
$('#alertBtn').onclick=()=>abrirAvisos();

setTimeout(()=>$('#splash').classList.add('hide'),1500);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}

const memberBtn=document.querySelector('#demoMemberAccess');
if(memberBtn){
  memberBtn.addEventListener('click',()=>{
    document.querySelector('#memberLock').hidden=true;
    document.querySelector('#memberDashboard').hidden=false; renderizarAreaMembros();
  });
}

function modalidadeEmoji(id,nome=''){
  const p=String(id||'').split('-')[0].toUpperCase();
  const mapa={FUT:'⚽',VOL:'🏐',BAS:'🏀',HAN:'🤾',NAT:'🏊',ATL:'🏃',TEN:'🎾',XAD:'♟️'};
  if(mapa[p]) return mapa[p];
  const n=String(nome||'').toUpperCase();
  if(n.includes('FUT'))return '⚽'; if(n.includes('VÔLE')||n.includes('VOLE'))return '🏐'; if(n.includes('BASQ'))return '🏀'; if(n.includes('HAND'))return '🤾';
  return '🏅';
}
function perfilAtual(){
  try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')||{};}catch(e){return {};}
}
function renderizarModalidadesPerfil(){
  const grid=$('#sportGrid'); if(!grid)return;
  const p=perfilAtual();
  const antigos=new Set((p.sports||[]).map(x=>MODALIDADE_IDS[x]||x));
  const selecionados=new Set((p.sportIds||[]).length?p.sportIds:antigos);
  const mods=(apiData.modalidades||[])
    .filter(m=>!('PUBLICADO' in m)||isSim(m.PUBLICADO))
    .sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)||String(a.NOME||'').localeCompare(String(b.NOME||''),'pt-BR'));
  if(!mods.length){grid.innerHTML='<div class="games-empty">Nenhuma modalidade publicada.</div>'; atualizarResumoPerfil(); return;}
  grid.innerHTML=mods.map(m=>{
    const id=m.ID_MODALIDADE||''; const nome=m.NOME||modalidadeBase(id).nome||id; const naipe=m.NAIPE||'';
    return `<label class="sport-choice"><input type="checkbox" data-sport-id="${escapeHtml(id)}" ${selecionados.has(id)?'checked':''}><span class="sport-icon">${modalidadeEmoji(id,nome)}</span><strong>${escapeHtml(nome)}</strong><small>${escapeHtml(naipe)}</small><b>✓</b></label>`;
  }).join('');
  grid.querySelectorAll('input[data-sport-id]').forEach(x=>x.addEventListener('change',atualizarResumoPerfil));
  atualizarResumoPerfil();
}
function atualizarResumoPerfil(){
  const n=$$('#sportGrid input[data-sport-id]:checked').length;
  const count=$('#sportsCount'), summary=$('#profileSummary');
  if(count)count.textContent=`${n} ${n===1?'selecionada':'selecionadas'}`;
  if(summary)summary.textContent=n?`${n} ${n===1?'modalidade selecionada':'modalidades selecionadas'}`:'Escolha suas modalidades';
}
function salvarPerfil(){
  const name=$('#profileNameDisplay');
  const p=perfilAtual();
  p.name=name?.textContent?.trim()||'Guilherme';
  p.sportIds=$$('#sportGrid input[data-sport-id]:checked').map(x=>x.dataset.sportId).filter(Boolean);
  p.sports=p.sportIds.map(id=>modalidadeNome(id)); // compatibilidade com versões anteriores
  ['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>p[k]=!!document.getElementById(k)?.checked);
  localStorage.setItem(PROFILE_KEY,JSON.stringify(p));
  atualizarResumoPerfil(); renderizarJogos(); renderizarProximoJogoHome();
  const feedback=$('#saveFeedback'); if(feedback){feedback.classList.add('show');setTimeout(()=>feedback.classList.remove('show'),2200);}
}
function inicializarPerfil(){
  const p=perfilAtual(); const name=$('#profileNameDisplay');
  if(p.name&&name)name.textContent=p.name;
  ['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>{const e=document.getElementById(k);if(e&&typeof p[k]==='boolean')e.checked=p[k];});
  $('#saveProfileBtn')?.addEventListener('click',salvarPerfil);
  $('#editProfileBtn')?.addEventListener('click',()=>{const v=prompt('Como você quer aparecer no app?',name?.textContent||'Guilherme');if(v&&v.trim()){name.textContent=v.trim();salvarPerfil();}});
  atualizarResumoPerfil();
}
inicializarPerfil();


/* Eventos via Painel Administrativo (Google Sheets / Apps Script) */
const EVENTS_API='https://script.google.com/macros/s/AKfycbwanjoMA8Kd9pdtGWlraMN7agGTdlY_8zMaXBQQQL_7zRBPwZltu8oVMfUQFHgAQOKzbA/exec';
let cctEvents=[];
function eventDateValue(e){const p=(e.DATA||'').split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0],...(e.HORA||'00:00').split(':').map(Number)).getTime():Number.MAX_SAFE_INTEGER}
function eventMeta(e){return [e.DATA,e.HORA,e.LOCAL].filter(Boolean).join(' • ')}
function normalizeImageUrl(url){
  const raw=String(url||'').trim();
  if(!raw)return '';

  // Link comum do Google Drive: /file/d/ID/view...
  const driveFile=raw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if(driveFile)return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFile[1])}=w1600`;

  // Outros links do Drive que usam ?id=ID
  try{
    const u=new URL(raw);
    if(/(^|\.)drive\.google\.com$/i.test(u.hostname)){
      const id=u.searchParams.get('id');
      if(id)return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1600`;
    }
  }catch(e){}

  return raw;
}
function eventCard(e,home=false){const img=normalizeImageUrl(e.IMAGEM_URL)||'assets/evento-verde.jpg';const badge=e.DESTAQUE==='SIM'?'DESTAQUE':(e.STATUS||e.TIPO||'EVENTO');return `<article class="event-card ${home?'':'large'} dynamic-event" style="--event:url('${img.replace(/'/g,"%27")}')"><div class="event-gradient"></div><div class="event-copy"><span class="chip ${e.DESTAQUE==='SIM'?'live':''}">${badge}</span><h4>${escapeHtml(e.NOME||'Evento CCT')}</h4><p>${escapeHtml(eventMeta(e))}</p>${e.AVISO?`<small class="event-alert">${escapeHtml(e.AVISO)}</small>`:''}<button class="light" data-event-id="${escapeHtml(e.ID_EVENTO||'')}">VER DETALHES ›</button></div></article>`}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showEventDetails(id){const e=cctEvents.find(x=>x.ID_EVENTO===id);if(!e)return;const body=document.getElementById('modalContent');if(!body)return;body.innerHTML=`<span class="chip live">${escapeHtml(e.STATUS||e.TIPO||'EVENTO')}</span><h2>${escapeHtml(e.NOME)}</h2>${normalizeImageUrl(e.IMAGEM_URL)?`<img class="event-modal-image" src="${escapeHtml(normalizeImageUrl(e.IMAGEM_URL))}" alt="${escapeHtml(e.NOME)}">`:''}<div class="event-detail-list"><div><b>📅 Data</b><span>${escapeHtml(e.DATA)}${e.DATA_FIM?` até ${escapeHtml(e.DATA_FIM)}`:''}</span></div><div><b>🕒 Horário</b><span>${escapeHtml(e.HORA)}${e.HORA_FIM?` às ${escapeHtml(e.HORA_FIM)}`:''}</span></div><div><b>📍 Local</b><span>${escapeHtml(e.LOCAL)}${e.ENDERECO?`<small>${escapeHtml(e.ENDERECO)}</small>`:''}</span></div></div>${e.DESCRICAO?`<p>${escapeHtml(e.DESCRICAO)}</p>`:''}${e.AVISO?`<div class="event-notice">${escapeHtml(e.AVISO)}</div>`:''}<div class="event-actions">${e.LINK_MAPS?`<a class="ghost event-action" href="${escapeHtml(e.LINK_MAPS)}" target="_blank" rel="noopener">ABRIR MAPA</a>`:''}${e.LINK_COMPRA?`<a class="primary event-action" href="${escapeHtml(e.LINK_COMPRA)}" target="_blank" rel="noopener">${escapeHtml(e.TEXTO_BOTAO||'SAIBA MAIS')}</a>`:''}</div>`;document.getElementById('modal')?.classList.add('open')}
function bindEventButtons(){document.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>showEventDetails(b.dataset.eventId)))}
async function loadCctEvents(){const all=document.getElementById('eventsContainer'),home=document.getElementById('homeEventContainer');try{const r=await fetch(EVENTS_API,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();if(!data.sucesso)throw new Error(data.erro||'API');cctEvents=(data.eventos||[]).sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)||eventDateValue(a)-eventDateValue(b));if(all)all.innerHTML=cctEvents.length?cctEvents.map(e=>eventCard(e)).join(''):'<div class="event-empty">Nenhum evento publicado no momento.</div>';const featured=cctEvents.find(e=>e.DESTAQUE==='SIM')||cctEvents[0];if(home)home.innerHTML=featured?eventCard(featured,true):'<div class="event-empty">Novos eventos em breve.</div>';bindEventButtons()}catch(err){console.error('Eventos:',err);const msg='<div class="event-error">Não foi possível atualizar os eventos agora.<small>Tente novamente em instantes.</small></div>';if(all)all.innerHTML=msg;if(home)home.innerHTML=msg}}
// Eventos agora são carregados junto com a API principal.


/* v22 — módulos administrativos dinâmicos */
function dataVal(v,h='00:00'){ return parseBrDate(v,h)?.getTime() || Number.MAX_SAFE_INTEGER; }
function isSim(v){ return String(v||'').trim().toUpperCase()==='SIM'; }
function visibilidade(v){ return String(v||'').trim().toUpperCase(); }
function ehMembros(x){ return visibilidade(x?.VISIBILIDADE)==='MEMBROS'; }
function ehPublico(x){ return !ehMembros(x); } // compatível com registros antigos sem VISIBILIDADE
function somentePublicos(arr){ return (arr||[]).filter(ehPublico); }
function somenteMembros(arr){ return (arr||[]).filter(ehMembros); }
function categoriaTem(valor, termos=[]){
  const c=String(valor||'').trim().toUpperCase();
  return termos.some(t=>c.includes(String(t).toUpperCase()));
}
function linkSeguro(v){ const x=String(v||'').trim(); return /^https?:\/\//i.test(x)?x:''; }
function agendaIcon(tipo){ const t=String(tipo||'').toUpperCase(); if(t.includes('TREINO'))return '🏃'; if(t.includes('ATEND'))return '🏠'; if(t.includes('REUNI'))return '👥'; if(t.includes('JOGO'))return '🏆'; return '📅'; }
function agendaItemHtml(a){
  const mod=a.ID_MODALIDADE?modalidadeNome(a.ID_MODALIDADE):'';
  const local=a.LOCAL||a.ENDERECO||'';
  return `<div class="agenda-row"><time>${escapeHtml(a.HORA_INICIO||'--:--')}</time><span class="dot"></span><section><div class="agenda-card-head"><small>${escapeHtml(a.TIPO||'AGENDA')}</small><span>${agendaIcon(a.TIPO)}</span></div><strong>${escapeHtml(a.TITULO||mod||'Compromisso CCT')}</strong>${mod&&a.TITULO!==mod?`<em>${escapeHtml(mod)}</em>`:''}${local?`<p>📍 ${escapeHtml(local)}</p>`:''}${a.DESCRICAO?`<p>${escapeHtml(a.DESCRICAO)}</p>`:''}${linkSeguro(a.LINK_MAPS)?`<a href="${escapeHtml(a.LINK_MAPS)}" target="_blank" rel="noopener">ABRIR MAPA ›</a>`:''}</section></div>`;
}
function rotuloDataAgenda(data){
  const d=parseBrDate(data); if(!d)return data||''; const hoje=new Date(); const amanha=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()+1);
  const base=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','').toUpperCase();
  if(sameDay(d,hoje))return `HOJE • ${base}`; if(sameDay(d,amanha))return `AMANHÃ • ${base}`;
  const dia=d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').toUpperCase(); return `${dia} • ${base}`;
}
function agendaAgrupadaHtml(linhas){
  let atual=''; return linhas.map(a=>{const d=a.DATA||''; const sep=d!==atual?`<div class="agenda-date-separator"><span>${escapeHtml(rotuloDataAgenda(d))}</span></div>`:''; atual=d; return sep+agendaItemHtml(a);}).join('');
}
function renderizarAgenda(){
  const c=$('#agendaContainer'); if(!c)return;
  const linhas=somentePublicos(apiData.agenda).sort((a,b)=>dataVal(a.DATA,a.HORA_INICIO)-dataVal(b.DATA,b.HORA_INICIO));
  c.innerHTML=linhas.length?agendaAgrupadaHtml(linhas):'<div class="games-empty">Nenhum compromisso público na agenda.</div>';
  const h=$('#homeAgendaContainer');
  if(h){
    const hoje=new Date();
    let itens=linhas.filter(a=>sameDay(parseBrDate(a.DATA,a.HORA_INICIO),hoje));
    const temHoje=itens.length>0;
    if(!itens.length) itens=linhas.filter(a=>dataVal(a.DATA,a.HORA_INICIO)>=Date.now()).slice(0,3);
    const homeTitle=$('#homeAgendaTitle'); if(homeTitle) homeTitle.textContent=temHoje?'AGENDA DE HOJE':'PRÓXIMOS NA AGENDA';
    h.innerHTML=itens.length?itens.slice(0,3).map(agendaItemHtml).join(''):'<div class="games-empty">Nada na agenda pública por enquanto.</div>';
  }
}
function avisosAtivos(escopo='publico'){
  const now=Date.now();
  const base=escopo==='membros'?somenteMembros(apiData.avisos):somentePublicos(apiData.avisos);
  return base.filter(a=>{
    const ini=a.DATA_INICIO?dataVal(a.DATA_INICIO,a.HORA_INICIO||'00:00'):0;
    const fim=a.DATA_FIM?dataVal(a.DATA_FIM,a.HORA_FIM||'23:59'):Number.MAX_SAFE_INTEGER;
    return now>=ini&&now<=fim;
  }).sort((a,b)=>(isSim(b.URGENTE)-isSim(a.URGENTE))||((Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)));
}
function renderizarAvisos(){
 const av=avisosAtivos(); const bell=$('#alertBtn'); if(bell){let b=bell.querySelector('b'); if(b)b.textContent=av.length; bell.classList.toggle('has-alerts',!!av.length);}
 const box=$('#homeUrgentContainer'); if(box){const a=av.find(x=>isSim(x.URGENTE)||isSim(x.DESTAQUE))||av[0]; box.innerHTML=a?`<button class="urgent-card urgent-dynamic" type="button" data-open-alerts><div class="urgent-icon">!</div><div><small>${isSim(a.URGENTE)?'AVISO URGENTE':'AVISO CCT'}</small><strong>${escapeHtml(a.TITULO||'Aviso')}</strong><p>${escapeHtml(a.MENSAGEM||'')}</p></div><span class="arrow">›</span></button>`:''; box.querySelector('[data-open-alerts]')?.addEventListener('click',abrirAvisos);}
}
function abrirAvisos(){ const av=avisosAtivos(); mc.innerHTML=`<span class="chip ${av.some(x=>isSim(x.URGENTE))?'live':''}">${av.length} ${av.length===1?'AVISO':'AVISOS'}</span><h2>🔔 Avisos</h2><div class="modal-list">${av.length?av.map(a=>`<div><strong>${escapeHtml(a.TITULO||'Aviso CCT')}</strong><small>${escapeHtml(a.MENSAGEM||'')}</small>${linkSeguro(a.LINK)?`<a class="content-link" href="${escapeHtml(a.LINK)}" target="_blank" rel="noopener">${escapeHtml(a.TEXTO_BOTAO||'ABRIR')} ›</a>`:''}</div>`).join(''):'<div><strong>Nenhum aviso ativo</strong><small>Quando houver novidades elas aparecerão aqui.</small></div>'}</div>`; modal.classList.add('open'); }
function conteudosHtml(categoria='',escopo='publico'){
  let itens=escopo==='membros'?somenteMembros(apiData.conteudos):somentePublicos(apiData.conteudos);
  const chave=String(categoria||'').toUpperCase();
  if(chave){
    const mapas={
      'DOCUMENT':['DOCUMENT','REGULAMENTO','ARQUIVO'],
      'MID':['MID','FOTO','VIDEO','GALERIA'],
      'FORM':['FORM','PEDIDO','VENDA','KIT','UNIFORME','RETIRADA'],
      'SOBRE':['SOBRE','HISTORIA','INSTITUCIONAL'],
      'PARCEIRO':['PARCEIRO','PATROCIN']
    };
    const termos=mapas[chave]||[chave];
    itens=itens.filter(x=>categoriaTem(x.CATEGORIA,termos));
  }
  return itens.length?itens.map(x=>`<div class="content-item">${normalizeImageUrl(x.IMAGEM_URL)?`<img src="${escapeHtml(normalizeImageUrl(x.IMAGEM_URL))}" alt="">`:''}<div><strong>${escapeHtml(x.TITULO||'Conteúdo')}</strong><small>${escapeHtml(x.DESCRICAO||x.CATEGORIA||'')}</small>${linkSeguro(x.LINK)?`<a class="content-link" href="${escapeHtml(x.LINK)}" target="_blank" rel="noopener">${escapeHtml(x.TEXTO_BOTAO||'ABRIR')} ›</a>`:''}</div></div>`).join(''):'<div><strong>Nenhum conteúdo publicado</strong><small>Cadastre itens compatíveis na aba CONTEUDOS.</small></div>';
}
function abrirConteudos(categoria='',titulo='Conteúdos',escopo='publico'){ mc.innerHTML=`<span class="chip">${escopo==='membros'?'MEMBROS':'CCT'}</span><h2>${escapeHtml(titulo)}</h2><div class="modal-list dynamic-content-list">${conteudosHtml(categoria,escopo)}</div>`; modal.classList.add('open'); closeDrawer(); }
function abrirLocais(escopo='publico'){
  const itens=escopo==='membros'?somenteMembros(apiData.locais):somentePublicos(apiData.locais);
  mc.innerHTML=`<span class="chip">${escopo==='membros'?'MEMBROS':'LOCAIS'}</span><h2>${escopo==='membros'?'Locais internos':'Onde precisamos estar?'}</h2><div class="modal-list dynamic-content-list">${itens.length?itens.map(x=>`<div class="content-item">${normalizeImageUrl(x.IMAGEM_URL)?`<img src="${escapeHtml(normalizeImageUrl(x.IMAGEM_URL))}" alt="">`:''}<div><strong>📍 ${escapeHtml(x.NOME||'Local')}</strong><small>${escapeHtml([x.TIPO,x.ENDERECO,x.OBSERVACAO].filter(Boolean).join(' • '))}</small>${linkSeguro(x.LINK_MAPS)?`<a class="content-link" href="${escapeHtml(x.LINK_MAPS)}" target="_blank" rel="noopener">ABRIR NO MAPA ›</a>`:''}</div></div>`).join(''):'<div><strong>Nenhum local publicado</strong><small>Cadastre locais na aba LOCAIS.</small></div>'}</div>`;
  modal.classList.add('open'); closeDrawer();
}
function abrirContatos(escopo='publico'){
  const base=escopo==='membros'?somenteMembros(apiData.pessoas):somentePublicos(apiData.pessoas);
  const itens=base.filter(x=>String(x.ATIVO||'SIM').toUpperCase()!=='NÃO');
  mc.innerHTML=`<span class="chip">${escopo==='membros'?'MEMBROS':'CONTATOS'}</span><h2>${escopo==='membros'?'Equipe interna':'Fale com a CCT'}</h2><div class="modal-list dynamic-content-list">${itens.length?itens.map(p=>`<div class="person-contact">${normalizeImageUrl(p.FOTO_URL)?`<img src="${escapeHtml(normalizeImageUrl(p.FOTO_URL))}" alt="">`:`<span class="contact-avatar">${escapeHtml((p.NOME||'C').charAt(0))}</span>`}<div><strong>${escapeHtml(p.NOME||'Contato')}</strong><small>${escapeHtml([p.CARGO,p.TIPO].filter(Boolean).join(' • '))}</small>${linkSeguro(p.LINK_WHATSAPP)?`<a class="content-link" href="${escapeHtml(p.LINK_WHATSAPP)}" target="_blank" rel="noopener">WHATSAPP ›</a>`:''}${p.EMAIL?`<a class="content-link" href="mailto:${escapeHtml(p.EMAIL)}">E-MAIL ›</a>`:''}</div></div>`).join(''):'<div><strong>Nenhum contato publicado</strong><small>Cadastre pessoas na aba PESSOAS.</small></div>'}</div>`;
  modal.classList.add('open'); closeDrawer();
}
function renderizarHeroHome(){
  const hero=$('#homeHero'); if(!hero)return;
  const comps=apiData.competicoes.filter(x=>!('PUBLICADO'in x)||isSim(x.PUBLICADO)).sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999));
  const comp=comps.find(x=>isSim(x.DESTAQUE))||comps[0];
  if(!comp)return;
  const img=normalizeImageUrl(comp.IMAGEM_URL)||'assets/volei-praia-2.jpg';
  hero.style.setProperty('--hero',`url('${img.replace(/'/g,"%27")}')`);
  const title=$('#homeHeroTitle'), text=$('#homeHeroText'), badge=$('#homeHeroBadge'), btn=$('#homeHeroButton');
  if(title)title.textContent=competitionName(comp.ID_COMPETICAO);
  if(text)text.textContent='Acompanhe jogos, classificação, destaques e tudo da CCT.';
  if(badge)badge.textContent=isSim(comp.DESTAQUE)?'EM DESTAQUE':(comp.STATUS||'COMPETIÇÃO');
  if(btn)btn.onclick=()=>{jogosUI.competicao=comp.ID_COMPETICAO; jogosUI.aba='jogos'; go('jogos'); const nome=$('#competicaoNome');if(nome)nome.textContent=competitionName(comp.ID_COMPETICAO);renderizarFiltrosModalidades();renderizarSeletorClassificacao();renderizarAbaCompeticao();};
}
function mediaItensPublicos(){
  return somentePublicos(apiData.conteudos).filter(x=>categoriaTem(x.CATEGORIA,['MID','FOTO','VIDEO','GALERIA'])).sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999));
}
function mediaTipoMeta(x){
  const c=String(x.CATEGORIA||'').toUpperCase(); if(c.includes('VIDEO'))return ['▶','ASSISTA AGORA']; if(c.includes('FOTO')||c.includes('GALERIA'))return ['▧','CONFIRA AS FOTOS']; return ['▧','VER CONTEÚDO'];
}
function renderizarMidiaHome(){
  const c=$('#homeMediaContainer'); if(!c)return; const itens=mediaItensPublicos().slice(0,2);
  c.classList.toggle('single-item',itens.length===1);
  if(!itens.length){c.innerHTML='<div class="games-empty media-empty">Nenhum conteúdo de mídia publicado.</div>';return;}
  c.innerHTML=itens.map(x=>{const [ico,cta]=mediaTipoMeta(x);const img=normalizeImageUrl(x.IMAGEM_URL)||'assets/volei-praia-1.jpg';const link=linkSeguro(x.LINK);return `<article class="home-media-card ${link?'is-clickable':''}" style="--media:url('${img.replace(/'/g,"%27")}')" ${link?`data-media-link="${escapeHtml(link)}"`:''}><span>${ico}</span><div><strong>${escapeHtml(x.TITULO||'Mídia CCT')}</strong>${link?`<small>${escapeHtml(x.TEXTO_BOTAO||cta)}</small>`:`<small>${escapeHtml(x.DESCRICAO||'Conteúdo da CCT')}</small>`}</div></article>`;}).join('');
  c.querySelectorAll('[data-media-link]').forEach(el=>el.addEventListener('click',()=>window.open(el.dataset.mediaLink,'_blank','noopener')));
}
function renderizarCompeticoesHome(){ const c=$('#homeCompetitionsContainer'); if(!c)return; const comps=apiData.competicoes.filter(x=>!('PUBLICADO'in x)||isSim(x.PUBLICADO)).sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)); c.innerHTML=comps.length?comps.map(x=>`<article class="visual-card competition-home-card" style="--bg:url('${normalizeImageUrl(x.IMAGEM_URL)||'assets/levantamento-1.jpg'}')" data-home-competition="${escapeHtml(x.ID_COMPETICAO)}"><div><span class="chip ${isSim(x.DESTAQUE)?'live':''}">${escapeHtml(x.STATUS||'COMPETIÇÃO')}</span><h4>${escapeHtml(x.NOME||x.ID_COMPETICAO)}</h4><p>${escapeHtml(x.ANO||'')}</p></div></article>`).join(''):'<div class="games-empty">Nenhuma competição publicada.</div>'; c.querySelectorAll('[data-home-competition]').forEach(el=>el.addEventListener('click',()=>{jogosUI.competicao=el.dataset.homeCompetition; go('jogos'); renderizarFiltrosModalidades();renderizarSeletorClassificacao();renderizarAbaCompeticao();})); }

function abrirAgendaMembros(filtro=''){
  let itens=somenteMembros(apiData.agenda).sort((a,b)=>dataVal(a.DATA,a.HORA_INICIO)-dataVal(b.DATA,b.HORA_INICIO));
  if(filtro==='salinha') itens=itens.filter(a=>categoriaTem([a.TIPO,a.TITULO,a.LOCAL].join(' '),['SALINHA','ATEND']));
  mc.innerHTML=`<span class="chip">MEMBROS</span><h2>${filtro==='salinha'?'🏠 Escala da salinha':'📅 Agenda interna'}</h2><div class="member-agenda-modal">${itens.length?agendaAgrupadaHtml(itens):'<div class="games-empty">Nenhum compromisso interno publicado.</div>'}</div>`;
  modal.classList.add('open');
}
function abrirAvisosMembros(){
  const av=avisosAtivos('membros');
  mc.innerHTML=`<span class="chip ${av.some(x=>isSim(x.URGENTE))?'live':''}">${av.length} ${av.length===1?'AVISO INTERNO':'AVISOS INTERNOS'}</span><h2>🚨 Avisos internos</h2><div class="modal-list">${av.length?av.map(a=>`<div><strong>${escapeHtml(a.TITULO||'Aviso interno')}</strong><small>${escapeHtml(a.MENSAGEM||'')}</small>${linkSeguro(a.LINK)?`<a class="content-link" href="${escapeHtml(a.LINK)}" target="_blank" rel="noopener">${escapeHtml(a.TEXTO_BOTAO||'ABRIR')} ›</a>`:''}</div>`).join(''):'<div><strong>Nenhum aviso interno ativo</strong><small>Os avisos exclusivos para membros aparecerão aqui.</small></div>'}</div>`;
  modal.classList.add('open');
}
function abrirRepresentacoesMembros(){
  const itens=apiData.jogos.filter(j=>String(j.REPRESENTACAO_CCT||'').trim().toUpperCase()==='SIM').sort((a,b)=>(parseBrDate(a.DATA,a.HORA)?.getTime()||0)-(parseBrDate(b.DATA,b.HORA)?.getTime()||0));
  mc.innerHTML=`<span class="chip">MEMBROS</span><h2>🏆 Representações CCT</h2><div>${itens.length?itens.map(j=>matchCard(j)).join(''):'<div class="games-empty">Nenhuma representação CCT cadastrada.</div>'}</div>`;
  modal.classList.add('open');
}
function renderizarAreaMembros(){
  const hoje=new Date();
  const agendaM=somenteMembros(apiData.agenda);
  const hojeCount=agendaM.filter(a=>sameDay(parseBrDate(a.DATA,a.HORA_INICIO),hoje)).length;
  const reps=apiData.jogos.filter(j=>String(j.REPRESENTACAO_CCT||'').trim().toUpperCase()==='SIM');
  const repsFuturas=reps.filter(j=>{const d=parseBrDate(j.DATA,j.HORA);return d && d.getTime()>=Date.now() && !isFinalizado(j);});
  const alertas=avisosAtivos('membros');

  const elHoje=$('#memberTodayCount'), elRep=$('#memberRepCount'), elAv=$('#memberAlertCount');
  if(elHoje) elHoje.textContent=hojeCount;
  if(elRep) elRep.textContent=repsFuturas.length;
  if(elAv) elAv.textContent=alertas.length;

  const lista=$('#memberRepresentationsList');
  if(lista){
    const proximas=repsFuturas.sort((a,b)=>parseBrDate(a.DATA,a.HORA)-parseBrDate(b.DATA,b.HORA)).slice(0,4);
    lista.innerHTML=proximas.length?proximas.map(j=>{
      const nome=String(j.RESPONSAVEL_REPRESENTACAO||'Responsável a definir').trim();
      const foto=normalizeImageUrl(j.FOTO_RESP_REPRESENTACAO||'');
      const iniciais=nome.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
      return `<div>${foto?`<img src="${escapeHtml(foto)}" alt="">`:`<div class="avatar-placeholder">${escapeHtml(iniciais||'CCT')}</div>`}<span><strong>${escapeHtml(nome)}</strong><small>${escapeHtml(modalidadeNome(j.ID_MODALIDADE))} • ${escapeHtml(j.DATA||'')} ${escapeHtml(j.HORA||'')}</small></span></div>`;
    }).join(''):'<div class="games-empty">Nenhuma representação futura cadastrada.</div>';
  }
}
function bindAreaMembros(){
  $$('[data-member-open]').forEach(b=>{
    b.onclick=()=>{
      const t=b.dataset.memberOpen;
      if(t==='agenda') return abrirAgendaMembros();
      if(t==='salinha') return abrirAgendaMembros('salinha');
      if(t==='representacoes') return abrirRepresentacoesMembros();
      if(t==='docs') return abrirConteudos('DOCUMENT','Documentos internos','membros');
      if(t==='avisos') return abrirAvisosMembros();
      if(t==='pessoas') return abrirContatos('membros');
      if(t==='locais') return abrirLocais('membros');
      if(t==='forms') return abrirConteudos('FORM','Forms e pedidos','membros');
    };
  });
}

function renderizarModulosGerais(){ renderizarAgenda(); renderizarAvisos(); renderizarHeroHome(); renderizarCompeticoesHome(); renderizarMidiaHome(); renderizarModalidadesPerfil(); renderizarAreaMembros(); if(apiData.eventos.length){cctEvents=apiData.eventos.sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)||eventDateValue(a)-eventDateValue(b)); const all=$('#eventsContainer'),home=$('#homeEventContainer'); if(all)all.innerHTML=cctEvents.length?cctEvents.map(e=>eventCard(e)).join(''):'<div class="event-empty">Nenhum evento publicado no momento.</div>'; const featured=cctEvents.find(e=>isSim(e.DESTAQUE))||cctEvents[0]; if(home)home.innerHTML=featured?eventCard(featured,true):'<div class="event-empty">Novos eventos em breve.</div>'; bindEventButtons(); } }
function abrirAjuda(){
  const contato=somentePublicos(apiData.pessoas).find(p=>String(p.ATIVO||'SIM').toUpperCase()!=='NÃO' && (linkSeguro(p.LINK_WHATSAPP)||p.EMAIL));
  const contatoHtml=contato?(linkSeguro(contato.LINK_WHATSAPP)?`<a class="help-contact" href="${escapeHtml(contato.LINK_WHATSAPP)}" target="_blank" rel="noopener">💬 FALAR COM A ATLÉTICA ›</a>`:`<a class="help-contact" href="mailto:${escapeHtml(contato.EMAIL)}">✉ FALAR COM A ATLÉTICA ›</a>`):'';
  mc.innerHTML=`<span class="chip">AJUDA</span><h2>Como usar a ATLÉTICA CCT</h2><div class="help-sections"><section><strong>📲 Instalar no celular</strong><p><b>iPhone:</b> abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.<br><b>Android:</b> abra no Chrome e use “Adicionar à tela inicial” ou “Instalar app”.</p></section><section><strong>⭐ Personalizar seu perfil</strong><p>Em Perfil, selecione as modalidades que você joga ou acompanha. “Só meus esportes” prioriza seus jogos e informações.</p></section><section><strong>🏆 Jogos e competições</strong><p>Use Jogos para acompanhar partidas, classificação, cenários e destaques de cada campeonato.</p></section><section><strong>🔔 Avisos</strong><p>O sino reúne avisos ativos. Mudanças urgentes de horário, local e informações importantes aparecem em destaque.</p></section><section><strong>🔒 Área da Atlética</strong><p>É destinada aos membros para agenda interna, representações, documentos, avisos, equipe e formulários.</p></section></div>${contatoHtml}`;
  modal.classList.add('open'); closeDrawer();
}
// Conecta atalhos do menu aos dados do Sheets.
document.querySelectorAll('[data-open="docs"]').forEach(b=>b.onclick=()=>abrirConteudos('DOCUMENT','Documentos'));
document.querySelectorAll('[data-open="media"]').forEach(b=>b.onclick=()=>abrirConteudos('MID','Mídia CCT'));
document.querySelectorAll('[data-open="forms"]').forEach(b=>b.onclick=()=>abrirConteudos('FORM','Pedidos e Formulários'));
document.querySelectorAll('[data-open="places"]').forEach(b=>b.onclick=()=>abrirLocais('publico'));
document.querySelectorAll('[data-open="contacts"]').forEach(b=>b.onclick=()=>abrirContatos('publico'));
document.querySelectorAll('[data-open="help"]').forEach(b=>b.onclick=abrirAjuda);
document.querySelectorAll('[data-open="about"]').forEach(b=>b.onclick=()=>{
  const html=conteudosHtml('SOBRE','publico');
  if(!html.includes('Nenhum conteúdo publicado')) return abrirConteudos('SOBRE','Sobre a Atlética','publico');
  openModal('about');
});
document.querySelectorAll('[data-open="partners"]').forEach(b=>b.onclick=()=>{
  const html=conteudosHtml('PARCEIRO','publico');
  if(!html.includes('Nenhum conteúdo publicado')) return abrirConteudos('PARCEIRO','Quem fortalece a CCT','publico');
  openModal('partners');
});
bindAreaMembros();
