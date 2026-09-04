const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function uiIcon(name,extraClass=''){
  const safe=String(name||'').replace(/[^a-z0-9-]/gi,'');
  const cls=['ui-icon',extraClass].filter(Boolean).join(' ');
  return `<svg class="${cls}" aria-hidden="true"><use href="#i-${safe}"></use></svg>`;
}

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

const MODALIDADE_NOMES_GERAL = {
  'ATL-F':'Atletismo Feminino',
  'ATL-M':'Atletismo Masculino',
  'BAS-F':'Basquete Feminino',
  'BAS-M':'Basquete Masculino',
  'FUT-F':'Futsal Feminino',
  'FUT-M':'Futsal Masculino',
  'HAN-F':'Handebol Feminino',
  'HAN-M':'Handebol Masculino',
  'VOL-F':'Voleibol Feminino',
  'VOL-M':'Voleibol Masculino',
  'NAT-F':'Natação Feminina',
  'NAT-M':'Natação Masculina'
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


/* V3.8 — autenticação e autorização */
var cctAuthState = {
  configured:false,
  ready:false,
  user:null,
  pessoa:null,
  socio:false,
  membro:false,
  error:''
};

function emailNormalizado(v){ return String(v||'').trim().toLowerCase(); }
function firebaseConfigurado(){
  const c=window.CCT_FIREBASE_CONFIG||{};
  return !!(c.apiKey && c.authDomain && c.projectId && c.appId && !String(c.apiKey).includes('COLE_'));
}
function pessoaAtivaAuth(p){ return !p || !('ATIVO' in p) || String(p.ATIVO||'SIM').trim().toUpperCase()!=='NÃO'; }
function pessoaMembroAprovada(p){
  if(!p) return false;
  // V3.8.1: acesso interno depende exclusivamente da autorização explícita
  // da diretoria na coluna MEMBRO_ATLETICA. O campo TIPO é apenas cadastral.
  const flag=campoPessoa(p,'MEMBRO_ATLETICA','MEMBRO_ATLÉTICA');
  return isSim(flag);
}
function authSocioAprovado(){ return !!(cctAuthState.ready && cctAuthState.user && cctAuthState.socio); }
function authMembroAprovado(){ return !!(cctAuthState.ready && cctAuthState.user && cctAuthState.membro); }
function authLogado(){ return !!cctAuthState.user; }

function resolverPermissoesAuth(){
  const email=emailNormalizado(cctAuthState.user?.email);
  const pessoa=email ? (apiData.pessoas||[]).find(p=>pessoaAtivaAuth(p) && emailNormalizado(campoPessoa(p,'EMAIL','E_MAIL','E-MAIL'))===email) : null;
  cctAuthState.pessoa=pessoa||null;
  cctAuthState.socio=!!(pessoa && pessoaSocioAprovada(pessoa));
  cctAuthState.membro=!!(pessoa && pessoaMembroAprovada(pessoa));
  atualizarInterfaceAuth();
}

function statusAcessoHtml(){
  if(!cctAuthState.configured) return '<span class="access-badge warning">LOGIN A CONFIGURAR</span>';
  if(!authLogado()) return '';
  const partes=[];
  if(authSocioAprovado()) partes.push('<span class="access-badge socio">SÓCIO(A) CCT</span>');
  if(authMembroAprovado()) partes.push('<span class="access-badge membro">MEMBRO DA ATLÉTICA</span>');
  if(!partes.length) partes.push('<span class="access-badge connected">CONTA CONECTADA</span>');
  return partes.join('');
}

function atualizarInterfaceAuth(){
  const badges=document.querySelector('#profileAccessBadges');
  if(badges) badges.innerHTML=statusAcessoHtml();
  atualizarAcessoAreaMembros();
  try{ if(typeof renderizarAgenda==='function' && document.querySelector('[data-screen="agenda"]')?.classList.contains('active')) renderizarAgenda(); }catch(e){}
}

function atualizarAcessoAreaMembros(){
  const lock=document.querySelector('#memberLock');
  const dash=document.querySelector('#memberDashboard');
  const login=document.querySelector('#memberLoginBtn');
  const logout=document.querySelector('#memberLogoutBtn');
  const text=document.querySelector('#memberLockText');
  const account=document.querySelector('#memberAuthAccount');
  if(!lock||!dash) return;

  if(authMembroAprovado()){
    lock.hidden=true; dash.hidden=false;
    if(typeof renderizarAreaMembros==='function') renderizarAreaMembros();
    return;
  }
  lock.hidden=false; dash.hidden=true;

  if(!cctAuthState.configured){
    if(text) text.textContent='O login da V3.8 ainda precisa receber a configuração do Firebase. O restante do app continua público normalmente.';
    if(login){login.hidden=false;login.textContent='CONFIGURAR LOGIN';login.disabled=true;}
    if(logout) logout.hidden=true;
    if(account) account.hidden=true;
    return;
  }
  if(!authLogado()){
    if(text) text.textContent='Entre com sua conta Google. O acesso só será liberado quando o mesmo e-mail estiver autorizado pela Atlética no painel administrativo.';
    if(login){login.hidden=false;login.disabled=false;login.textContent='ENTRAR COM GOOGLE';}
    if(logout) logout.hidden=true;
    if(account) account.hidden=true;
    return;
  }
  const email=cctAuthState.user?.email||'';
  if(text) text.textContent='Sua conta está conectada, mas este e-mail ainda não possui autorização de membro da Atlética.';
  if(login) login.hidden=true;
  if(logout) logout.hidden=false;
  if(account){account.hidden=false;account.innerHTML=`<strong>${escapeHtml(cctAuthState.user?.displayName||'Conta Google')}</strong><span>${escapeHtml(email)}</span><small>${authSocioAprovado()?'Sócio(a) CCT validado • ':''}Aguardando autorização de membro</small>`;}
}

async function entrarComGoogleCCT(){
  if(!cctAuthState.configured || !window.firebase?.auth) return;
  const provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try{
    await firebase.auth().signInWithPopup(provider);
  }catch(err){
    const code=String(err?.code||'');
    if(code.includes('popup-blocked')||code.includes('operation-not-supported')||code.includes('cancelled-popup-request')){
      try{ await firebase.auth().signInWithRedirect(provider); }catch(e){ console.error('Login CCT:',e); }
    }else if(!code.includes('popup-closed-by-user')){
      console.error('Login CCT:',err);
      cctAuthState.error=err?.message||'Não foi possível entrar.';
    }
  }
}
async function sairContaCCT(){
  if(window.firebase?.auth){ try{await firebase.auth().signOut();}catch(e){console.error('Logout CCT:',e);} }
}
function inicializarAutenticacaoCCT(){
  cctAuthState.configured=firebaseConfigurado();
  if(!cctAuthState.configured || !window.firebase?.initializeApp){
    cctAuthState.ready=true; atualizarInterfaceAuth(); return;
  }
  try{
    if(!firebase.apps.length) firebase.initializeApp(window.CCT_FIREBASE_CONFIG);
    firebase.auth().useDeviceLanguage();
    firebase.auth().getRedirectResult().catch(()=>{});
    firebase.auth().onAuthStateChanged(user=>{
      cctAuthState.user=user||null;
      cctAuthState.ready=true;
      resolverPermissoesAuth();
    });
  }catch(e){
    console.error('Firebase CCT:',e);
    cctAuthState.error=e?.message||String(e);
    cctAuthState.ready=true;
    atualizarInterfaceAuth();
  }
}

let jogosUI = {
  competicao: 'INTERLAJE-2026',
  tipo: 'todos',
  dataFiltro: 'todos',
  modalidadeFiltro: '',
  aba: 'jogos',
  classificacaoModalidade: '',
  classificacaoTipo: 'modalidade',
  cenariosTipo: 'modalidade'
};

let agendaUI = {
  modo: 'geral' // geral | minha
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

function profileSportIds(){
  try{
    const p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');
    if(Array.isArray(p?.sportIds) && p.sportIds.length) return p.sportIds.filter(Boolean);
    return (p?.sports||[]).map(x=>MODALIDADE_IDS[x]||x).filter(Boolean);
  }catch(e){ return []; }
}

function selectedSportIds(){
  try{
    const p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')||{};
    if(p.onlyMySports===false) return [];
    return profileSportIds();
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

function pessoaJogoHtml(nome,foto,titulo,classe='',pendente=''){
  nome=String(nome||'').trim();
  foto=normalizeImageUrl(foto||'');
  if(!nome){
    if(!pendente) return '';
    return `<div class="representation-pending ${classe}"><small>${escapeHtml(titulo)}</small><strong>${escapeHtml(pendente)}</strong></div>`;
  }
  const iniciais=nome.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  return `
    <div class="match-representative ${classe}">
      ${foto
        ? `<img src="${escapeHtml(foto)}" alt="Foto de ${escapeHtml(nome)}" />`
        : `<div class="representative-placeholder">${escapeHtml(iniciais||'CCT')}</div>`}
      <div><small>${escapeHtml(titulo)}</small><strong>${escapeHtml(nome)}</strong></div>
    </div>`;
}

function representanteModalidadeDados(jogo){
  return {
    nome:String(jogo.REPRESENTANTE || jogo.RESPONSAVEL_MODALIDADE || jogo.REPRESENTANTE_MODALIDADE || '').trim(),
    foto:jogo.FOTO_REPRESENTANTE || jogo.FOTO_RESPONSAVEL_MODALIDADE || jogo.FOTO_REPRESENTANTE_MODALIDADE || ''
  };
}

function responsavelRepresentacaoDados(jogo){
  return {
    nome:String(jogo.RESPONSAVEL_REPRESENTACAO || jogo.REPRESENTACAO_RESPONSAVEL || jogo.REPRESENTANTE_CCT || '').trim(),
    foto:jogo.FOTO_RESP_REPRESENTACAO || jogo.FOTO_RESPONSAVEL_REPRESENTACAO || jogo.FOTO_REPRESENTACAO || jogo.FOTO_REPRESENTANTE_CCT || ''
  };
}

function jogoEhRepresentacaoCCT(jogo){
  const marcado=String(jogo.REPRESENTACAO_CCT||'').trim().toUpperCase();
  const resp=responsavelRepresentacaoDados(jogo).nome;
  return marcado==='SIM' || marcado==='S' || marcado==='YES' || marcado==='TRUE' || marcado==='1' || !!resp;
}

function representanteHtml(jogo){
  if(!jogoTemCCT(jogo)) return '';
  const d=representanteModalidadeDados(jogo);
  return pessoaJogoHtml(d.nome,d.foto,'REPRESENTANTE DA MODALIDADE','is-modality-rep','Representante a definir');
}

function representacaoCctHtml(jogo){
  if(!jogoEhRepresentacaoCCT(jogo)) return '';
  const d=responsavelRepresentacaoDados(jogo);
  return pessoaJogoHtml(d.nome,d.foto,'RESPONSÁVEL PELA REPRESENTAÇÃO','is-representation','Responsável a definir');
}

function matchCard(jogo,{home=false}={}){
  const cctA=String(jogo.EQUIPE_A||'').trim().toUpperCase()==='CCT';
  const cctB=String(jogo.EQUIPE_B||'').trim().toUpperCase()==='CCT';
  const fase=jogo.GRUPO ? `GRUPO ${jogo.GRUPO}` : (jogo.FASE||'');
  const status=jogo.STATUS||'';
  const comp=competitionName(jogo.ID_COMPETICAO);
  const modalidade=modalidadeNome(jogo.ID_MODALIDADE);
  const cenario=jogoTemCCT(jogo) ? cenarioDaModalidade(jogo.ID_MODALIDADE) : null;
  const representacao=jogoEhRepresentacaoCCT(jogo);

  return `
    <article class="match-card ${home?'':'compact'} ${jogoTemCCT(jogo)?'is-cct':''} ${representacao?'is-representation-game':''}">
      <div class="match-top">
        <span class="chip">${escapeHtml(modalidade)}</span>
        <span class="match-top-meta">${representacao?'<em>REPRESENTAÇÃO CCT</em>':''}<span class="muted">${escapeHtml(home?comp:fase)}</span></span>
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
        <span>${uiIcon('map-pin','inline-icon')} ${escapeHtml(jogo.LOCAL||'Local a definir')}</span>
        <span>${escapeHtml(jogo.DATA||'')}</span>
      </div>
      ${cenario ? `<button class="scenario-link" type="button" data-open-scenario-modality="${escapeHtml(jogo.ID_MODALIDADE)}">${uiIcon('target','inline-icon')} Situação da classificação <b>›</b></button>` : ''}
      ${representanteHtml(jogo)}
      ${representacaoCctHtml(jogo)}
    </article>`;
}

function jogoCombinaModalidadeBase(jogo,prefixo){
  if(!prefixo) return true;
  const id=String(jogo.ID_MODALIDADE||'');
  return id===prefixo || id.startsWith(prefixo+'-');
}

function jogosDoTipo(){
  const sports=profileSportIds();
  return apiData.jogos
    .filter(j=>j.ID_COMPETICAO===jogosUI.competicao)
    .filter(j=>{
      if(jogosUI.tipo==='representacoes') return jogoEhRepresentacaoCCT(j);
      if(jogosUI.tipo==='meus') return jogoTemCCT(j) && sports.includes(j.ID_MODALIDADE);
      return true;
    });
}

function jogosFiltrados(){
  const now=new Date();
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);

  return jogosDoTipo()
    .filter(j=>jogoCombinaModalidadeBase(j,jogosUI.modalidadeFiltro))
    .filter(j=>{
      if(jogosUI.dataFiltro==='todos') return true;
      const d=parseBrDate(j.DATA,j.HORA);
      if(jogosUI.dataFiltro==='hoje') return sameDay(d,now);
      if(jogosUI.dataFiltro==='amanha') return sameDay(d,tomorrow);
      return true;
    })
    .sort((a,b)=>(parseBrDate(a.DATA,a.HORA)?.getTime()||0)-(parseBrDate(b.DATA,b.HORA)?.getTime()||0));
}

function renderizarFiltrosModalidades(){
  const select=$('#modalidadeFiltro');
  if(!select) return;

  const ids=[...new Set(jogosDoTipo().map(j=>j.ID_MODALIDADE).filter(Boolean))];
  const bases=[];
  const vistos=new Set();

  ids.forEach(id=>{
    const base=modalidadeBase(id);
    if(!base.prefixo || vistos.has(base.prefixo)) return;
    vistos.add(base.prefixo);
    bases.push(base);
  });

  bases.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(jogosUI.modalidadeFiltro && !bases.some(x=>x.prefixo===jogosUI.modalidadeFiltro)) jogosUI.modalidadeFiltro='';

  select.innerHTML=[
    '<option value="">Todas</option>',
    ...bases.map(x=>`<option value="${escapeHtml(x.prefixo)}" ${x.prefixo===jogosUI.modalidadeFiltro?'selected':''}>${escapeHtml(x.nome)}</option>`)
  ].join('');
}

function atualizarContadoresTiposJogos(){
  const todos=apiData.jogos.filter(j=>j.ID_COMPETICAO===jogosUI.competicao);
  const sports=profileSportIds();
  const meus=todos.filter(j=>jogoTemCCT(j) && sports.includes(j.ID_MODALIDADE));
  const reps=todos.filter(j=>jogoEhRepresentacaoCCT(j));
  const mapa={gamesAllCount:todos.length,myGamesCount:meus.length,representationsCount:reps.length};
  Object.entries(mapa).forEach(([id,n])=>{const el=document.getElementById(id);if(el)el.textContent=n;});
}

function resumoJogosTexto(jogos){
  const base=jogos.length===1?'1 jogo':`${jogos.length} jogos`;
  if(jogosUI.tipo==='meus') return `${base} nas suas modalidades`;
  if(jogosUI.tipo==='representacoes'){
    const pendentes=jogos.filter(j=>!responsavelRepresentacaoDados(j).nome).length;
    return pendentes?`${base} • ${pendentes} ${pendentes===1?'responsável pendente':'responsáveis pendentes'}`:`${base} de representação CCT`;
  }
  const cct=jogos.filter(j=>jogoTemCCT(j)).length;
  return cct?`${base} • ${cct} ${cct===1?'jogo da CCT':'jogos da CCT'}`:base;
}

function mensagemVaziaJogos(){
  if(jogosUI.tipo==='meus' && !profileSportIds().length){
    return `<div class="games-empty games-empty-action"><strong>Escolha suas modalidades no Perfil</strong><span>Depois disso, “Meus Jogos” mostra somente as partidas que importam para você.</span><button type="button" data-empty-go-profile>ABRIR PERFIL ›</button></div>`;
  }
  if(jogosUI.tipo==='representacoes') return '<div class="games-empty"><strong>Nenhuma representação CCT encontrada.</strong><span>Quando um jogo exigir presença da Atlética, ele aparecerá aqui com o responsável.</span></div>';
  if(jogosUI.tipo==='meus') return '<div class="games-empty"><strong>Nenhum jogo nas suas modalidades.</strong><span>Tente alterar a data ou o filtro de modalidade.</span></div>';
  return '<div class="games-empty"><strong>Nenhum jogo encontrado.</strong><span>Tente alterar a data ou o filtro de modalidade.</span></div>';
}

function renderizarJogos(){
  const container=$('#jogosContainer');
  if(!container) return;
  renderizarFiltrosModalidades();
  atualizarContadoresTiposJogos();
  $$('#filtrosJogos [data-filtro]').forEach(x=>x.classList.toggle('selected',x.dataset.filtro===jogosUI.dataFiltro));
  $$('#tipoJogos [data-tipo-jogos]').forEach(x=>x.classList.toggle('selected',x.dataset.tipoJogos===jogosUI.tipo));
  const select=$('#modalidadeFiltro');
  if(select) select.value=jogosUI.modalidadeFiltro||'';

  const jogos=jogosFiltrados();
  const resumo=$('#jogosResumo');
  if(resumo) resumo.textContent=resumoJogosTexto(jogos);
  container.innerHTML=jogos.length ? jogos.map(j=>matchCard(j)).join('') : mensagemVaziaJogos();
  container.querySelector('[data-empty-go-profile]')?.addEventListener('click',()=>go('perfil'));
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
  )].sort((a,b)=>modalidadeNome(a).localeCompare(modalidadeNome(b),'pt-BR'));
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
  if(!ids.includes(jogosUI.classificacaoModalidade)){
    const preferida=profileSportIds().find(id=>ids.includes(id));
    jogosUI.classificacaoModalidade=preferida||ids[0];
  }
  select.innerHTML=ids.map(id=>`<option value="${escapeHtml(id)}" ${id===jogosUI.classificacaoModalidade?'selected':''}>${escapeHtml(modalidadeNome(id))}</option>`).join('');
}

function classificacaoGrupoHtml(grupo,linhas){
  const ordenadas=[...linhas].sort((a,b)=>(Number(a.POSICAO)||999)-(Number(b.POSICAO)||999));
  const linhaMobile=r=>{
    const destaque=String(r.DESTAQUE_CCT||'').toUpperCase()==='SIM' || String(r.EQUIPE||'').toUpperCase()==='CCT';
    const saldo=String(r.SALDO??'').trim();
    const saldoTxt=saldo===''?'—':saldo;
    return `<div class="standing-mobile-row ${destaque?'cct-standing':''}">
      <span class="standing-mobile-pos">${escapeHtml(r.POSICAO||'—')}</span>
      <div class="standing-mobile-team">
        <strong>${escapeHtml(r.EQUIPE||'')}</strong>
        <small>J ${escapeHtml(r.JOGOS||'0')} · V ${escapeHtml(r.VITORIAS||'0')} · E ${escapeHtml(r.EMPATES||'0')} · D ${escapeHtml(r.DERROTAS||'0')} · Saldo ${escapeHtml(saldoTxt)}</small>
      </div>
      <div class="standing-mobile-points"><b>${escapeHtml(r.PONTOS||'0')}</b><small>PTS</small></div>
    </div>`;
  };
  return `
    <section class="classification-group">
      <div class="classification-group-title">
        <strong>${escapeHtml(grupo ? `Grupo ${grupo}` : 'Classificação')}</strong>
        <small>${ordenadas.length} equipes</small>
      </div>
      <div class="standings-mobile" aria-label="Classificação compacta">
        ${ordenadas.map(linhaMobile).join('')}
      </div>
      <div class="standings standings-wide standings-desktop">
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

function parseDetalhamentoGeral(r){
  const raw=String(r?.DETALHAMENTO_JSON||'').trim();
  if(raw){
    try{
      const itens=JSON.parse(raw);
      if(Array.isArray(itens)) return itens;
    }catch(e){}
  }
  return [];
}

function classificacaoGeralHtml(){
  const linhas=apiData.classificacao_geral
    .filter(x=>x.ID_COMPETICAO===jogosUI.competicao)
    .sort((a,b)=>(Number(a.POSICAO)||999)-(Number(b.POSICAO)||999));
  if(!linhas.length) return '';

  const maiorConfirmado=Math.max(0,...linhas.map(r=>numeroCenarioGeral(r.PONTOS)??0));
  const haConfirmados=maiorConfirmado>0;

  return `
    <section class="general-ranking general-ranking-v45">
      <div class="general-ranking-head-v45">
        <div>
          <small>GERAL DA COMPETIÇÃO</small>
          <h3>Classificação geral</h3>
          <p>${haConfirmados
            ? 'Pontuação confirmada até o momento. Toque em uma atlética para ver a composição.'
            : 'A pontuação final ainda não começou a ser consolidada. As faixas projetadas já estão sendo calculadas.'}</p>
        </div>
        <span>${uiIcon('trophy')}</span>
      </div>

      <div class="general-ranking-list general-ranking-list-v45">
        ${linhas.map((r,idx)=>{
          const cct=String(r.DESTAQUE_CCT||'').toUpperCase()==='SIM' || String(r.EQUIPE||'').toUpperCase()==='CCT';
          const pts=numeroCenarioGeral(r.PONTOS)??0;
          const pmin=numeroCenarioGeral(r.PONTOS_MINIMOS);
          const pmax=numeroCenarioGeral(r.PONTOS_MAXIMOS);
          const pos=haConfirmados?(Number(r.POSICAO)||idx+1):'—';
          const faixa=(pmin!==null && pmax!==null)?`${pmin}–${pmax} pts`:'Faixa em cálculo';
          const medalhas=[
            Number(r.OUROS)>0?`${r.OUROS}× 1º`:null,
            Number(r.PRATAS)>0?`${r.PRATAS}× 2º`:null,
            Number(r.BRONZES)>0?`${r.BRONZES}× 3º`:null
          ].filter(Boolean).join(' • ');
          return `<button type="button" class="general-ranking-row-v45 ${cct?'cct-general':''}" data-general-team="${escapeHtml(r.EQUIPE||'')}">
            <span class="general-rank-pos">${escapeHtml(pos)}</span>
            <span class="general-rank-main">
              <strong>${escapeHtml(r.EQUIPE||'')}</strong>
              <small>${medalhas||'Toque para ver modalidade por modalidade'}</small>
            </span>
            <span class="general-rank-score">
              <b>${escapeHtml(pts)}</b>
              <small>confirmados</small>
              <em>${escapeHtml(faixa)}</em>
            </span>
            <span class="general-rank-chevron">${uiIcon('chevron')}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
}

function abrirDetalheClassificacaoGeral(equipe){
  const r=apiData.classificacao_geral.find(x=>
    x.ID_COMPETICAO===jogosUI.competicao &&
    String(x.EQUIPE||'').trim().toUpperCase()===String(equipe||'').trim().toUpperCase()
  );
  if(!r) return;

  const itens=parseDetalhamentoGeral(r);
  const pts=numeroCenarioGeral(r.PONTOS)??0;
  const pmin=numeroCenarioGeral(r.PONTOS_MINIMOS);
  const pmax=numeroCenarioGeral(r.PONTOS_MAXIMOS);
  const bonus=numeroCenarioGeral(r.BONUS_ABERTURA_APLICADO)??0;
  const ajuste=numeroCenarioGeral(r.AJUSTE_MANUAL_APLICADO)??0;
  const modalidadePts=numeroCenarioGeral(r.PONTOS_MODALIDADES_CONFIRMADOS)??Math.max(0,pts-bonus-ajuste);
  const cct=String(r.EQUIPE||'').trim().toUpperCase()==='CCT';

  const individuais=itens.filter(i=>i.individual);
  const coletivas=itens.filter(i=>!i.individual);

  const statusHtml=i=>{
    const nome=i.nome||MODALIDADE_NOMES_GERAL[i.id]||i.id||'Modalidade';
    let detalhe='',cls='';
    if(i.status==='CONFIRMADO'){
      detalhe=`${i.posicao}º lugar • ${i.pontos} pts`;
      cls='confirmed';
    }else if(i.status==='NAO_PARTICIPOU'){
      detalhe='Não participou';
      cls='muted';
    }else if(i.status==='PENDENTE'){
      detalhe='Aguardando resultado oficial';
      cls='pending';
    }else{
      const a=i.posMin??'—',b=i.posMax??'—';
      const p1=i.pontosMin??'—',p2=i.pontosMax??'—';
      detalhe=`${a}º–${b}º • ${p1}–${p2} pts`;
      cls='open';
    }
    return `<div class="general-breakdown-item ${cls}">
      <span>${i.individual?uiIcon('running'):uiIcon('trophy')}</span>
      <div><strong>${escapeHtml(nome)}</strong><small>${escapeHtml(detalhe)}</small></div>
      ${i.status==='CONFIRMADO'?`<b>${escapeHtml(i.pontos)}</b>`:''}
    </div>`;
  };

  const body=$('#modalContent');
  if(!body) return;
  body.innerHTML=`
    <span class="chip">CLASSIFICAÇÃO GERAL</span>
    <div class="general-detail-title">
      <span>${uiIcon('trophy')}</span>
      <div>
        <small>${cct?'ATLÉTICA CCT':'ATLÉTICA'}</small>
        <h2>${escapeHtml(r.EQUIPE||'')}</h2>
        <p>Composição automática da pontuação geral.</p>
      </div>
    </div>

    <div class="general-detail-metrics">
      <div><small>CONFIRMADOS</small><strong>${escapeHtml(pts)}</strong></div>
      <div><small>MÍNIMO</small><strong>${escapeHtml(pmin??'—')}</strong></div>
      <div><small>MÁXIMO</small><strong>${escapeHtml(pmax??'—')}</strong></div>
    </div>

    <div class="general-score-origin">
      <div><span>Pontos das modalidades</span><b>${escapeHtml(modalidadePts)}</b></div>
      <div><span>Bônus da abertura confirmado</span><b>${escapeHtml(bonus)}</b></div>
      ${ajuste!==0?`<div><span>Ajuste oficial</span><b>${escapeHtml(ajuste)}</b></div>`:''}
    </div>

    ${individuais.length?`
      <div class="general-detail-section">
        <div class="general-detail-section-head">
          <span>${uiIcon('running')}</span>
          <div><small>RESULTADOS INDIVIDUAIS</small><strong>Atletismo e Natação</strong></div>
        </div>
        <div class="general-breakdown-list">${individuais.map(statusHtml).join('')}</div>
      </div>`:''}

    ${coletivas.length?`
      <div class="general-detail-section">
        <div class="general-detail-section-head">
          <span>${uiIcon('trophy')}</span>
          <div><small>MODALIDADES COLETIVAS</small><strong>Situação por esporte</strong></div>
        </div>
        <div class="general-breakdown-list">${coletivas.map(statusHtml).join('')}</div>
      </div>`:''}

    ${!itens.length?`<div class="games-empty">O detalhamento por modalidade ainda não foi publicado pelo motor V4.5.</div>`:''}
  `;
  $('#modal')?.classList.add('open');
}

function ativarDetalhesClassificacaoGeral(){
  $$('[data-general-team]').forEach(btn=>{
    btn.addEventListener('click',()=>abrirDetalheClassificacaoGeral(btn.dataset.generalTeam));
  });
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
    ativarDetalhesClassificacaoGeral();
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

function numeroCenarioGeral(v){
  if(v===null || v===undefined || String(v).trim()==='') return null;
  const n=Number(String(v).replace(',','.'));
  return Number.isFinite(n)?n:null;
}

function formatarAtualizacaoCenarioGeral(v){
  const raw=String(v||'').trim();
  if(!raw) return '';

  const br=raw.match(/^(\d{2}\/\d{2}\/\d{4})(?:[ T•-]+(\d{1,2}:\d{2})(?::\d{2})?)?/);
  if(br) return br[2]?`${br[1]} • ${br[2]}`:br[1];

  const d=new Date(raw);
  if(!Number.isNaN(d.getTime())){
    const data=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const hora=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return `${data} • ${hora}`;
  }
  return raw;
}

function cenarioGeralHtml(){
  const linhas=apiData.classificacao_geral
    .filter(x=>x.ID_COMPETICAO===jogosUI.competicao)
    .sort((a,b)=>(Number(a.POSICAO)||999)-(Number(b.POSICAO)||999));

  if(!linhas.length){
    return `<div class="games-empty">A classificação geral ainda não foi publicada para esta competição.</div>`;
  }

  const cct=linhas.find(r=>
    String(r.DESTAQUE_CCT||'').trim().toUpperCase()==='SIM' ||
    String(r.EQUIPE||'').trim().toUpperCase()==='CCT'
  );

  if(!cct){
    return `<div class="games-empty">A classificação geral existe, mas a CCT ainda não foi localizada nela.</div>`;
  }

  const pontosConfirmados=linhas.map(r=>numeroCenarioGeral(r.PONTOS)??0);
  const maiorPontuacaoConfirmada=Math.max(0,...pontosConfirmados);
  const haPontuacaoConfirmada=maiorPontuacaoConfirmada>0;
  const lideresConfirmados=haPontuacaoConfirmada
    ? linhas.filter(r=>(numeroCenarioGeral(r.PONTOS)??0)===maiorPontuacaoConfirmada)
    : [];

  const lider=linhas[0];
  const pos=Number(cct.POSICAO)||linhas.indexOf(cct)+1;
  const pts=numeroCenarioGeral(cct.PONTOS) ?? 0;
  const ptsLider=haPontuacaoConfirmada?maiorPontuacaoConfirmada:0;
  const nomeLider=haPontuacaoConfirmada
    ? (lideresConfirmados.length===1
        ? String(lideresConfirmados[0].EQUIPE||'Líder')
        : `${lideresConfirmados.length} equipes empatadas`)
    : 'Aguardando pontuação';
  const diferenca=numeroCenarioGeral(cct.DIFERENCA_LIDER);
  const gap=diferenca!==null?Math.abs(diferenca):Math.max(0,ptsLider-pts);

  const ptsMin=numeroCenarioGeral(cct.PONTOS_MINIMOS);
  const ptsMax=numeroCenarioGeral(cct.PONTOS_MAXIMOS);
  const caminho=String(cct.CAMINHO_TITULO||'').trim();
  const adversarios=String(cct.ADVERSARIOS_CRITICOS||'').trim();
  const status=String(cct.STATUS_TITULO||'').trim();
  const cenarioRaw=String(cct.CENARIO_GERAL||'').trim();
  const cenario=cenarioRaw
    .replace(/Principal ameaça atual:/gi,'Maior teto projetado no momento:')
    .replace(/Principal ameaca atual:/gi,'Maior teto projetado no momento:');
  const precisa=String(cct.O_QUE_PRECISA_TITULO||cct.O_QUE_PRECISA||'').trim();
  const abertas=String(cct.MODALIDADES_ABERTAS||'').trim();

  const atualizacoes=[cct.ATUALIZADO_CENARIO,cct.ATUALIZADO_EM]
    .map(v=>String(v||'').trim()).filter(Boolean);
  const atualizadoRaw=atualizacoes.find(v=>/\d{1,2}:\d{2}/.test(v)) || atualizacoes[0] || '';
  const atualizado=formatarAtualizacaoCenarioGeral(atualizadoRaw);

  const textoPendencia=`${precisa} ${caminho}`.toUpperCase();
  const cenarioIncompleto=(
    textoPendencia.includes('PARA GERAR METAS EXATAS') ||
    (textoPendencia.includes('ATLETISMO') && textoPendencia.includes('NATA') && textoPendencia.includes('BONUS'))
  );

  const statusFallback=haPontuacaoConfirmada
    ? (pos===1?'LIDERANÇA ATUAL':'TÍTULO EM DISPUTA')
    : 'TÍTULO EM DISPUTA';

  const cenarioFallback=!haPontuacaoConfirmada
    ? `A pontuação geral ainda não começou a ser confirmada. A faixa projetada da CCT é de ${ptsMin??0} a ${ptsMax??0} pontos.`
    : (pos===1
        ? `A CCT lidera a classificação geral com ${pts} ponto${pts===1?'':'s'}.`
        : `A CCT está em ${pos}º lugar, com ${pts} ponto${pts===1?'':'s'}, ${gap} atrás de ${nomeLider}.`);

  const precisaFallback=ptsMax!==null
    ? `O potencial máximo informado para a CCT é ${ptsMax} pontos. O cálculo exato depende também do potencial dos adversários.`
    : `O cenário macro já mostra a situação atual. Para transformar isso em uma conta matemática do título, o motor geral precisa ter os potenciais máximos validados.`;

  const textoIncompleto='Aguardando resultados de Atletismo/Natação e confirmação dos bônus de abertura da CCT e dos principais rivais.';
  const posicaoDisplay=haPontuacaoConfirmada?`${pos}º`:'—';
  const posicaoLegenda=haPontuacaoConfirmada?'posição atual':'posição ainda não definida';
  const liderPontosDisplay=haPontuacaoConfirmada?ptsLider:'—';
  const liderNomeDisplay=haPontuacaoConfirmada?nomeLider:'Aguardando pontuação';

  return `
    <section class="general-scenario-card">
      <div class="general-scenario-hero">
        <div>
          <span class="chip">GERAL DA COMPETIÇÃO</span>
          <small>CAMPEONATO</small>
          <h3>${escapeHtml(status||statusFallback)}</h3>
        </div>
        <div class="general-position ${haPontuacaoConfirmada?'':'is-pending'}">
          <strong>${escapeHtml(posicaoDisplay)}</strong>
          <span>${escapeHtml(posicaoLegenda)}</span>
        </div>
      </div>

      <div class="general-scenario-metrics">
        <div><small>CONFIRMADOS</small><strong>${escapeHtml(pts)}</strong><span>CCT</span></div>
        ${ptsMin!==null?`<div><small>MÍNIMO</small><strong>${escapeHtml(ptsMin)}</strong><span>projetado</span></div>`:''}
        ${ptsMax!==null?`<div><small>MÁXIMO</small><strong>${escapeHtml(ptsMax)}</strong><span>projetado</span></div>`:''}
        <div><small>LÍDER PARCIAL</small><strong>${escapeHtml(liderPontosDisplay)}</strong><span>${escapeHtml(liderNomeDisplay)}</span></div>
      </div>

      <div class="general-scenario-body">
        <div>
          <small>CENÁRIO ATUAL</small>
          <p>${escapeHtml(cenario||cenarioFallback)}</p>
        </div>
        <div class="general-needed ${cenarioIncompleto?'is-incomplete':''}">
          <small>${cenarioIncompleto?'CENÁRIO AINDA INCOMPLETO':'O QUE A CCT PRECISA PARA O TÍTULO'}</small>
          <strong>${escapeHtml(cenarioIncompleto?textoIncompleto:(precisa||precisaFallback))}</strong>
        </div>
        ${(!cenarioIncompleto && caminho)?`<div class="general-path"><small>CAMINHO POR MODALIDADE</small><p>${escapeHtml(caminho)}</p></div>`:''}
        ${adversarios?`<div class="general-rivals"><small>ADVERSÁRIOS CRÍTICOS</small><p>${escapeHtml(adversarios)}</p></div>`:''}
        ${abertas?`<div><small>MODALIDADES COM PONTUAÇÃO A DEFINIR</small><p>${escapeHtml(abertas)}</p></div>`:''}
        ${atualizado?`<div class="general-updated"><small>ATUALIZAÇÃO</small><p>${escapeHtml(atualizado)}</p></div>`:''}
      </div>
    </section>`;
}

function renderizarCenarios(){
  const container=$('#cenariosContainer');
  if(!container) return;

  $$('#cenariosTipo [data-cenarios-tipo]').forEach(btn=>
    btn.classList.toggle('selected',btn.dataset.cenariosTipo===jogosUI.cenariosTipo)
  );

  const introTitle=$('#cenariosIntroTitle');
  const introText=$('#cenariosIntroText');
  if(jogosUI.cenariosTipo==='geral'){
    if(introTitle) introTitle.textContent='Cenário geral da CCT';
    if(introText) introText.textContent='A situação macro da CCT na disputa pelo título da competição.';
    container.innerHTML=cenarioGeralHtml();
    return;
  }

  if(introTitle) introTitle.textContent='Situação da CCT';
  if(introText) introText.textContent='O que cada modalidade precisa para avançar.';

  const linhas=apiData.cenarios
    .filter(c=>c.ID_COMPETICAO===jogosUI.competicao)
    .sort((a,b)=>modalidadeNome(a.ID_MODALIDADE).localeCompare(modalidadeNome(b.ID_MODALIDADE),'pt-BR'));

  container.innerHTML=linhas.length ? linhas.map(c=>`
    <article class="scenario-detail-card" data-scenario-card="${escapeHtml(c.ID_MODALIDADE||'')}">
      <div class="scenario-detail-head">
        <div>
          <span class="chip">${escapeHtml(modalidadeNome(c.ID_MODALIDADE))}</span>
          <h3>${escapeHtml(c.STATUS||'Situação')}</h3>
        </div>
        <span class="target">${uiIcon('target','scenario-card-target-icon')}</span>
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
    OURO:'trophy', PRATA:'trophy', BRONZE:'trophy', CAMPEAO:'trophy', 'CAMPEÃO':'trophy',
    RECORDE:'target', DESTAQUE:'star', PREMIACAO:'star', 'PREMIAÇÃO':'star'
  };
  return uiIcon(mapa[t]||'star','highlight-outline-icon');
}

function renderizarDestaques(){
  const container=$('#destaquesContainer');
  if(!container) return;

  const linhas=apiData.destaques
    .filter(d=>d.ID_COMPETICAO===jogosUI.competicao)
    .filter(d=>!Object.prototype.hasOwnProperty.call(d,'PUBLICADO') || isSim(d.PUBLICADO))
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
  jogosUI.cenariosTipo='modalidade';
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
    renderizarJogos();
  });

  $('#filtrosJogos')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-filtro]');
    if(!btn) return;
    jogosUI.dataFiltro=btn.dataset.filtro;
    renderizarJogos();
  });

  $('#modalidadeFiltro')?.addEventListener('change',e=>{
    jogosUI.modalidadeFiltro=e.target.value||'';
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

  $('#cenariosTipo')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-cenarios-tipo]');
    if(!btn) return;
    jogosUI.cenariosTipo=btn.dataset.cenariosTipo;
    renderizarCenarios();
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
    jogosUI.dataFiltro='todos';
    jogosUI.modalidadeFiltro='';
    jogosUI.classificacaoModalidade='';
    jogosUI.classificacaoTipo='modalidade';
    jogosUI.cenariosTipo='modalidade';
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
    resolverPermissoesAuth();
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
  const navScreen=['inicio','jogos','agenda','eventos','perfil'].includes(screen)?screen:'';
  $$('.bottom-nav button[data-go]').forEach(x=>x.classList.toggle('active',!!navScreen && x.dataset.go===navScreen));
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
  scenario:`<span class="chip live">CENÁRIOS</span><h2>${uiIcon('target','inline-icon')} Situação da classificação</h2><p>Abra a aba <strong>Cenários</strong> dentro da competição para acompanhar os dados atualizados da CCT.</p>`,
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

function acessoMembroPreviewAtivo(){ return authMembroAprovado(); }

const memberLoginBtn=document.querySelector('#memberLoginBtn');
const memberLogoutBtn=document.querySelector('#memberLogoutBtn');
if(memberLoginBtn) memberLoginBtn.addEventListener('click',entrarComGoogleCCT);
if(memberLogoutBtn) memberLogoutBtn.addEventListener('click',sairContaCCT);

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

function normalizarIdSocio(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
}
function campoPessoa(p,...nomes){
  for(const nome of nomes){
    const v=p?.[nome];
    if(v!==undefined && v!==null && String(v).trim()) return String(v).trim();
  }
  return '';
}
function pessoaSocioAprovada(pessoa){
  const raw=campoPessoa(pessoa,'SOCIO_CCT','SÓCIO_CCT','SOCIO','SÓCIO','ASSOCIADO','E_SOCIO','É_SÓCIO');
  return isSim(raw);
}
function registroSocioPerfil(){ return cctAuthState.pessoa||null; }
function perfilSocioAprovado(){ return authSocioAprovado(); }

function roleLabel(role='Atleta'){
  const r=String(role||'Atleta').trim().toLowerCase();
  if(r.startsWith('torc')) return 'TORCEDOR(A)';
  return 'ATLETA';
}

function aplicarIdentidadePerfil(){
  const p=perfilAtual();
  const name=$('#profileNameDisplay');
  const badge=$('#profileRoleBadge');
  const avatar=$('#profileAvatarImage');
  if(name) name.textContent=(p.name||'Seu nome').trim()||'Seu nome';
  if(badge) badge.textContent=roleLabel(p.role);
  if(avatar) avatar.src=p.avatar||'assets/representante-demo.png';
  const access=$('#profileAccessBadges');
  if(access) access.innerHTML=statusAcessoHtml();
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
  grid.querySelectorAll('input[data-sport-id]').forEach(x=>x.addEventListener('change',()=>{
    atualizarResumoPerfil();
    salvarPerfil({silent:true});
  }));
  atualizarResumoPerfil();
}

function atualizarResumoPerfil(){
  const inputs=$$('#sportGrid input[data-sport-id]');
  const n=inputs.length ? inputs.filter(x=>x.checked).length : profileSportIds().length;
  const count=$('#sportsCount'), summary=$('#profileSummary');
  if(count)count.textContent=`${n} ${n===1?'selecionada':'selecionadas'}`;
  if(summary)summary.textContent=n?`${n} ${n===1?'modalidade selecionada':'modalidades selecionadas'}`:'Escolha suas modalidades';
}

function feedbackPerfil(texto='Preferências salvas neste aparelho'){
  const feedback=$('#saveFeedback');
  if(!feedback)return;
  feedback.textContent=texto;
  feedback.classList.add('show');
  clearTimeout(feedback._timer);
  feedback._timer=setTimeout(()=>feedback.classList.remove('show'),2200);
}

function salvarPerfil({silent=false}={}){
  const name=$('#profileNameDisplay');
  const p=perfilAtual();
  p.name=name?.textContent?.trim()||p.name||'Seu nome';

  const sportInputs=$$('#sportGrid input[data-sport-id]');
  if(sportInputs.length){
    p.sportIds=sportInputs.filter(x=>x.checked).map(x=>x.dataset.sportId).filter(Boolean);
    p.sports=p.sportIds.map(id=>modalidadeNome(id)); // compatibilidade com versões anteriores
  }

  ['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>{
    const el=document.getElementById(k);
    if(el) p[k]=!!el.checked;
  });
  p.updatedAt=new Date().toISOString();

  try{
    localStorage.setItem(PROFILE_KEY,JSON.stringify(p));
  }catch(e){
    console.error('Não foi possível salvar o perfil:',e);
    feedbackPerfil('Não foi possível salvar. Tente novamente.');
    return;
  }

  atualizarResumoPerfil();
  aplicarIdentidadePerfil();
  renderizarJogos();
  renderizarProximoJogoHome();
  if(!silent) feedbackPerfil();
}

