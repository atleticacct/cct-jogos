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
  modalidades: []
};

let jogosUI = {
  competicao: 'INTERLAJE-2026',
  tipo: 'todos',
  filtro: 'hoje'
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
    return (p?.sports||[]).map(x=>MODALIDADE_IDS[x]).filter(Boolean);
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
    'FUT-F':'Futsal Feminino','FUT-M':'Futsal Masculino','VOL-F':'Vôlei Feminino','VOL-M':'Vôlei Masculino',
    'BAS-F':'Basquete Feminino','BAS-M':'Basquete Masculino','HAN-F':'Handebol Feminino','HAN-M':'Handebol Masculino'
  };
  return fallback[id]||id||'';
}

function jogoTemCCT(jogo){
  return String(jogo.EQUIPE_A||'').trim().toUpperCase()==='CCT' || String(jogo.EQUIPE_B||'').trim().toUpperCase()==='CCT';
}

function isFinalizado(jogo){
  return String(jogo.STATUS||'').trim().toUpperCase()==='FINALIZADO';
}

function placarOuHora(jogo){
  const temPlacar=jogo.PLACAR_A!=='' && jogo.PLACAR_B!=='';
  return temPlacar ? `${jogo.PLACAR_A} × ${jogo.PLACAR_B}` : (jogo.HORA||'--:--');
}

function matchCard(jogo,{home=false}={}){
  const cctA=String(jogo.EQUIPE_A||'').trim().toUpperCase()==='CCT';
  const cctB=String(jogo.EQUIPE_B||'').trim().toUpperCase()==='CCT';
  const fase=jogo.GRUPO ? `GRUPO ${jogo.GRUPO}` : (jogo.FASE||'');
  const status=jogo.STATUS||'';
  const comp=competitionName(jogo.ID_COMPETICAO);
  const modalidade=modalidadeNome(jogo.ID_MODALIDADE);
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
    </article>`;
}

function jogosFiltrados(){
  const now=new Date();
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const sports=selectedSportIds();
  return apiData.jogos
    .filter(j=>j.ID_COMPETICAO===jogosUI.competicao)
    .filter(j=>{
      if(jogosUI.tipo!=='meus') return true;
      return jogoTemCCT(j) && (!sports.length || sports.includes(j.ID_MODALIDADE));
    })
    .filter(j=>{
      if(jogosUI.filtro==='todos') return true;
      if(jogosUI.filtro==='VOL' || jogosUI.filtro==='FUT') return String(j.ID_MODALIDADE||'').startsWith(jogosUI.filtro+'-');
      const d=parseBrDate(j.DATA,j.HORA);
      if(jogosUI.filtro==='hoje') return sameDay(d,now);
      if(jogosUI.filtro==='amanha') return sameDay(d,tomorrow);
      return true;
    })
    .sort((a,b)=>(parseBrDate(a.DATA,a.HORA)?.getTime()||0)-(parseBrDate(b.DATA,b.HORA)?.getTime()||0));
}

function renderizarJogos(){
  const container=$('#jogosContainer');
  if(!container) return;
  const jogos=jogosFiltrados();
  const resumo=$('#jogosResumo');
  if(resumo) resumo.textContent=`${jogos.length} ${jogos.length===1?'jogo encontrado':'jogos encontrados'}`;
  container.innerHTML=jogos.length ? jogos.map(j=>matchCard(j)).join('') : '<div class="games-empty">Nenhum jogo encontrado com esses filtros.</div>';
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
  container.innerHTML=proximo ? matchCard(proximo,{home:true}) : '<div class="games-empty">Nenhum próximo jogo da CCT encontrado.</div>';
}

function bindJogosUI(){
  $$('#tipoJogos [data-tipo-jogos]').forEach(btn=>btn.addEventListener('click',()=>{
    jogosUI.tipo=btn.dataset.tipoJogos;
    $$('#tipoJogos [data-tipo-jogos]').forEach(x=>x.classList.toggle('selected',x===btn));
    renderizarJogos();
  }));
  $$('#filtrosJogos [data-filtro]').forEach(btn=>btn.addEventListener('click',()=>{
    jogosUI.filtro=btn.dataset.filtro;
    $$('#filtrosJogos [data-filtro]').forEach(x=>x.classList.toggle('selected',x===btn));
    renderizarJogos();
  }));
  $('#competicaoBtn')?.addEventListener('click',abrirSeletorCompeticao);
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
    const nome=$('#competicaoNome'); if(nome) nome.textContent=competitionName(jogosUI.competicao);
    $('#modal')?.classList.remove('open');
    renderizarJogos();
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
    if(!apiData.competicoes.some(c=>c.ID_COMPETICAO===jogosUI.competicao) && apiData.competicoes[0]) jogosUI.competicao=apiData.competicoes[0].ID_COMPETICAO;
    const nome=$('#competicaoNome'); if(nome) nome.textContent=competitionName(jogosUI.competicao);
    renderizarJogos();
    renderizarProximoJogoHome();
    console.log('API CCT carregada:',apiData);
  }catch(erro){
    console.error('Erro ao carregar API CCT:',erro);
    const container=$('#jogosContainer'); if(container) container.innerHTML='<div class="games-empty">Não foi possível atualizar os jogos agora.</div>';
    const home=$('#homeNextGameContainer'); if(home) home.innerHTML='<div class="games-empty">Não foi possível atualizar o próximo jogo agora.</div>';
  }
}

bindJogosUI();
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
  scenario:`<span class="chip live">VÔLEI MASCULINO • GRUPO A</span><h2>🎯 O que a CCT precisa?</h2>
  <div class="modal-list"><div><strong>🟢 Vitória por 2×0</strong><small>Classificação garantida para a próxima fase.</small></div>
  <div><strong>🟡 Vitória por 2×1</strong><small>A classificação pode depender do resultado de Engenharia × Direito.</small></div>
  <div><strong>🔴 Derrota</strong><small>O cenário fica desfavorável e depende dos demais resultados.</small></div></div>
  <h3>IMPORTANTE</h3><p>Este conteúdo é demonstrativo. Na versão real, os cenários serão calculados conforme o regulamento oficial de cada competição e modalidade.</p>`,
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
$('#alertBtn').onclick=()=>{mc.innerHTML=`<span class="chip live">2 NOVOS</span><h2>🔔 Avisos</h2><div class="modal-list"><div><strong>Futsal Masculino alterado</strong><small>Novo horário: hoje, 19:30.</small></div><div><strong>Interlaje 2026</strong><small>Tabela de jogos atualizada.</small></div></div>`;modal.classList.add('open')};

setTimeout(()=>$('#splash').classList.add('hide'),1500);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}

const memberBtn=document.querySelector('#demoMemberAccess');
if(memberBtn){
  memberBtn.addEventListener('click',()=>{
    document.querySelector('#memberLock').hidden=true;
    document.querySelector('#memberDashboard').hidden=false;
  });
}

(function(){const KEY='cctProfileV2',sports=[...document.querySelectorAll('#sportGrid input[data-sport]')],count=document.getElementById('sportsCount'),summary=document.getElementById('profileSummary'),name=document.getElementById('profileNameDisplay'),feedback=document.getElementById('saveFeedback');const selected=()=>sports.filter(x=>x.checked).map(x=>x.dataset.sport);function update(){const n=selected().length;if(count)count.textContent=`${n} ${n===1?'selecionada':'selecionadas'}`;if(summary)summary.textContent=n?`${n} ${n===1?'modalidade selecionada':'modalidades selecionadas'}`:'Escolha suas modalidades'}function save(){const p={name:name?.textContent?.trim()||'Guilherme',sports:selected()};['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>p[k]=!!document.getElementById(k)?.checked);localStorage.setItem(KEY,JSON.stringify(p));update();renderizarJogos();renderizarProximoJogoHome();if(feedback){feedback.classList.add('show');setTimeout(()=>feedback.classList.remove('show'),2200)}}try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p){if(p.name&&name)name.textContent=p.name;sports.forEach(x=>x.checked=(p.sports||[]).includes(x.dataset.sport));['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>{const e=document.getElementById(k);if(e&&typeof p[k]==='boolean')e.checked=p[k]})}}catch(e){}sports.forEach(x=>x.addEventListener('change',update));document.getElementById('saveProfileBtn')?.addEventListener('click',save);document.getElementById('editProfileBtn')?.addEventListener('click',()=>{const v=prompt('Como você quer aparecer no app?',name?.textContent||'Guilherme');if(v&&v.trim()){name.textContent=v.trim();save()}});update()})();

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
loadCctEvents();