function abrirEditorPerfil(){
  const p=perfilAtual();
  const roleAtual=String(p.role||'').toLowerCase();
  const user=cctAuthState.user;
  const authConfigured=cctAuthState.configured;
  const accessHtml=!authConfigured
    ? `<div class="profile-auth-status warning"><span>${uiIcon('lock')}</span><div><small>LOGIN DA V3.8</small><strong>Configuração pendente</strong><p>Adicione as credenciais do Firebase no arquivo <b>firebase-config.js</b>. O perfil de atleta/torcedor continua funcionando sem login.</p></div></div>`
    : !user
      ? `<div class="profile-auth-status"><span>${uiIcon('lock')}</span><div><small>ACESSOS CCT</small><strong>Login opcional</strong><p>Atletas e torcedores não precisam entrar. Faça login apenas para validar benefícios de sócio(a) ou acesso de membro da Atlética.</p><button type="button" data-auth-login>ENTRAR COM GOOGLE ›</button></div></div>`
      : `<div class="profile-auth-status approved"><span>${uiIcon('check')}</span><div><small>CONTA CONECTADA</small><strong>${escapeHtml(user.displayName||user.email||'Conta Google')}</strong><p>${escapeHtml(user.email||'')}</p><div class="profile-auth-badges">${statusAcessoHtml()}</div><button type="button" data-auth-logout>SAIR DA CONTA ›</button></div></div>`;

  mc.innerHTML=`
    <span class="chip">PERFIL</span>
    <h2>Editar perfil</h2>
    <div class="profile-editor">
      <label><span>Nome exibido</span><input id="profileNameInput" type="text" maxlength="40" value="${escapeHtml(p.name||'')}" placeholder="Seu nome"></label>
      <label><span>Como você usa o app?</span><select id="profileRoleInput">
        <option value="Atleta" ${!p.role||!roleAtual.startsWith('torc')?'selected':''}>Atleta</option>
        <option value="Torcedor(a)" ${roleAtual.startsWith('torc')?'selected':''}>Torcedor(a)</option>
      </select></label>
      ${accessHtml}
      <p>O perfil esportivo fica salvo neste aparelho. Sócio(a) e membro da Atlética são permissões vinculadas ao e-mail autorizado pela diretoria.</p>
      <button class="primary full" id="saveProfileIdentity" type="button">SALVAR PERFIL</button>
    </div>`;

  modal.classList.add('open');
  mc.querySelector('[data-auth-login]')?.addEventListener('click',entrarComGoogleCCT);
  mc.querySelector('[data-auth-logout]')?.addEventListener('click',sairContaCCT);

  $('#saveProfileIdentity')?.addEventListener('click',()=>{
    const atual=perfilAtual();
    const nome=$('#profileNameInput')?.value?.trim();
    atual.name=nome||'Seu nome';
    atual.role=$('#profileRoleInput')?.value||'Atleta';
    delete atual.socioId; delete atual.codigoSocio; delete atual.isSocio;
    atual.updatedAt=new Date().toISOString();
    try{
      localStorage.setItem(PROFILE_KEY,JSON.stringify(atual));
      aplicarIdentidadePerfil();
      modal.classList.remove('open');
      feedbackPerfil('Perfil atualizado neste aparelho');
      renderizarAgenda();
    }catch(e){ console.error('Não foi possível salvar o perfil:',e); }
  });
}
function redimensionarAvatar(file){
  return new Promise((resolve,reject)=>{
    if(!file || !String(file.type||'').startsWith('image/')) return reject(new Error('Arquivo inválido'));
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Falha ao ler a imagem'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Imagem inválida'));
      img.onload=()=>{
        const size=320;
        const canvas=document.createElement('canvas');
        canvas.width=size; canvas.height=size;
        const ctx=canvas.getContext('2d');
        const side=Math.min(img.naturalWidth||img.width,img.naturalHeight||img.height);
        const sx=((img.naturalWidth||img.width)-side)/2;
        const sy=((img.naturalHeight||img.height)-side)/2;
        ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
        resolve(canvas.toDataURL('image/jpeg',0.82));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function atualizarAvatar(file){
  try{
    const dataUrl=await redimensionarAvatar(file);
    const p=perfilAtual();
    p.avatar=dataUrl;
    p.updatedAt=new Date().toISOString();
    localStorage.setItem(PROFILE_KEY,JSON.stringify(p));
    aplicarIdentidadePerfil();
    feedbackPerfil('Foto do perfil atualizada');
  }catch(e){
    console.error('Erro ao atualizar foto:',e);
    feedbackPerfil('Não foi possível usar essa foto.');
  }
}

function abrirMeusJogosPerfil(){
  jogosUI.tipo='meus';
  jogosUI.dataFiltro='todos';
  jogosUI.modalidadeFiltro='';
  jogosUI.aba='jogos';
  go('jogos');
  renderizarAbaCompeticao();
}

function abrirMinhaProgramacao(){
  agendaUI.modo='minha';
  go('agenda');
  renderizarAgenda();
}

function focarPreferenciasNotificacao(){
  const card=$('#profileNotificationsCard');
  if(!card)return;
  card.scrollIntoView({behavior:'smooth',block:'center'});
  card.classList.add('profile-card-focus');
  setTimeout(()=>card.classList.remove('profile-card-focus'),1400);
}

function bindAcoesPerfil(){
  $$('[data-profile-action]').forEach(btn=>{
    btn.onclick=()=>{
      const action=btn.dataset.profileAction;
      if(action==='my-games') return abrirMeusJogosPerfil();
      if(action==='my-schedule') return abrirMinhaProgramacao();
      if(action==='documents') return abrirConteudos('DOCUMENT','Documentos');
      if(action==='notification-settings') return focarPreferenciasNotificacao();
      if(action==='active-alerts') return abrirAvisos();
    };
  });
}

function inicializarPerfil(){
  const p=perfilAtual();
  aplicarIdentidadePerfil();

  ['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>{
    const e=document.getElementById(k);
    if(!e)return;
    if(typeof p[k]==='boolean') e.checked=p[k];
    e.addEventListener('change',()=>salvarPerfil({silent:true}));
  });

  $('#editProfileBtn')?.addEventListener('click',abrirEditorPerfil);
  $('#profileAvatarBtn')?.addEventListener('click',()=>$('#profileAvatarInput')?.click());
  $('#profileAvatarInput')?.addEventListener('change',e=>{
    const file=e.target.files?.[0];
    if(file) atualizarAvatar(file);
    e.target.value='';
  });

  bindAcoesPerfil();
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
function showEventDetails(id){const e=cctEvents.find(x=>x.ID_EVENTO===id);if(!e)return;const body=document.getElementById('modalContent');if(!body)return;body.innerHTML=`<span class="chip live">${escapeHtml(e.STATUS||e.TIPO||'EVENTO')}</span><h2>${escapeHtml(e.NOME)}</h2>${normalizeImageUrl(e.IMAGEM_URL)?`<img class="event-modal-image" src="${escapeHtml(normalizeImageUrl(e.IMAGEM_URL))}" alt="${escapeHtml(e.NOME)}">`:''}<div class="event-detail-list"><div><b>${uiIcon('calendar','inline-icon')} Data</b><span>${escapeHtml(e.DATA)}${e.DATA_FIM?` até ${escapeHtml(e.DATA_FIM)}`:''}</span></div><div><b>${uiIcon('info','inline-icon')} Horário</b><span>${escapeHtml(e.HORA)}${e.HORA_FIM?` às ${escapeHtml(e.HORA_FIM)}`:''}</span></div><div><b>${uiIcon('map-pin','inline-icon')} Local</b><span>${escapeHtml(e.LOCAL)}${e.ENDERECO?`<small>${escapeHtml(e.ENDERECO)}</small>`:''}</span></div></div>${e.DESCRICAO?`<p>${escapeHtml(e.DESCRICAO)}</p>`:''}${e.AVISO?`<div class="event-notice">${escapeHtml(e.AVISO)}</div>`:''}<div class="event-actions">${e.LINK_MAPS?`<a class="ghost event-action" href="${escapeHtml(e.LINK_MAPS)}" target="_blank" rel="noopener">ABRIR MAPA</a>`:''}${e.LINK_COMPRA?`<a class="primary event-action" href="${escapeHtml(e.LINK_COMPRA)}" target="_blank" rel="noopener">${escapeHtml(e.TEXTO_BOTAO||'SAIBA MAIS')}</a>`:''}</div>`;document.getElementById('modal')?.classList.add('open')}
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
function agendaIcon(tipo){
  const t=String(tipo||'').toUpperCase();
  if(t.includes('TREINO'))return uiIcon('running');
  if(t.includes('ATEND'))return uiIcon('store');
  if(t.includes('REUNI'))return uiIcon('users');
  if(t.includes('REPRESENT'))return uiIcon('trophy');
  if(t.includes('JOGO'))return uiIcon('trophy');
  if(t.includes('EVENT'))return uiIcon('star');
  return uiIcon('calendar');
}

function agendaItemHtml(a){
  const mod=a.ID_MODALIDADE?modalidadeNome(a.ID_MODALIDADE):'';
  const local=a.LOCAL||a.ENDERECO||'';
  const origem=String(a._ORIGEM||'').toUpperCase();
  const origemLabel=origem==='INTERNA'?'INTERNO':origem==='JOGO'?'JOGO':origem==='EVENTO'?'EVENTO':'';
  return `<div class="agenda-row ${origem?`agenda-origin-${origem.toLowerCase()}`:''}"><time>${escapeHtml(a.HORA_INICIO||a.HORA||'--:--')}</time><span class="dot"></span><section><div class="agenda-card-head"><small>${escapeHtml(a.TIPO||'AGENDA')}</small><span>${agendaIcon(a.TIPO)}</span></div>${origemLabel?`<span class="agenda-source-badge">${escapeHtml(origemLabel)}</span>`:''}<strong>${escapeHtml(a.TITULO||mod||'Compromisso CCT')}</strong>${mod&&a.TITULO!==mod?`<em>${escapeHtml(mod)}</em>`:''}${local?`<p>${uiIcon('map-pin','inline-icon')} ${escapeHtml(local)}</p>`:''}${a.DESCRICAO?`<p>${escapeHtml(a.DESCRICAO)}</p>`:''}${linkSeguro(a.LINK_MAPS)?`<a href="${escapeHtml(a.LINK_MAPS)}" target="_blank" rel="noopener">ABRIR MAPA ›</a>`:''}</section></div>`;
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

function perfilRoleTipo(){
  const r=String(perfilAtual().role||'Atleta').trim().toLowerCase();
  if(r.startsWith('torc')) return 'torcedor';
  return 'atleta';
}

function inicioDoDiaAtual(){
  const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
}

function normalizarNomeAgenda(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}

function agendaInternaPertenceAoPerfil(a,p){
  const campos=[a.RESPONSAVEL,a.RESPONSAVEIS,a.MEMBRO,a.MEMBROS,a.PESSOA,a.NOME_RESPONSAVEL,a.ATRIBUIDO_A,a.ATRIBUIDO];
  const preenchidos=campos.map(normalizarNomeAgenda).filter(Boolean);
  if(!preenchidos.length) return true; // compromisso interno geral para membros
  const nome=normalizarNomeAgenda(p.name);
  if(!nome || nome==='SEU NOME') return false;
  return preenchidos.some(x=>x.includes(nome)||nome.includes(x));
}

function jogoComoAgenda(j,representacao=false){
  const resp=responsavelRepresentacaoDados(j).nome;
  const comp=competitionName(j.ID_COMPETICAO);
  return {
    DATA:j.DATA,
    HORA_INICIO:j.HORA,
    TIPO:representacao?'REPRESENTAÇÃO CCT':'JOGO',
    TITULO:`${j.EQUIPE_A||'A definir'} × ${j.EQUIPE_B||'A definir'}`,
    ID_MODALIDADE:j.ID_MODALIDADE,
    LOCAL:j.LOCAL||'',
    DESCRICAO:[comp,representacao&&resp?`Responsável: ${resp}`:''].filter(Boolean).join(' • '),
    _ORIGEM:'JOGO',
    _ID_UNICO:`JOGO:${j.ID_JOGO||[j.DATA,j.HORA,j.ID_MODALIDADE,j.EQUIPE_A,j.EQUIPE_B].join('|')}`
  };
}

function eventoComoAgenda(e){
  return {
    DATA:e.DATA,
    HORA_INICIO:e.HORA||'00:00',
    TIPO:'EVENTO CCT',
    TITULO:e.NOME||'Evento CCT',
    LOCAL:e.LOCAL||'',
    DESCRICAO:e.AVISO||e.DESCRICAO||'',
    LINK_MAPS:e.LINK_MAPS||'',
    _ORIGEM:'EVENTO',
    _ID_UNICO:`EVENTO:${e.ID_EVENTO||[e.DATA,e.HORA,e.NOME].join('|')}`
  };
}

function deduplicarProgramacao(itens){
  const mapa=new Map();
  itens.forEach(x=>{
    const chave=x._ID_UNICO||[x.DATA,x.HORA_INICIO,x.TIPO,x.TITULO,x.ID_MODALIDADE].join('|');
    if(!mapa.has(chave)) mapa.set(chave,x);
    else if(String(x.TIPO||'').includes('REPRESENTAÇÃO')) mapa.set(chave,x);
  });
  return [...mapa.values()];
}

function programacaoPersonalizada(){
  const p=perfilAtual();
  const role=perfilRoleTipo();
  const sports=profileSportIds();
  const sportsSet=new Set(sports);
  const inicio=inicioDoDiaAtual();
  const itens=[];

  // Atleta e membro: treinos/compromissos públicos ligados às modalidades escolhidas.
  if(role==='atleta' || role==='membro'){
    somentePublicos(apiData.agenda).forEach(a=>{
      const mod=String(a.ID_MODALIDADE||'').trim();
      if(mod && sportsSet.has(mod) && dataVal(a.DATA,a.HORA_INICIO)>=inicio){
        itens.push({...a,_ORIGEM:'ESPORTE',_ID_UNICO:`AGENDA:${a.ID_AGENDA||[a.DATA,a.HORA_INICIO,a.TITULO,mod].join('|')}`});
      }
    });
  }

  // Atleta, torcedor e membro: jogos das modalidades escolhidas.
  if(sports.length){
    apiData.jogos
      .filter(j=>jogoTemCCT(j) && sportsSet.has(j.ID_MODALIDADE) && !isFinalizado(j))
      .filter(j=>(parseBrDate(j.DATA,j.HORA)?.getTime()||0)>=inicio)
      .forEach(j=>itens.push(jogoComoAgenda(j,authMembroAprovado()&&jogoEhRepresentacaoCCT(j))));
  }

  // Eventos públicos entram para todos os tipos de perfil.
  somentePublicos(apiData.eventos)
    .filter(e=>!('PUBLICADO' in e)||isSim(e.PUBLICADO))
    .filter(e=>dataVal(e.DATA,e.HORA||'00:00')>=inicio)
    .forEach(e=>itens.push(eventoComoAgenda(e)));

  const membroLiberado=authMembroAprovado();
  if(membroLiberado){
    somenteMembros(apiData.agenda)
      .filter(a=>dataVal(a.DATA,a.HORA_INICIO)>=inicio)
      .filter(a=>agendaInternaPertenceAoPerfil(a,p))
      .forEach(a=>itens.push({...a,_ORIGEM:'INTERNA',_ID_UNICO:`INTERNA:${a.ID_AGENDA||[a.DATA,a.HORA_INICIO,a.TITULO].join('|')}`}));

    // Representações CCT futuras também entram na programação do membro.
    apiData.jogos
      .filter(j=>jogoEhRepresentacaoCCT(j) && !isFinalizado(j))
      .filter(j=>(parseBrDate(j.DATA,j.HORA)?.getTime()||0)>=inicio)
      .forEach(j=>itens.push(jogoComoAgenda(j,true)));
  }

  const ordenados=deduplicarProgramacao(itens).sort((a,b)=>dataVal(a.DATA,a.HORA_INICIO)-dataVal(b.DATA,b.HORA_INICIO));
  return {p,role,sports,itens:ordenados,membroLiberado};
}

function programacaoContextoHtml(info){
  const nomes=info.sports.map(modalidadeNome).filter(Boolean);
  const roleTxt=info.role==='torcedor'?'TORCEDOR(A)':'ATLETA';
  let descricao=info.role==='torcedor'
    ? 'Jogos das modalidades que você acompanha e eventos públicos da CCT.'
    : 'Treinos e jogos das suas modalidades, além dos eventos públicos da CCT.';
  if(info.membroLiberado) descricao+=' Sua autorização de membro também adiciona compromissos internos e representações.';
  const semEsportes=`Nenhuma modalidade selecionada. Escolha seus esportes no Perfil para adicionar jogos${info.role==='atleta'?' e treinos':''}.`;
  return `<div class="my-schedule-context">
    <div class="my-schedule-head"><div><span>${roleTxt}</span><strong>${escapeHtml(info.p.name||'Seu perfil')}</strong><div class="my-schedule-access">${statusAcessoHtml()}</div></div><button type="button" data-agenda-general>AGENDA GERAL ›</button></div>
    <p>${escapeHtml(descricao)}</p>
    ${nomes.length?`<div class="my-schedule-sports">${nomes.map(n=>`<span>${escapeHtml(n)}</span>`).join('')}</div>`:`<div class="my-schedule-empty-sports">${escapeHtml(semEsportes)}</div>`}
    ${authLogado()&&!info.membroLiberado?`<div class="member-schedule-notice static"><b>${uiIcon('lock','inline-icon')} Área interna protegida</b><span>Esta conta não possui autorização de membro da Atlética.</span></div>`:''}
  </div>`;
}
function atualizarCabecalhoAgenda(modo){
  const personalizada=modo==='minha';
  const role=perfilRoleTipo();
  const eyebrow=$('#agendaEyebrow'),title=$('#agendaTitle'),introTitle=$('#agendaIntroTitle'),introText=$('#agendaIntroText'),icon=$('#agendaIntroIcon');
  if(eyebrow) eyebrow.textContent=personalizada?'MEU PERFIL':'CCT';
  if(title) title.textContent=personalizada?'Minha Programação':'Agenda';
  if(icon) icon.innerHTML=uiIcon('calendar');
  if(introTitle) introTitle.textContent=personalizada?'Sua agenda personalizada':'Programação da CCT';
  if(introText){
    if(!personalizada) introText.textContent='Treinos, atendimentos, reuniões e compromissos publicados pelo painel.';
    else if(authMembroAprovado()) introText.textContent='Esportes, compromissos internos, representações e eventos autorizados para sua conta.';
    else if(role==='torcedor') introText.textContent='Jogos que você acompanha e eventos da CCT.';
    else introText.textContent='Treinos, jogos e eventos relacionados ao seu perfil.';
  }
}
function renderizarAgenda(){
  const c=$('#agendaContainer'); if(!c)return;
  const contexto=$('#agendaProfileContext');
  atualizarCabecalhoAgenda(agendaUI.modo);

  if(agendaUI.modo==='minha'){
    const info=programacaoPersonalizada();
    if(contexto){
      contexto.innerHTML=programacaoContextoHtml(info);
      contexto.querySelector('[data-agenda-general]')?.addEventListener('click',()=>{
        agendaUI.modo='geral'; renderizarAgenda();
      });
      contexto.querySelector('[data-go-member-area]')?.addEventListener('click',()=>go('membros'));
    }
    c.innerHTML=info.itens.length?agendaAgrupadaHtml(info.itens):'<div class="games-empty"><strong>Sua programação ainda está vazia.</strong><span>Selecione modalidades no Perfil ou aguarde novos jogos, treinos e eventos.</span></div>';
    return;
  }

  if(contexto) contexto.innerHTML='';
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

// Todo atalho comum de Agenda abre a visão geral. "Minha Programação" usa ação própria.
$$('[data-go="agenda"]').forEach(b=>b.addEventListener('click',()=>{
  agendaUI.modo='geral';
  renderizarAgenda();
}));

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
function abrirAvisos(){ const av=avisosAtivos(); mc.innerHTML=`<span class="chip ${av.some(x=>isSim(x.URGENTE))?'live':''}">${av.length} ${av.length===1?'AVISO':'AVISOS'}</span><h2>${uiIcon('bell','heading-icon')} Avisos</h2><div class="modal-list">${av.length?av.map(a=>`<div><strong>${escapeHtml(a.TITULO||'Aviso CCT')}</strong><small>${escapeHtml(a.MENSAGEM||'')}</small>${linkSeguro(a.LINK)?`<a class="content-link" href="${escapeHtml(a.LINK)}" target="_blank" rel="noopener">${escapeHtml(a.TEXTO_BOTAO||'ABRIR')} ›</a>`:''}</div>`).join(''):'<div><strong>Nenhum aviso ativo</strong><small>Quando houver novidades elas aparecerão aqui.</small></div>'}</div>`; modal.classList.add('open'); }
function conteudosFiltrados(categoria='',escopo='publico'){
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
  return itens.sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999));
}
function conteudosHtml(categoria='',escopo='publico'){
  const itens=conteudosFiltrados(categoria,escopo);
  return itens.length?itens.map(x=>`<div class="content-item">${normalizeImageUrl(x.IMAGEM_URL)?`<img src="${escapeHtml(normalizeImageUrl(x.IMAGEM_URL))}" alt="">`:''}<div><strong>${escapeHtml(x.TITULO||'Conteúdo')}</strong><small>${escapeHtml(x.DESCRICAO||x.CATEGORIA||'')}</small>${linkSeguro(x.LINK)?`<a class="content-link" href="${escapeHtml(x.LINK)}" target="_blank" rel="noopener">${escapeHtml(x.TEXTO_BOTAO||'ABRIR')} ›</a>`:''}</div></div>`).join(''):'<div><strong>Nenhum conteúdo publicado</strong><small>Cadastre itens compatíveis na aba CONTEUDOS.</small></div>';
}
function hubEmpty(icon,titulo,texto){
  return `<div class="hub-empty"><span>${uiIcon(icon)}</span><strong>${escapeHtml(titulo)}</strong><p>${escapeHtml(texto)}</p></div>`;
}
function conteudoTipoIcone(x){
  const c=String(x?.CATEGORIA||'').toUpperCase();
  if(c.includes('VIDEO')) return 'image';
  if(c.includes('FOTO')||c.includes('GALERIA')||c.includes('MID')) return 'image';
  if(c.includes('KIT')||c.includes('UNIFORM')) return 'trophy';
  if(c.includes('RETIR')||c.includes('VENDA')||c.includes('PEDIDO')||c.includes('FORM')) return 'form';
  return 'file';
}
function conteudoTipoLabel(x){
  const c=String(x?.CATEGORIA||'').trim().toUpperCase();
  if(c.includes('VIDEO'))return 'VÍDEO';
  if(c.includes('GALERIA'))return 'GALERIA';
  if(c.includes('FOTO'))return 'FOTOS';
  if(c.includes('REGUL'))return 'REGULAMENTO';
  if(c.includes('KIT'))return 'KIT';
  if(c.includes('UNIFORM'))return 'UNIFORME';
  if(c.includes('RETIR'))return 'RETIRADA';
  if(c.includes('PEDIDO'))return 'PEDIDO';
  if(c.includes('FORM'))return 'FORMULÁRIO';
  return c||'CONTEÚDO';
}
function deduplicarConteudos(itens){
  const mapa=new Map();
  itens.forEach(x=>{
    const k=`${normalizarNomeAgenda(x.TITULO)}|${normalizarNomeAgenda(x.CATEGORIA)}`;
    if(!mapa.has(k) || isSim(x.DESTAQUE)) mapa.set(k,x);
  });
  return [...mapa.values()];
}
function abrirHubMidia(escopo='publico'){
  const itens=deduplicarConteudos(conteudosFiltrados('MID',escopo));
  mc.innerHTML=`<div class="hub-head"><span class="chip">${escopo==='membros'?'MEMBROS':'MÍDIA CCT'}</span><div class="hub-title"><span>${uiIcon('image')}</span><div><h2>${escopo==='membros'?'Mídia interna':'Mídia CCT'}</h2><p>Fotos, vídeos e memórias da CCT em um só lugar.</p></div></div></div><div class="media-hub-grid">${itens.length?itens.map(x=>{const img=normalizeImageUrl(x.IMAGEM_URL);const link=linkSeguro(x.LINK);return `<article class="media-hub-card ${isSim(x.DESTAQUE)?'featured':''}">${img?`<img src="${escapeHtml(img)}" alt="">`:`<span class="media-hub-placeholder">${uiIcon('image')}</span>`}<div><small>${escapeHtml(conteudoTipoLabel(x))}</small><strong>${escapeHtml(x.TITULO||'Mídia CCT')}</strong><p>${escapeHtml(x.DESCRICAO||'Conteúdo da Atlética CCT.')}</p>${link?`<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(x.TEXTO_BOTAO||'ABRIR CONTEÚDO')} ›</a>`:''}</div></article>`}).join(''):hubEmpty('image','Mídia em construção','Quando novas fotos e vídeos forem publicados, eles aparecerão aqui.')}</div>`;
  modal.classList.add('open'); closeDrawer();
}
function abrirHubDocumentos(escopo='publico',titulo='Documentos'){
  const itens=conteudosFiltrados('DOCUMENT',escopo);
  mc.innerHTML=`<div class="hub-head"><span class="chip">${escopo==='membros'?'MEMBROS':'DOCUMENTOS'}</span><div class="hub-title"><span>${uiIcon('file')}</span><div><h2>${escapeHtml(titulo)}</h2><p>Regulamentos, arquivos oficiais e materiais importantes da CCT.</p></div></div></div><div class="document-hub-list">${itens.length?itens.map(x=>{const comp=x.ID_COMPETICAO?competitionName(x.ID_COMPETICAO):'';const link=linkSeguro(x.LINK);return `<article class="document-hub-card"><span>${uiIcon('file')}</span><div><small>${escapeHtml(comp||conteudoTipoLabel(x))}</small><strong>${escapeHtml(x.TITULO||'Documento')}</strong><p>${escapeHtml(x.DESCRICAO||'Arquivo publicado pela Atlética CCT.')}</p>${link?`<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(x.TEXTO_BOTAO||'ABRIR DOCUMENTO')} ›</a>`:''}</div></article>`}).join(''):hubEmpty('file','Nenhum documento publicado','Os regulamentos e arquivos oficiais aparecerão aqui.')}</div>`;
  modal.classList.add('open'); closeDrawer();
}
function abrirHubFormularios(escopo='publico',titulo='Pedidos e Formulários'){
  const itens=conteudosFiltrados('FORM',escopo);
  mc.innerHTML=`<div class="hub-head"><span class="chip">${escopo==='membros'?'MEMBROS':'CENTRAL CCT'}</span><div class="hub-title"><span>${uiIcon('form')}</span><div><h2>${escapeHtml(titulo)}</h2><p>${escopo==='membros'?'Links e processos exclusivos da equipe.':'Pedidos, inscrições, kits, uniformes e formulários ativos.'}</p></div></div>${itens.length?`<div class="hub-summary"><b>${itens.length}</b><span>${itens.length===1?'opção disponível':'opções disponíveis'}</span></div>`:''}</div><div class="forms-hub-list">${itens.length?itens.map(x=>{const link=linkSeguro(x.LINK);return `<article class="form-hub-card"><span>${uiIcon(conteudoTipoIcone(x))}</span><div><small>${escapeHtml(conteudoTipoLabel(x))}</small><strong>${escapeHtml(x.TITULO||'Formulário CCT')}</strong><p>${escapeHtml(x.DESCRICAO||'Acesse para preencher ou acompanhar.')}</p>${link?`<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(x.TEXTO_BOTAO||'ABRIR FORMULÁRIO')} ›</a>`:''}</div></article>`}).join(''):hubEmpty('form',escopo==='membros'?'Nenhum formulário interno ativo':'Nada aberto no momento',escopo==='membros'?'Os links exclusivos da equipe aparecerão aqui.':'Quando houver pedidos, inscrições ou campanhas ativas, você encontrará tudo aqui.')}</div>`;
  modal.classList.add('open'); closeDrawer();
}
function abrirConteudos(categoria='',titulo='Conteúdos',escopo='publico'){
  const chave=String(categoria||'').toUpperCase();
  if(chave==='MID') return abrirHubMidia(escopo);
  if(chave==='DOCUMENT') return abrirHubDocumentos(escopo,titulo);
  if(chave==='FORM') return abrirHubFormularios(escopo,titulo);
  mc.innerHTML=`<span class="chip">${escopo==='membros'?'MEMBROS':'CCT'}</span><h2>${escapeHtml(titulo)}</h2><div class="modal-list dynamic-content-list">${conteudosHtml(categoria,escopo)}</div>`; modal.classList.add('open'); closeDrawer();
}
function abrirLocais(escopo='publico'){
  const itens=(escopo==='membros'?somenteMembros(apiData.locais):somentePublicos(apiData.locais)).sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999));
  const interno=escopo==='membros';
  mc.innerHTML=`<div class="hub-head"><span class="chip">${interno?'MEMBROS':'LOCAIS CCT'}</span><div class="hub-title"><span>${uiIcon('map-pin')}</span><div><h2>${interno?'Locais internos':'Onde a CCT acontece'}</h2><p>${interno?'Pontos de encontro, apoio e organização da diretoria.':'Ginásios, quadras, eventos e pontos importantes para você chegar sem dúvida.'}</p></div></div></div><div class="places-hub-list">${itens.length?itens.map(x=>{const img=normalizeImageUrl(x.IMAGEM_URL);const link=linkSeguro(x.LINK_MAPS);const meta=[x.TIPO,x.ENDERECO].filter(Boolean).join(' • ');return `<article class="place-hub-card">${img?`<img src="${escapeHtml(img)}" alt="">`:`<span class="place-icon">${uiIcon('map-pin')}</span>`}<div><small>${escapeHtml(x.TIPO|| (interno?'INTERNO':'LOCAL CCT'))}</small><strong>${escapeHtml(x.NOME||'Local')}</strong>${meta?`<p>${escapeHtml(meta)}</p>`:''}${x.OBSERVACAO?`<em>${escapeHtml(x.OBSERVACAO)}</em>`:''}${link?`<a href="${escapeHtml(link)}" target="_blank" rel="noopener">ABRIR NO MAPA ›</a>`:''}</div></article>`}).join(''):hubEmpty('map-pin',interno?'Nenhum local interno cadastrado':'Nenhum local publicado',interno?'Os pontos de organização da equipe aparecerão aqui.':'Os locais de jogos e eventos serão publicados aqui.')}</div>`;
  modal.classList.add('open'); closeDrawer();
}
function abrirContatos(escopo='publico'){
  const base=escopo==='membros'?somenteMembros(apiData.pessoas):somentePublicos(apiData.pessoas);
  const itens=base.filter(x=>String(x.ATIVO||'SIM').toUpperCase()!=='NÃO');
  const interno=escopo==='membros';
  mc.innerHTML=`<div class="hub-head"><span class="chip">${interno?'MEMBROS':'CONTATOS CCT'}</span><div class="hub-title"><span>${uiIcon('mail')}</span><div><h2>${interno?'Equipe interna':'Fale com a CCT'}</h2><p>${interno?'Diretoria, responsáveis e contatos de organização.':'Encontre rapidamente a pessoa certa para esportes, eventos, parcerias ou atendimento geral.'}</p></div></div></div><div class="contacts-hub-list">${itens.length?itens.map(p=>{const foto=normalizeImageUrl(p.FOTO_URL);const whats=linkSeguro(p.LINK_WHATSAPP);const cargo=[p.CARGO,p.TIPO].filter(Boolean).join(' • ');return `<article class="contact-hub-card">${foto?`<img src="${escapeHtml(foto)}" alt="">`:`<span class="contact-hub-avatar">${escapeHtml((p.NOME||'C').charAt(0))}</span>`}<div><small>${escapeHtml(p.TIPO||'CCT')}</small><strong>${escapeHtml(p.NOME||'Contato CCT')}</strong>${cargo?`<p>${escapeHtml(cargo)}</p>`:''}<div class="contact-actions">${whats?`<a href="${escapeHtml(whats)}" target="_blank" rel="noopener">WHATSAPP ›</a>`:''}${p.EMAIL?`<a href="mailto:${escapeHtml(p.EMAIL)}">E-MAIL ›</a>`:''}</div></div></article>`}).join(''):hubEmpty('mail','Nenhum contato publicado','Os canais oficiais da CCT aparecerão aqui.')}</div>`;
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
  if(!authMembroAprovado()){ atualizarAcessoAreaMembros(); go('membros'); return; }
  let itens=somenteMembros(apiData.agenda).sort((a,b)=>dataVal(a.DATA,a.HORA_INICIO)-dataVal(b.DATA,b.HORA_INICIO));
  if(filtro==='salinha') itens=itens.filter(a=>categoriaTem([a.TIPO,a.TITULO,a.LOCAL].join(' '),['SALINHA','ATEND']));
  mc.innerHTML=`<span class="chip">MEMBROS</span><h2>${filtro==='salinha'?`${uiIcon('store','heading-icon')} Escala da salinha`:`${uiIcon('calendar','heading-icon')} Agenda interna`}</h2><div class="member-agenda-modal">${itens.length?agendaAgrupadaHtml(itens):'<div class="games-empty">Nenhum compromisso interno publicado.</div>'}</div>`;
  modal.classList.add('open');
}
function abrirAvisosMembros(){
  if(!authMembroAprovado()){ atualizarAcessoAreaMembros(); go('membros'); return; }
  const av=avisosAtivos('membros');
  mc.innerHTML=`<span class="chip ${av.some(x=>isSim(x.URGENTE))?'live':''}">${av.length} ${av.length===1?'AVISO INTERNO':'AVISOS INTERNOS'}</span><h2>${uiIcon('alert','heading-icon')} Avisos internos</h2><div class="modal-list">${av.length?av.map(a=>`<div><strong>${escapeHtml(a.TITULO||'Aviso interno')}</strong><small>${escapeHtml(a.MENSAGEM||'')}</small>${linkSeguro(a.LINK)?`<a class="content-link" href="${escapeHtml(a.LINK)}" target="_blank" rel="noopener">${escapeHtml(a.TEXTO_BOTAO||'ABRIR')} ›</a>`:''}</div>`).join(''):'<div><strong>Nenhum aviso interno ativo</strong><small>Os avisos exclusivos para membros aparecerão aqui.</small></div>'}</div>`;
  modal.classList.add('open');
}
function abrirRepresentacoesMembros(){
  if(!authMembroAprovado()){ atualizarAcessoAreaMembros(); go('membros'); return; }
  const itens=apiData.jogos.filter(j=>jogoEhRepresentacaoCCT(j)).sort((a,b)=>(parseBrDate(a.DATA,a.HORA)?.getTime()||0)-(parseBrDate(b.DATA,b.HORA)?.getTime()||0));
  mc.innerHTML=`<span class="chip">MEMBROS</span><h2>${uiIcon('trophy','heading-icon')} Representações CCT</h2><div>${itens.length?itens.map(j=>matchCard(j)).join(''):'<div class="games-empty"><strong>Nenhuma representação CCT cadastrada.</strong><span>Os jogos marcados para representação aparecerão aqui.</span></div>'}</div>`;
  modal.classList.add('open');
}
function renderizarAreaMembros(){
  const hoje=new Date();
  const agendaM=somenteMembros(apiData.agenda);
  const hojeCount=agendaM.filter(a=>sameDay(parseBrDate(a.DATA,a.HORA_INICIO),hoje)).length;
  const reps=apiData.jogos.filter(j=>jogoEhRepresentacaoCCT(j));
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
      const dados=responsavelRepresentacaoDados(j);
      const nome=dados.nome||'Responsável a definir';
      const foto=normalizeImageUrl(dados.foto||'');
      const iniciais=nome.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
      return `<div>${foto?`<img src="${escapeHtml(foto)}" alt="">`:`<div class="avatar-placeholder">${escapeHtml(iniciais||'CCT')}</div>`}<span><strong>${escapeHtml(nome)}</strong><small>${escapeHtml(competitionName(j.ID_COMPETICAO))} • ${escapeHtml(modalidadeNome(j.ID_MODALIDADE))} • ${escapeHtml(j.DATA||'')} ${escapeHtml(j.HORA||'')}</small></span></div>`;
    }).join(''):'<div class="games-empty">Nenhuma representação futura cadastrada.</div>';
  }
}
function bindAreaMembros(){
  $$('[data-member-open]').forEach(b=>{
    b.onclick=()=>{
      if(!authMembroAprovado()){ atualizarAcessoAreaMembros(); go('membros'); return; }
      const t=b.dataset.memberOpen;
      if(t==='agenda') return abrirAgendaMembros();
      if(t==='salinha') return abrirAgendaMembros('salinha');
      if(t==='representacoes') return abrirRepresentacoesMembros();
      if(t==='docs') return abrirConteudos('DOCUMENT','Documentos internos','membros');
      if(t==='avisos') return abrirAvisosMembros();
      if(t==='pessoas') return abrirContatos('membros');
      if(t==='locais') return abrirLocais('membros');
      if(t==='forms') return abrirConteudos('FORM','Formulários internos','membros');
    };
  });
}

function renderizarModulosGerais(){ renderizarAgenda(); renderizarAvisos(); renderizarHeroHome(); renderizarCompeticoesHome(); renderizarMidiaHome(); renderizarModalidadesPerfil(); renderizarAreaMembros(); if(apiData.eventos.length){cctEvents=apiData.eventos.sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)||eventDateValue(a)-eventDateValue(b)); const all=$('#eventsContainer'),home=$('#homeEventContainer'); if(all)all.innerHTML=cctEvents.length?cctEvents.map(e=>eventCard(e)).join(''):'<div class="event-empty">Nenhum evento publicado no momento.</div>'; const featured=cctEvents.find(e=>isSim(e.DESTAQUE))||cctEvents[0]; if(home)home.innerHTML=featured?eventCard(featured,true):'<div class="event-empty">Novos eventos em breve.</div>'; bindEventButtons(); } }
function abrirAjuda(){
  const contato=somentePublicos(apiData.pessoas).find(p=>String(p.ATIVO||'SIM').toUpperCase()!=='NÃO' && (linkSeguro(p.LINK_WHATSAPP)||p.EMAIL));
  const contatoHtml=contato?(linkSeguro(contato.LINK_WHATSAPP)?`<a class="help-contact" href="${escapeHtml(contato.LINK_WHATSAPP)}" target="_blank" rel="noopener">${uiIcon('mail','inline-icon')} FALAR COM A ATLÉTICA ›</a>`:`<a class="help-contact" href="mailto:${escapeHtml(contato.EMAIL)}">${uiIcon('mail','inline-icon')} FALAR COM A ATLÉTICA ›</a>`):'';
  mc.innerHTML=`<span class="chip">AJUDA</span><h2>Como usar a ATLÉTICA CCT</h2><div class="help-sections"><section><strong>${uiIcon('home','inline-icon')} Instalar no celular</strong><p><b>iPhone:</b> abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.<br><b>Android:</b> abra no Chrome e use “Adicionar à tela inicial” ou “Instalar app”.</p></section><section><strong>${uiIcon('user','inline-icon')} Personalizar seu perfil</strong><p>Em Perfil, selecione as modalidades que você joga ou acompanha. “Minha Programação” adapta a agenda ao tipo de perfil: atleta, torcedor(a) ou membro da Atlética. Benefícios de sócio(a) são liberados pela Atlética no painel administrativo.</p></section><section><strong>${uiIcon('trophy','inline-icon')} Jogos e competições</strong><p>Use Jogos para acompanhar partidas, classificação, cenários e destaques de cada campeonato.</p></section><section><strong>${uiIcon('bell','inline-icon')} Avisos</strong><p>O sino reúne avisos ativos. Mudanças urgentes de horário, local e informações importantes aparecem em destaque.</p></section><section><strong>${uiIcon('lock','inline-icon')} Área da Atlética</strong><p>É destinada aos membros para agenda interna, representações, documentos, avisos, equipe e formulários.</p></section></div>${contatoHtml}`;
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
function parceiroCampo(item,...nomes){
  for(const nome of nomes){
    const v=item?.[nome];
    if(v!==undefined && v!==null && String(v).trim()) return String(v).trim();
  }
  return '';
}
function perfilPublicosParceiro(){
  const role=perfilRoleTipo();
  const perfis=[role==='torcedor'?'TORCEDOR':'ATLETA'];
  if(authSocioAprovado()) perfis.push('SOCIO');
  if(authMembroAprovado()) perfis.push('MEMBRO');
  return [...new Set(perfis)];
}
function parceiroPublicosAlvo(x){
  const raw=parceiroCampo(x,'PUBLICO_ALVO','PÚBLICO_ALVO','PERFIL','PERFIS','AUDIENCIA','AUDIÊNCIA','PUBLICO_PARCEIRO','PÚBLICO_PARCEIRO');
  if(!raw) return ['TODOS'];
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split(/[,;|/]+/).map(v=>v.trim()).filter(Boolean);
}
function parceiroVisivelParaPerfil(x){
  const perfis=perfilPublicosParceiro();
  if(ehMembros(x) && !perfis.includes('MEMBRO')) return false;
  const alvos=parceiroPublicosAlvo(x);
  if(alvos.some(v=>['TODOS','TODAS','PUBLICO','PUBLICA','GERAL'].includes(v))) return true;
  return alvos.some(v=>perfis.some(role=>v===role || (role==='SOCIO'&&v.startsWith('SOCIO')) || (role==='TORCEDOR'&&v.startsWith('TORC')) || (role==='MEMBRO'&&v.startsWith('MEMBRO')) || (role==='ATLETA'&&v.startsWith('ATLETA'))));
}
function parceirosPublicos(){
  return apiData.conteudos
    .filter(x=>categoriaTem(x.CATEGORIA,['PARCEIRO','PATROCIN']))
    .filter(parceiroVisivelParaPerfil)
    .sort((a,b)=>(isSim(b.DESTAQUE)-isSim(a.DESTAQUE))||((Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)));
}
function parceiroCardHtml(x,index=0){
  const nome=parceiroCampo(x,'TITULO','NOME')||'Parceiro CCT';
  const beneficio=parceiroCampo(x,'BENEFICIO','BENEFÍCIO','VANTAGEM','OFERTA')||parceiroCampo(x,'DESCRICAO','DESCRIÇÃO');
  const detalhes=parceiroCampo(x,'DETALHES','OBSERVACAO','OBSERVAÇÃO','SUBTITULO');
  const cupom=parceiroCampo(x,'CUPOM','CODIGO','CÓDIGO');
  const img=normalizeImageUrl(parceiroCampo(x,'IMAGEM_URL','LOGO_URL','FOTO_URL'));
  const link=linkSeguro(parceiroCampo(x,'LINK','LINK_PARCEIRO','SITE','INSTAGRAM'));
  const cta=parceiroCampo(x,'TEXTO_BOTAO','TEXTO_BOTÃO')||'CONHECER PARCEIRO';
  const destaque=isSim(x.DESTAQUE);
  const publico=parceiroPublicosAlvo(x);
  const publicoLabel=publico.some(v=>['TODOS','TODAS','PUBLICO','PUBLICA','GERAL'].includes(v))?'TODOS':publico.join(' • ');
  const inicial=(nome.trim().charAt(0)||'C').toUpperCase();
  return `<article class="partner-card ${destaque?'featured':''}">
    <div class="partner-card-top">
      <div class="partner-logo">${img?`<img src="${escapeHtml(img)}" alt="Logo ${escapeHtml(nome)}">`:`<span>${escapeHtml(inicial)}</span>`}</div>
      <div class="partner-heading">
        <small>${destaque?'PARCEIRO EM DESTAQUE':'PARCEIRO CCT'}</small>
        <h3>${escapeHtml(nome)}</h3>
        <em class="partner-audience">PARA: ${escapeHtml(publicoLabel)}</em>
      </div>
      ${destaque?`<span class="partner-star">${uiIcon('star')}</span>`:''}
    </div>
    ${beneficio?`<div class="partner-benefit"><span>BENEFÍCIO</span><strong>${escapeHtml(beneficio)}</strong></div>`:''}
    ${detalhes?`<p class="partner-details">${escapeHtml(detalhes)}</p>`:''}
    ${cupom?`<button class="partner-coupon" type="button" data-copy-coupon="${escapeHtml(cupom)}"><small>CUPOM</small><b>${escapeHtml(cupom)}</b><span>TOQUE PARA COPIAR</span></button>`:''}
    ${link?`<a class="partner-cta" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(cta)} <b>›</b></a>`:''}
  </article>`;
}
function abrirParceiros(){
  const itens=parceirosPublicos();
  const total=itens.length;
  const destaque=itens.filter(x=>isSim(x.DESTAQUE)).length;
  const perfisParceiro=perfilPublicosParceiro();
  const nomesPerfil={ATLETA:'ATLETA',TORCEDOR:'TORCEDOR(A)',MEMBRO:'MEMBRO',SOCIO:'SÓCIO(A)'};
  const perfilTxt=perfisParceiro.map(x=>nomesPerfil[x]||x).join(' + ');
  mc.innerHTML=`
    <div class="partners-head">
      <span class="chip">PARCEIROS CCT</span>
      <div class="partners-title-row">
        <div class="partners-title-icon">${uiIcon('handshake')}</div>
        <div><h2>Quem joga junto com a CCT</h2><p>Benefícios, descontos e marcas que fortalecem nossa Atlética.</p><span class="partners-profile">EXIBINDO VANTAGENS PARA: ${escapeHtml(perfilTxt)}</span></div>
      </div>
      ${total?`<div class="partners-summary"><strong>${total}</strong><span>${total===1?'parceiro ativo':'parceiros ativos'}</span>${destaque?`<em>${destaque} em destaque</em>`:''}</div>`:''}
    </div>
    <div class="partners-list">
      ${total?itens.map(parceiroCardHtml).join(''):`<div class="partner-empty">${uiIcon('handshake')}<strong>Novas parcerias em breve</strong><p>Estamos preparando benefícios e vantagens para a comunidade CCT.</p></div>`}
    </div>
    <button class="partner-join" type="button" data-partner-contact>
      <span>${uiIcon('mail')}</span><div><small>QUER FORTALECER A CCT?</small><strong>Seja um parceiro</strong></div><b>›</b>
    </button>`;
  modal.classList.add('open');
  closeDrawer();
  mc.querySelector('[data-partner-contact]')?.addEventListener('click',()=>abrirContatos('publico'));
  mc.querySelectorAll('[data-copy-coupon]').forEach(btn=>btn.addEventListener('click',async()=>{const cupom=btn.dataset.copyCoupon||'';try{await navigator.clipboard.writeText(cupom);btn.classList.add('copied');const span=btn.querySelector('span');if(span)span.textContent='COPIADO ✓';setTimeout(()=>{btn.classList.remove('copied');if(span)span.textContent='TOQUE PARA COPIAR';},1600);}catch(e){}}));
}
document.querySelectorAll('[data-open="partners"]').forEach(b=>b.onclick=abrirParceiros);
bindAreaMembros();


/* Inicialização V3.8 */
inicializarAutenticacaoCCT();
