/* CCT JOGOS V4.11.0 — Classificação simulada por modalidade.
   Dados oficiais ficam intocados. Previsões vivem só no navegador. */
const SIM_CLASS_KEY='cctSimulacaoModalidadesV411';
const SIM_CLASS_MODAL_KEY='cctSimulacaoModalidadeSelecionadaV411';
let simClassModalidadePorCompeticao={};
try{simClassModalidadePorCompeticao=JSON.parse(localStorage.getItem(SIM_CLASS_MODAL_KEY)||'{}')||{};}catch(e){simClassModalidadePorCompeticao={};}
function simClassNorm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
function simClassNum(v,fallback=0){
  if(v===null||v===undefined||String(v).trim()==='')return fallback;
  const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:fallback;
}
function simClassInt(v){
  const s=String(v??'').trim();
  if(!/^\d{1,4}$/.test(s))return null;
  const n=Number(s);return Number.isSafeInteger(n)?n:null;
}
function simClassStorage(){
  try{
    const v=JSON.parse(localStorage.getItem(SIM_CLASS_KEY)||'{}');
    return v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  }catch(e){return {};}
}
function simClassSaveStorage(v){
  try{localStorage.setItem(SIM_CLASS_KEY,JSON.stringify(v));return true;}catch(e){return false;}
}
function simClassKey(comp,j){return comp+'|'+String(j.ID_JOGO||[j.ID_MODALIDADE,j.FASE,j.GRUPO,j.EQUIPE_A,j.EQUIPE_B,j.DATA,j.HORA].join('|'));}
function simClassTemPlacar(j){
  return simClassInt(j?.PLACAR_A)!==null && simClassInt(j?.PLACAR_B)!==null;
}
function simClassFinalizado(j){
  return ['FINALIZADO','ENCERRADO','FINAL','CONCLUIDO'].includes(simClassNorm(j.STATUS)) || simClassTemPlacar(j);
}
function simClassResultado(j,storage,comp){
  if(simClassFinalizado(j))return {fonte:'OFICIAL',temPlacar:simClassTemPlacar(j),a:simClassInt(j.PLACAR_A),b:simClassInt(j.PLACAR_B),sets:simClassSetsOficiais(j)};
  const p=storage[simClassKey(comp,j)];
  if(simClassTipo(j.ID_MODALIDADE)==='VOL'){
    if(Array.isArray(p?.sets)){
      const check=simClassValidarSets(p.sets);
      if(check.ok)return {fonte:'SIMULADO',temPlacar:true,a:check.a,b:check.b,sets:check.sets,ptsA:check.ptsA,ptsB:check.ptsB};
    }
    return {fonte:'PENDENTE',temPlacar:false,a:null,b:null,legado:!!p};
  }
  const a=simClassInt(p?.a),b=simClassInt(p?.b);
  if(a!==null&&b!==null)return {fonte:'SIMULADO',temPlacar:true,a,b};
  return {fonte:'PENDENTE',temPlacar:false,a:null,b:null};
}
function simClassEhGrupo(j){return /GRUPO|CLASSIFICAT/.test(simClassNorm(j.FASE));}
function simClassTipo(mod){
  const t=simClassNorm(mod);
  if(t.startsWith('VOL'))return 'VOL';
  if(t.startsWith('BAD'))return 'BAD';
  if(t.startsWith('TME'))return 'TME';
  if(t.startsWith('FUT')||t.startsWith('FSC')||t.startsWith('SOC'))return 'EMPATE';
  if(t.startsWith('BAS'))return 'BAS';
  if(t.startsWith('HAN'))return 'HAN';
  return 'VITORIA';
}
function simClassEquipesDefinidas(j){
  const a=String(j.EQUIPE_A||'').trim(),b=String(j.EQUIPE_B||'').trim();
  const simbolos=/^(?:VJ\d+|PJ\d+|VENCEDOR|PERDEDOR|[12][ºO]\s*GRUPO|A DEFINIR|AGUARDANDO|BYE)/i;
  return !!a&&!!b&&!simbolos.test(simClassNorm(a))&&!simbolos.test(simClassNorm(b));
}

/* Cada set regulamentar: 25 pontos (1º/2º), 15 (3º), sempre com 2 de vantagem.
   No placar 2x0 o 3º set fica vazio; no 1x1 o terceiro é obrigatório. */
function simClassValidarSets(sets){
  if(!Array.isArray(sets))return {ok:false,erro:'Preencha os pontos de cada set.'};
  const rows=[];
  for(let i=0;i<3;i++){
    const r=sets[i]||{},sa=String(r.a??'').trim(),sb=String(r.b??'').trim();
    if(sa===''&&sb===''){rows.push(null);continue;}
    const a=simClassInt(sa),b=simClassInt(sb);
    if(a===null||b===null)return {ok:false,erro:'Preencha os dois lados de cada set disputado.'};
    const minimo=i===2?15:25;
    if(Math.max(a,b)<minimo || Math.abs(a-b)<2 ||
      (Math.max(a,b)>minimo && Math.abs(a-b)!==2))
      return {ok:false,erro:(i+1)+'º set inválido: vencedor precisa chegar a '+minimo+' pontos e ter ao menos 2 de vantagem.'};
    rows.push({a,b});
  }
  if(!rows[0]||!rows[1])return {ok:false,erro:'Informe os pontos do 1º e do 2º set.'};
  const wA=rows.slice(0,2).filter(x=>x.a>x.b).length;
  if(wA===1&&!rows[2])return {ok:false,erro:'Com um set para cada equipe, o 3º set até 15 pontos é obrigatório.'};
  if(wA!==1&&rows[2])return {ok:false,erro:'O 3º set só acontece quando os dois primeiros ficam 1×1.'};
  const played=rows.filter(Boolean);
  const a=played.filter(x=>x.a>x.b).length,b=played.length-a;
  const ptsA=played.reduce((n,x)=>n+x.a,0),ptsB=played.reduce((n,x)=>n+x.b,0);
  return {ok:true,sets:played,a,b,ptsA,ptsB};
}
function simClassSetsOficiais(j){
  const sets=[];
  for(let i=1;i<=3;i++){
    const a=simClassInt(j['SET'+i+'_A']),b=simClassInt(j['SET'+i+'_B']);
    if(a!==null&&b!==null)sets.push({a,b});
  }
  return sets;
}
function simClassCoef(pro,contra){
  if(contra===0)return pro>0?Infinity:0;
  return pro/contra;
}
function simClassCompararCoef(p1,c1,p2,c2){
  const a=simClassCoef(p1,c1),b=simClassCoef(p2,c2);
  if(a!==b)return a>b?-1:1;
  if(c1===0&&c2===0 && p1!==p2)return p1>p2?-1:1;
  return 0;
}
function simClassCoefTexto(pro,contra){
  const n=simClassCoef(pro,contra);
  if(!Number.isFinite(n))return '∞';
  return n.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
}
function simClassConfronto(g,primeiro,segundo,comp,store){
  const a=simClassNorm(primeiro.equipe),b=simClassNorm(segundo.equipe);
  for(const j of g.jogos){
    const ja=simClassNorm(j.EQUIPE_A),jb=simClassNorm(j.EQUIPE_B);
    if(!((ja===a&&jb===b)||(ja===b&&jb===a)))continue;
    const res=simClassResultado(j,store,comp);
    if(!res.temPlacar||res.a===res.b)continue;
    const vencedor=res.a>res.b?ja:jb;
    return vencedor===a?-1:1;
  }
  return 0;
}

function simClassValidarPlacar(mod,a,b){
  if(a===null||b===null)return 'Preencha os dois placares usando números inteiros não negativos.';
  const tipo=simClassTipo(mod);
  if(tipo==='VOL'&&!((a===2&&b===0)||(a===2&&b===1)||(b===2&&a===0)||(b===2&&a===1)))
    return 'No vôlei desta competição, informe os sets: 2×0, 2×1, 1×2 ou 0×2.';
  if(tipo==='BAS'&&a===b)return 'O basquete precisa de um vencedor; informe o placar após a prorrogação.';
  return '';
}
function simClassPontos(tipo,a,b){
  if(tipo==='VOL'){
    if(a===2&&b===0)return [3,0];
    if(a===2&&b===1)return [2,1];
    if(b===2&&a===1)return [1,2];
    if(b===2&&a===0)return [0,3];
    return [0,0];
  }
  if(tipo==='BAS'||tipo==='TME')return a>b?[2,1]:[1,2];
  if(tipo==='BAD')return a>b?[3,1]:[1,3];
  if(tipo==='HAN')return a===b?[2,2]:(a>b?[3,1]:[1,3]);
  if(a===b)return tipo==='EMPATE'?[1,1]:[0,0];
  return a>b?[3,0]:[0,3];
}
function simClassDados(comp,mod){
  const jogos=(apiData.jogos||[]).filter(j=>j.ID_COMPETICAO===comp&&j.ID_MODALIDADE===mod&&jogoVisivelNoEscopo(j));
  const linhas=(apiData.classificacao||[]).filter(r=>r.ID_COMPETICAO===comp&&r.ID_MODALIDADE===mod);
  const groups=new Map(),vol=simClassTipo(mod)==='VOL';
  function ensure(group){if(!groups.has(group))groups.set(group,{group,teams:new Map(),jogos:[]});return groups.get(group);}
  for(const r of linhas){
    const g=String(r.GRUPO||'').trim().toUpperCase();if(!g)continue;
    const equipe=String(r.EQUIPE||'').trim();if(!equipe)continue;
    const hasPointsSets=r.PONTOS_SETS_PRO!==undefined&&String(r.PONTOS_SETS_PRO).trim()!=='' &&
      r.PONTOS_SETS_CONTRA!==undefined&&String(r.PONTOS_SETS_CONTRA).trim()!=='';
    const hasGenericPoints=r.PRO!==undefined&&String(r.PRO).trim()!=='' &&
      r.CONTRA!==undefined&&String(r.CONTRA).trim()!=='';
    const played=simClassNum(r.JOGOS)>0;
    ensure(g).teams.set(simClassNorm(equipe),{
      equipe,pontos:simClassNum(r.PONTOS),jogos:simClassNum(r.JOGOS),
      vitorias:simClassNum(r.VITORIAS),empates:simClassNum(r.EMPATES),
      derrotas:simClassNum(r.DERROTAS),
      pro:simClassNum(vol&&hasPointsSets?r.PONTOS_SETS_PRO:r.PRO),
      contra:simClassNum(vol&&hasPointsSets?r.PONTOS_SETS_CONTRA:r.CONTRA),
      pontosCompletos:(!vol&&simClassTipo(mod)!=='TME')||!played||hasPointsSets||hasGenericPoints,
      setsV:simClassNum(r.SETS_VENCIDOS),setsP:simClassNum(r.SETS_PERDIDOS),
      original:simClassNum(r.POSICAO,999),oficial:r
    });
  }
  for(const j of jogos.filter(simClassEhGrupo)){
    const g=String(j.GRUPO||'').trim().toUpperCase();if(!g)continue;
    const grupo=ensure(g);grupo.jogos.push(j);
    if(!simClassEquipesDefinidas(j))continue;
    for(const equipe of [j.EQUIPE_A,j.EQUIPE_B]){
      const key=simClassNorm(equipe);
      if(!grupo.teams.has(key))grupo.teams.set(key,{
        equipe,pontos:0,jogos:0,vitorias:0,empates:0,derrotas:0,
        pro:0,contra:0,pontosCompletos:true,setsV:0,setsP:0,original:999,oficial:null
      });
    }
  }
  return {jogos,linhas,groups};
}
function simClassRankingGrupo(group,mod,comp,store){
  const tipo=simClassTipo(mod);
  const stats=new Map([...group.teams.entries()].map(([k,v])=>[k,{...v}]));
  let previstos=0,oficiais=0,pendentes=0;
  for(const j of group.jogos){
    const r=simClassResultado(j,store,comp);
    if(r.fonte==='OFICIAL'){oficiais++;continue;} // A base já contém o oficial.
    if(!r.temPlacar||!simClassEquipesDefinidas(j)){pendentes++;continue;}
    const [a,b]=[stats.get(simClassNorm(j.EQUIPE_A)),stats.get(simClassNorm(j.EQUIPE_B))];
    if(!a||!b)continue;
    const [pa,pb]=simClassPontos(tipo,r.a,r.b);
    a.pontos+=pa;b.pontos+=pb;a.jogos++;b.jogos++;
    a.pro+=tipo==='VOL'?r.ptsA:r.a;
    a.contra+=tipo==='VOL'?r.ptsB:r.b;
    b.pro+=tipo==='VOL'?r.ptsB:r.b;
    b.contra+=tipo==='VOL'?r.ptsA:r.a;
    if(tipo==='VOL'||tipo==='TME'){a.setsV+=r.a;a.setsP+=r.b;b.setsV+=r.b;b.setsP+=r.a;}
    if(tipo==='BAD'){if(r.a>r.b){a.setsV++;b.setsP++;}else if(r.b>r.a){b.setsV++;a.setsP++;}}
    if(r.a>r.b){a.vitorias++;b.derrotas++;}
    else if(r.a<r.b){b.vitorias++;a.derrotas++;}
    else{a.empates++;b.empates++;}
    previstos++;
  }
  const rows=[...stats.values()].sort((a,b)=>b.pontos-a.pontos);
  let pendenteDesempate=false;
  const criterio=(a,b)=>{
    if(tipo==='VOL'){
      const sets=simClassCompararCoef(a.setsV,a.setsP,b.setsV,b.setsP);
      if(sets)return sets;
      if(a.pontosCompletos&&b.pontosCompletos)
        return simClassCompararCoef(a.pro,a.contra,b.pro,b.contra);
      pendenteDesempate=true;return 0;
    }
    if(tipo==='BAD'){
      if(a.vitorias!==b.vitorias)return b.vitorias-a.vitorias;
      const setDifference=(b.setsV-b.setsP)-(a.setsV-a.setsP);
      if(setDifference)return setDifference;
      return (b.pro-b.contra)-(a.pro-a.contra);
    }
    if(tipo==='TME'){
      const sets=simClassCompararCoef(a.setsV,a.setsV+a.setsP,b.setsV,b.setsV+b.setsP);
      if(sets)return sets;
      if(a.pontosCompletos&&b.pontosCompletos)return simClassCompararCoef(a.pro,a.pro+a.contra,b.pro,b.pro+b.contra);
      pendenteDesempate=true;return 0;
    }
    if(tipo==='HAN'){
      if(a.vitorias!==b.vitorias)return b.vitorias-a.vitorias;
      let k=simClassCompararCoef(a.pro,a.contra,b.pro,b.contra);if(k)return k;
      if(a.contra!==b.contra)return a.contra-b.contra;
      if(a.pro!==b.pro)return b.pro-a.pro;
    }else if(tipo==='BAS'){
      return (b.pro-b.contra)-(a.pro-a.contra);
    }else{
      const saldo=(b.pro-b.contra)-(a.pro-a.contra);
      if(saldo)return saldo;
      if(a.pro!==b.pro)return b.pro-a.pro;
      if(a.contra!==b.contra)return a.contra-b.contra;
    }
    return 0;
  };
  const ordenadas=[];
  for(let i=0;i<rows.length;){
    let end=i+1;while(end<rows.length&&rows[end].pontos===rows[i].pontos)end++;
    const groupTied=rows.slice(i,end);
    groupTied.sort((a,b)=>{
      if(groupTied.length===2){
        const direct=simClassConfronto(group,a,b,comp,store);
        if(direct)return direct;
      }
      const other=criterio(a,b);
      if(other)return other;
      pendenteDesempate=true;
      return a.original-b.original||a.equipe.localeCompare(b.equipe,'pt-BR');
    });
    ordenadas.push(...groupTied);i=end;
  }
  return {rows:ordenadas,previstos,oficiais,pendentes,tipo,pendenteDesempate};
}
function simClassEquipeHtml(nome){
  const n=String(nome||'');
  const code=simClassNorm(n).replace(/\d+$/,'');
  const known=['CAV','CCT','CEART','CEAVI','CEFID','CEO','CEPLAN','CERES','CESFI','ESAG','FAED','CEAD','CESMO'];
  const logo=known.includes(code)?centroMarcaHtml(code,'standing-centre-logo'):'';
  return '<span class="simc-team">'+logo+'<span>'+escapeHtml(n)+'</span></span>';
}

/* V4.11.3 — vagas projetadas, comparativo de segundos e aviso de cortes incertos.
   Art.33 (§§3º-5º): com três grupos avança o melhor segundo; grupos de
   tamanhos diferentes são equalizados sem jogos contra últimos colocados. */
function simClassVagasMataMata(dados){
  const jogos=dados.jogos.filter(j=>!simClassEhGrupo(j));
  const fases=[
    {match:/OITAVA/,expected:16},
    {match:/QUARTA/,expected:8},
    {match:/SEMI/,expected:4},
    {match:/^(?:FINAL|GRANDE FINAL)$/,expected:2}
  ];
  for(const fase of fases){
    const encontrados=jogos.filter(j=>fase.match.test(simClassNorm(j.FASE)));
    if(encontrados.length)return {vagas:Math.min(fase.expected,encontrados.length*2),fase:fase.expected===16?'oitavas':fase.expected===8?'quartas':fase.expected===4?'semifinais':'final',fonte:'CHAVEAMENTO'};
  }
  return {vagas:0,fase:'',fonte:'SEM_MATA_MATA'};
}
function simClassWOFlag(r){
  const st=simClassNorm(r?.STATUS_CLASSIFICACAO||'');
  return ['SIM','S','TRUE','1'].includes(simClassNorm(r?.DESC_WO)) ||
    /DESCLASSIFIC/.test(st);
}
function simClassComparativoSegundo(pack,minimo,mod,comp,store,aplicaEqualizacao){
  const atual=pack.rank.rows[1];
  if(!atual)return null;
  const group=pack.group;
  const dropCount=aplicaEqualizacao?Math.max(0,pack.rank.rows.length-minimo):0;
  const excluidos=new Set(pack.rank.rows.slice(-dropCount || pack.rank.rows.length).map(x=>simClassNorm(x.equipe)));
  if(!dropCount)excluidos.clear();
  const equipe=simClassNorm(atual.equipe),tipo=simClassTipo(mod);
  let pontos=0,jogos=0,vitorias=0,setsV=0,setsP=0,pro=0,contra=0,incompletos=0;
  for(const j of group.jogos){
    const a=simClassNorm(j.EQUIPE_A),b=simClassNorm(j.EQUIPE_B);
    if(a!==equipe&&b!==equipe)continue;
    if(excluidos.has(a)||excluidos.has(b))continue;
    const out=simClassResultado(j,store,comp);
    if(!out.temPlacar){incompletos++;continue;}
    const ladoA=a===equipe,feito=ladoA?out.a:out.b,sofrido=ladoA?out.b:out.a;
    const [ptsA,ptsB]=simClassPontos(tipo,out.a,out.b);
    pontos+=ladoA?ptsA:ptsB;
    jogos++;
    if(feito>sofrido)vitorias++;
    if(tipo==='VOL'){
      setsV+=feito;setsP+=sofrido;
      if(Array.isArray(out.sets)&&out.sets.length){
        pro+=out.sets.reduce((v,set)=>v+(ladoA?set.a:set.b),0);
        contra+=out.sets.reduce((v,set)=>v+(ladoA?set.b:set.a),0);
      }else incompletos++;
    }else{pro+=feito;contra+=sofrido;}
  }
  return {equipe:atual.equipe,grupo:group.group,stats:atual,
    pontos,jogos,vitorias,setsV,setsP,pro,contra,incompletos,
    igualados:dropCount>0,excluidos:[...excluidos]};
}
function simClassCompareSecond(a,b,mod){
  if(a.pontos!==b.pontos)return b.pontos-a.pontos;
  const tipo=simClassTipo(mod);
  if(tipo==='VOL'){
    if(a.incompletos||b.incompletos)return 0;
    const sets=simClassCompararCoef(a.setsV,a.setsP,b.setsV,b.setsP);
    if(sets)return sets;
    return simClassCompararCoef(a.pro,a.contra,b.pro,b.contra);
  }
  if(tipo==='HAN'){
    if(a.vitorias!==b.vitorias)return b.vitorias-a.vitorias;
    let c=simClassCompararCoef(a.pro,a.contra,b.pro,b.contra);if(c)return c;
    if(a.contra!==b.contra)return a.contra-b.contra;
    if(a.pro!==b.pro)return b.pro-a.pro;
    return 0;
  }
  if(tipo==='BAS')return (b.pro-b.contra)-(a.pro-a.contra);
  if(tipo==='BAD'||tipo==='TME'){
    if(a.vitorias!==b.vitorias)return b.vitorias-a.vitorias;
    const avg=simClassCompararCoef(a.setsV,a.setsP,b.setsV,b.setsP);
    if(avg)return avg;
    return simClassCompararCoef(a.pro,a.contra,b.pro,b.contra);
  }
  const sd=(b.pro-b.contra)-(a.pro-a.contra);
  if(sd)return sd;
  if(a.pro!==b.pro)return b.pro-a.pro;
  return 0;
}
function simClassProjecaoClassificados(dados,mod,comp,store){
  const packs=[...dados.groups.values()].sort((a,b)=>a.group.localeCompare(b.group,'pt-BR'))
    .map(group=>({group,rank:simClassRankingGrupo(group,mod,comp,store)}))
    .filter(x=>x.rank.rows.length);
  if(!packs.length)return null;
  const chave=simClassVagasMataMata(dados);
  const totalTimes=packs.reduce((n,x)=>n+x.rank.rows.length,0);
  const vagas=Math.min(chave.vagas,totalTimes);
  const leaders=packs.map(p=>({equipe:p.rank.rows[0].equipe,grupo:p.group.group,tipo:'LIDER',pontos:p.rank.rows[0].pontos,rank:p.rank}));
  const livres=Math.max(0,vagas-leaders.length);
  const minGroup=Math.min(...packs.map(x=>x.rank.rows.length));
  const sizesDiffer=packs.some(x=>x.rank.rows.length!==minGroup);
  const article33=/^(?:VOL|BAS|FUT|SOC|HAN)/.test(simClassNorm(mod));
  const seconds=livres?packs.map(p=>simClassComparativoSegundo(p,minGroup,mod,comp,store,article33&&sizesDiffer)).filter(Boolean):[];
  seconds.sort((a,b)=>simClassCompareSecond(a,b,mod)||a.grupo.localeCompare(b.grupo));
  const qualificados=(!vagas?[]:[
    ...leaders.slice(0,vagas),
    ...seconds.slice(0,livres).map(x=>({...x,tipo:'MELHOR_SEGUNDO',rank:packs.find(p=>p.group.group===x.grupo)?.rank}))
  ]);
  // Modalidades de pontos em fase de grupos para as quais a tabela é comparável
  // com os critérios técnicos já implementados. Modalidades individuais e
  // mata-matas especiais exibem a posição como projeção, nunca homologação.
  const reason=[];
  const tieGroups=packs.filter(p=>p.rank.pendenteDesempate);
  if(tieGroups.length)reason.push('Há empates de grupo que ainda precisam de critérios adicionais.');
  if(livres&&seconds.length>livres&&seconds.some(x=>x.incompletos))reason.push('Há jogos ou parciais pendentes para desempatar os segundos colocados.');
  if(seconds.length>livres&&livres>0){
    const next=seconds[livres],prev=seconds[livres-1];
    if(next&&prev&&simClassCompareSecond(prev,next,mod)===0)
      reason.push('Há empate exatamente na última vaga entre os segundos colocados.');
  }
  const wos=packs.some(x=>x.rank.rows.some(r=>simClassWOFlag(r.oficial)));
  if(wos)reason.push('W.O. registrado: a desclassificação e a exclusão de seus jogos dependem da apuração oficial.');
  if(article33&&sizesDiffer&&livres){
    reason.push('Comparação de segundos ajustada pelo Art. 33, §4º: descartados confrontos contra últimos dos grupos maiores.');
    if(packs.some(p=>p.group.jogos.some(j=>simClassFinalizado(j)&&!simClassTemPlacar(j))))
      reason.push('Há jogos concluídos sem placar numérico para conferir a equalização.');
  }
  const conclusivos=reason.filter(x=>/empate|W\.O\.|sem placar|não permitem/.test(x));
  const uncertain=conclusivos.length>0;
  const pending=packs.some(p=>p.rank.pendentes>0);
  return {packs,chave,vagas,livres,leaders,seconds,qualificados,pendente:pending,incerto:uncertain,avisos:reason,aplicaEqualizacao:article33&&sizesDiffer&&livres>0};
}
function simClassHtmlClassificados(p){
  if(!p)return '';
  if(!p.vagas){
    return '<div class="simc-qualified"><div class="simc-qualified-head"><strong>CLASSIFICAÇÃO ATUAL</strong><span>SEM MATA-MATA</span></div>'+
     '<p>A modalidade não tem fase eliminatória cadastrada. Veja a classificação por grupo; não há vagas de semifinal para projetar.</p></div>';
  }
  const pendente=p.pendente||p.incerto;
  const qtd=p.qualificados.length;
  const summary='<div class="simc-qualified-head"><strong>QUEM CLASSIFICARIA AGORA</strong><span>SIMULAÇÃO • NÃO OFICIAL</span></div>'+
    '<p>'+qtd+' vaga(s) na fase '+escapeHtml(p.chave.fase)+'. '+p.leaders.length+' líder(es) de grupo'+
    (p.livres?' + '+p.livres+' melhor(es) segundo(s).':'.')+
    (pendente?' <b>Há partidas ou critérios pendentes.</b>':'')+'</p>';
  const cards=p.qualificados.map((team,i)=>
    '<div class="simc-qualified-item'+(simClassNorm(team.equipe)==='CCT'?' is-cct':'')+
    '"><div class="simc-qualified-number">'+(i+1)+'</div><div><small>'+
    (team.tipo==='LIDER'?'LÍDER DO GRUPO '+escapeHtml(team.grupo):'MELHOR SEGUNDO • GRUPO '+escapeHtml(team.grupo))+
    '</small><strong>'+simClassEquipeHtml(team.equipe)+'</strong></div>'+
    '<span>'+(team.tipo==='MELHOR_SEGUNDO'?team.pontos+' pts*':team.pontos+' pts')+'</span></div>'
  ).join('');
  const ranking=p.qualificados.some(x=>simClassNorm(x.equipe)==='CCT')
    ?'<div class="simc-qualified-cct is-in">CCT aparece na zona de classificação '+(pendente?'provisória; ainda há resultados ou critérios pendentes.':'deste cenário.')+'</div>'
    :'<div class="simc-qualified-cct">CCT não aparece entre os classificados '+(pendente?'neste momento; há resultados ou critérios pendentes.':'deste cenário.')+'</div>';
  const caveats=p.avisos.length?'<div class="simc-qualified-warnings">'+p.avisos.map(x=>'<p>'+escapeHtml(x)+'</p>').join('')+'</div>':'';
  return '<section class="simc-qualified">'+summary+
    '<div class="simc-qualified-list">'+cards+'</div>'+ranking+
    (p.livres?'<small>* Pontos do segundo após equalização dos grupos quando aplicável.</small>':'')+
    caveats+'</section>';
}
function simClassMarcacao(p,grupo,equipe){
  if(!p?.vagas)return '';
  const r=p.qualificados.find(x=>simClassNorm(x.equipe)===simClassNorm(equipe)&&x.grupo===grupo);
  if(!r)return '';
  return r.tipo==='LIDER'?'LÍDER • CLASSIFICARIA':'MELHOR 2º • CLASSIFICARIA';
}

function simClassTabelaGrupo(g,mod,comp,store,projecao){
  const rank=simClassRankingGrupo(g,mod,comp,store);
  const vol=rank.tipo==='VOL';
  const rows=rank.rows.map((r,i)=>'<div class="simc-rank-row'+(simClassNorm(r.equipe).startsWith('CCT')?' is-cct':'')+'">'+
    '<b class="simc-pos">'+(i+1)+'º</b>'+simClassEquipeHtml(r.equipe)+
    '<span>'+r.jogos+'</span><span>'+r.vitorias+'</span><span>'+r.empates+'</span><span>'+r.derrotas+'</span>'+
    '<strong>'+simClassNum(r.pontos)+'</strong><span>'+(vol?(r.setsV-r.setsP):(r.pro-r.contra))+'</span></div>'+
    (simClassMarcacao(projecao,g.group,r.equipe)?'<div class="simc-qual-row">'+escapeHtml(simClassMarcacao(projecao,g.group,r.equipe))+'</div>':'')+
    (vol?'<div class="simc-coef-detail">Sets '+r.setsV+'–'+r.setsP+' • average '+simClassCoefTexto(r.setsV,r.setsP)+
      ' &nbsp;|&nbsp; Pontos '+(r.pontosCompletos?r.pro+'–'+r.contra+' • average '+simClassCoefTexto(r.pro,r.contra):'oficiais incompletos')+'</div>':'')
  ).join('');
  const subtitle=rank.previstos?rank.previstos+' partida(s) simulada(s) • classificação provisória':
    'Situação atual com os resultados oficiais registrados';
  return '<section class="simc-group">'+
    '<div class="simc-group-title"><strong>Grupo '+escapeHtml(g.group)+'</strong><small>'+escapeHtml(subtitle)+'</small></div>'+
    '<div class="simc-rank-head"><span>#</span><span>Equipe</span><span>J</span><span>V</span><span>E</span><span>D</span><span>Pts</span><span>'+(vol?'Sets':'Saldo')+'</span></div>'+
    '<div class="simc-rank-list">'+(rows||'<p>Sem participantes cadastrados.</p>')+'</div>'+
    (rank.pendenteDesempate?'<p class="simc-note simc-tie-note">Atenção: ainda há empate que depende de dados adicionais ou sorteio. A ordem mostrada não é homologada.</p>':'')+
    '</section>';
}

function simClassModalidadeFinalizada(linhas,jogos){
  if(!Array.isArray(linhas)||!linhas.length)return false;
  const temPosicao=r=>String(r.POSICAO_FINAL_ATUAL??r.POSICAO??'').trim()!=='';
  if(!linhas.every(temPosicao))return false;
  const oficial=r=>['FINALIZADO','ENCERRADO','CONCLUIDO','HOMOLOGADO'].includes(simClassNorm(r.STATUS_FINAL_MODALIDADE));
  if(linhas.every(oficial))return true;
  // Fallback conservador: jogo final oficial registrado, todos os confrontos
  // preenchidos e toda a classificação final publicada.
  // Não basta que "os jogos cadastrados hoje" tenham acabado.
  const temFinal=jogos.some(j=>{
    const fase=simClassNorm(j.FASE);
    return fase==='FINAL'||fase==='GRANDE FINAL';
  });
  return !!temFinal && jogos.length>0 && jogos.every(simClassFinalizado) &&
    linhas.every(r=>String(r.POSICAO_FINAL_ATUAL??'').trim()!=='');
}
function simClassTabelaFinal(linhas,encerrada=false){
  const final=linhas.filter(r=>String(r.POSICAO_FINAL_ATUAL??r.POSICAO??'').trim())
    .sort((a,b)=>simClassNum(a.POSICAO_FINAL_ATUAL??a.POSICAO,999)-simClassNum(b.POSICAO_FINAL_ATUAL??b.POSICAO,999) ||
      String(a.EQUIPE||a.CENTRO||'').localeCompare(String(b.EQUIPE||b.CENTRO||''),'pt-BR'));
  if(!final.length)return '';
  const head=encerrada?'CLASSIFICAÇÃO FINAL OFICIAL':'Classificação publicada';
  const note=encerrada?'Resultados definitivos da modalidade; os cenários não alteram esta classificação.':
    'Esta modalidade não possui tabela de grupos para simular.';
  return '<section class="simc-group simc-official-final"><div class="simc-group-title"><strong>'+head+'</strong><small>'+escapeHtml(note)+'</small></div>'+
    final.map(r=>{
      const pos=String(r.POSICAO_FINAL_ATUAL??r.POSICAO);
      const pts=String(r.PONTOS??'').trim();
      const geral=String(r.PONTOS_GERAL_CONFIRMADOS??'').trim();
      return '<div class="simc-final-row"><b>'+escapeHtml(pos)+'º</b>'+
        simClassEquipeHtml(r.EQUIPE||r.CENTRO||r.PARTICIPANTE)+
        '<div class="simc-final-score"><strong>'+escapeHtml(pts?(pts+' pts'):'—')+'</strong>'+
        (geral?'<small>'+escapeHtml(geral)+' pts no geral</small>':'')+'</div></div>';
    }).join('')+'</section>';
}
function simClassRenderEncerrada(container,comp,chosen,modalidadeSelector,jogos,linhas){
  const name=modalidadeNome(chosen);
  const oficiais=jogos.filter(simClassFinalizado).length;
  container.innerHTML='<div class="simc-shell simc-finished">'+
    '<div class="simc-finished-banner"><div class="simc-finished-status">✓ MODALIDADE FINALIZADA <span>OFICIAL</span></div>'+
    '<h3>'+escapeHtml(name)+'</h3>'+
    '<p>Esta competição já foi concluída. A classificação final está confirmada e não é possível simular novos placares nesta modalidade.</p></div>'+
    modalidadeSelector+
    simClassTabelaFinal(linhas,true)+
    (jogos.length?
      '<div class="simc-final-games-head"><strong>RESULTADOS REGISTRADOS</strong><small>'+oficiais+
      ' resultado(s) oficial(is)</small></div>'+
      simClassPartidasHtml(jogos,comp,chosen,{},'Partidas da modalidade',true):
      '<p class="simc-note">Não há partidas individuais cadastradas para esta modalidade; a classificação final oficial está disponível acima.</p>')+
    '<p class="simc-footer">A classificação final vem do painel oficial e não pode ser alterada por simulações salvas neste aparelho.</p></div>';
  const introTitle=document.querySelector('#cenariosIntroTitle');
  const introText=document.querySelector('#cenariosIntroText');
  if(introTitle)introTitle.textContent='Modalidade finalizada';
  if(introText)introText.textContent='Classificação final oficial e resultados confirmados.';
  container.querySelector('#simcModalidade')?.addEventListener('change',ev=>{
    simClassModalidadePorCompeticao[comp]=ev.target.value;
    try{localStorage.setItem(SIM_CLASS_MODAL_KEY,JSON.stringify(simClassModalidadePorCompeticao));}catch(e){}
    simClassificacaoRender(container,comp);
  });
  return true;
}
function simClassPartidaHtml(j,comp,mod,store,readonly=false){
  const result=simClassResultado(j,store,comp);
  const key=simClassKey(comp,j),editable=!readonly && result.fonte!=='OFICIAL'&&simClassEquipesDefinidas(j);
  const volley=simClassTipo(mod)==='VOL';
  const cls=result.fonte==='OFICIAL'?'oficial':result.fonte==='SIMULADO'?'simulado':'pendente';
  const badge=result.fonte==='OFICIAL'?'OFICIAL':result.fonte==='SIMULADO'?'SIMULADO':readonly?'SEM PLACAR':'A JOGAR';
  const fase=String(j.FASE||'').trim();
  const score=result.temPlacar?result.a+' × '+result.b:'— × —';
  const prediction=store[key]||{};
  const oficiais=volley&&result.fonte==='OFICIAL'&&result.sets?.length?
    '<p class="simc-set-summary">Sets: '+result.sets.map((x,i)=>(i+1)+'º '+x.a+'×'+x.b).join(' • ')+'</p>':'';
  let entrada='';
  if(editable&&volley){
    const pv=Array.isArray(prediction.sets)?prediction.sets:[];
    const setRows=[0,1,2].map(i=>{
      const x=pv[i]||{};
      return '<div class="simc-set-row"><span>'+ (i+1)+'º set</span>'+
        '<input aria-label="'+escapeHtml(j.EQUIPE_A)+' '+(i+1)+'º set" type="number" inputmode="numeric" min="0" step="1" data-simc-set="'+i+'" data-simc-side="a" value="'+escapeHtml(String(x.a??''))+'" placeholder="—">'+
        '<span>×</span>'+
        '<input aria-label="'+escapeHtml(j.EQUIPE_B)+' '+(i+1)+'º set" type="number" inputmode="numeric" min="0" step="1" data-simc-set="'+i+'" data-simc-side="b" value="'+escapeHtml(String(x.b??''))+'" placeholder="—"></div>';
    }).join('');
    entrada='<div class="simc-sets-editor"><strong>PONTUAÇÃO DE CADA SET</strong>'+
      '<div class="simc-sets-labels"><span>Set</span><span>'+escapeHtml(j.EQUIPE_A)+'</span><span></span><span>'+escapeHtml(j.EQUIPE_B)+'</span></div>'+
      setRows+'<small>1º e 2º até 25 pontos. Se houver 1×1, preencha o 3º até 15. Sempre com 2 pontos de vantagem.</small>'+
      (result.legado?'<small class="simc-legacy">A previsão anterior tinha só os sets vencidos. Informe os pontos de cada set para validá-la.</small>':'')+
      '</div><div class="simc-actions"><button type="button" data-simc-apply>APLICAR PLACAR</button>'+
      (prediction.sets||result.legado?'<button type="button" class="simc-clear" data-simc-clear>APAGAR</button>':'')+'</div>';
  }else if(editable){
    entrada='<div class="simc-score-entry"><label>'+escapeHtml(j.EQUIPE_A)+
      '<input type="number" min="0" max="9999" step="1" inputmode="numeric" data-simc-a value="'+escapeHtml(String(prediction.a??''))+'" placeholder="—"></label>'+
      '<span>×</span><label>'+escapeHtml(j.EQUIPE_B)+
      '<input type="number" min="0" max="9999" step="1" inputmode="numeric" data-simc-b value="'+escapeHtml(String(prediction.b??''))+'" placeholder="—"></label>'+
      '<button type="button" data-simc-apply>APLICAR</button>'+
      (result.fonte==='SIMULADO'?'<button type="button" class="simc-clear" data-simc-clear>APAGAR</button>':'')+
      '</div>';
  }
  return '<article class="simc-match '+cls+'" data-simc-match="'+escapeHtml(key)+'">'+
    '<div class="simc-match-meta"><span>'+escapeHtml([j.DATA,j.HORA].filter(Boolean).join(' • ')||'Horário a definir')+'</span><b>'+badge+'</b></div>'+
    '<div class="simc-match-teams">'+simClassEquipeHtml(j.EQUIPE_A)+
    '<b>'+escapeHtml(score)+'</b>'+simClassEquipeHtml(j.EQUIPE_B)+'</div>'+
    oficiais+
    (editable?entrada+'<small class="simc-error" data-simc-error aria-live="polite"></small>'
      :'<div class="simc-match-locked">'+(result.fonte==='OFICIAL'
        ?'Resultado oficial • não editável'
        :readonly?'Placar não registrado no painel oficial.': 'Aguardando definição das equipes para permitir simulação')+'</div>')+
    (fase&&!simClassEhGrupo(j)?'<small class="simc-phase">'+escapeHtml(fase)+'</small>':'')+
    '</article>';
}

function simClassPartidasHtml(lista,comp,mod,store,title,readonly=false){
  if(!lista.length)return '';
  const jogos=[...lista].sort((a,b)=>{
    const da=parseBrDate(a.DATA,a.HORA)?.getTime()||0,db=parseBrDate(b.DATA,b.HORA)?.getTime()||0;
    return da-db||String(a.ID_JOGO||'').localeCompare(String(b.ID_JOGO||''));
  });
  return '<section class="simc-fixtures"><div class="simc-fixtures-head"><strong>'+escapeHtml(title)+'</strong><small>'+
     jogos.length+' partida(s)</small></div>'+jogos.map(j=>simClassPartidaHtml(j,comp,mod,store,readonly)).join('')+'</section>';
}
function simClassificacaoRender(container,comp){
  const compJogos=(apiData.jogos||[]).filter(j=>j.ID_COMPETICAO===comp&&jogoVisivelNoEscopo(j));
  const compClass=(apiData.classificacao||[]).filter(r=>r.ID_COMPETICAO===comp);
  const mods=[...new Set([...compJogos.map(j=>j.ID_MODALIDADE),...compClass.map(r=>r.ID_MODALIDADE)].filter(Boolean))];
  if(!mods.length)return false;
  mods.sort((a,b)=>modalidadeNome(a).localeCompare(modalidadeNome(b),'pt-BR'));
  let chosen=simClassModalidadePorCompeticao[comp];
  if(!mods.includes(chosen)){
    const preferred=profileSportIds().find(id=>mods.includes(id));
    chosen=preferred||mods.find(id=>compJogos.some(j=>j.ID_MODALIDADE===id&&jogoTemCCT(j)))||mods[0];
  }
  simClassModalidadePorCompeticao[comp]=chosen;
  const {jogos,linhas,groups}=simClassDados(comp,chosen);
  const store=simClassStorage();
  const predicted=jogos.filter(j=>simClassResultado(j,store,comp).fonte==='SIMULADO').length;
  const official=jogos.filter(j=>simClassResultado(j,store,comp).fonte==='OFICIAL').length;
  const selectedName=modalidadeNome(chosen);
  const modalidadeSelector='<div class="simc-select-wrap"><label for="simcModalidade">MODALIDADE</label>'+
    '<select id="simcModalidade" aria-label="Escolher modalidade para simular">'+
    mods.map(id=>{
      const encerrada=simClassModalidadeFinalizada(
        compClass.filter(r=>r.ID_MODALIDADE===id),
        compJogos.filter(j=>j.ID_MODALIDADE===id)
      );
      return '<option value="'+escapeHtml(id)+'"'+(id===chosen?' selected':'')+'>'+
        escapeHtml(modalidadeNome(id)+(encerrada?' ✓ FINALIZADA':''))+'</option>';
    }).join('')+
    '</select></div>';
  if(simClassModalidadeFinalizada(linhas,jogos))
    return simClassRenderEncerrada(container,comp,chosen,modalidadeSelector,jogos,linhas);
  const projecao=simClassProjecaoClassificados({jogos,linhas,groups},chosen,comp,store);
  let tables=[...groups.values()].sort((a,b)=>a.group.localeCompare(b.group,'pt-BR')).map(g=>simClassTabelaGrupo(g,chosen,comp,store,projecao)).join('');
  if(!tables)tables=simClassTabelaFinal(linhas);
  const gamesGroups=[...groups.values()].sort((a,b)=>a.group.localeCompare(b.group,'pt-BR'))
    .map(g=>simClassPartidasHtml(g.jogos,comp,chosen,store,'Resultados e próximos jogos — Grupo '+g.group)).join('');
  const extra=jogos.filter(j=>!simClassEhGrupo(j));
  container.innerHTML='<div class="simc-shell">'+
    '<div class="simc-intro"><strong>CLASSIFICAÇÃO SIMULADA <span>NÃO OFICIAL</span></strong>'+
    '<p>Os resultados reais são mantidos. Preencha os jogos futuros e aplique para atualizar a tabela, sem alterar os dados da organização.</p></div>'+
    modalidadeSelector+
    '<div class="simc-stats"><span><b>'+official+'</b> jogos oficiais</span><span><b>'+predicted+'</b> jogos simulados</span>'+
    '<button type="button" data-simc-reset'+(!predicted?' disabled':'')+'>ZERAR SIMULAÇÃO</button></div>'+
    simClassHtmlClassificados(projecao)+
    (tables?'<div class="simc-tables"><h3>Classificação • '+escapeHtml(selectedName)+'</h3>'+tables+
      '<p class="simc-note">Tabela de teste com resultados oficiais e simulados. No vôlei, são considerados pontos por set, confronto direto, coeficiente de sets e coeficiente de pontos; os critérios pendentes ficam sinalizados. A organização homologa a classificação final.</p></div>':
      '<div class="games-empty">Sem classificação cadastrada para esta modalidade.</div>')+
    gamesGroups+
    simClassPartidasHtml(extra,comp,chosen,store,'Mata-mata e demais confrontos')+
    (!jogos.length?'<p class="simc-note">Não há confrontos cadastrados nesta modalidade. A classificação publicada permanece disponível acima.</p>':'')+
    '<p class="simc-footer">As simulações ficam salvas somente neste aparelho e não são enviadas ao painel oficial. Jogos encerrados nunca são sobrescritos.</p></div>';
  const introTitle=document.querySelector('#cenariosIntroTitle'),introText=document.querySelector('#cenariosIntroText');
  if(introTitle)introTitle.textContent='Classificação simulada por modalidade';
  if(introText)introText.textContent='Resultados oficiais + placares futuros escolhidos por você.';
  const selector=container.querySelector('#simcModalidade');
  selector?.addEventListener('change',()=>{
    simClassModalidadePorCompeticao[comp]=selector.value;
    try{localStorage.setItem(SIM_CLASS_MODAL_KEY,JSON.stringify(simClassModalidadePorCompeticao));}catch(e){}
    simClassificacaoRender(container,comp);
  });
  container.querySelectorAll('[data-simc-match]').forEach(card=>{
    const key=card.getAttribute('data-simc-match');
    card.querySelector('[data-simc-apply]')?.addEventListener('click',()=>{
      const j=jogos.find(x=>simClassKey(comp,x)===key);if(!j||simClassFinalizado(j))return;
      const msg=card.querySelector('[data-simc-error]');
      let dataResult=null,err='';
      if(simClassTipo(chosen)==='VOL'){
        const sets=[0,1,2].map(i=>({
          a:card.querySelector('[data-simc-set="'+i+'"][data-simc-side="a"]')?.value??'',
          b:card.querySelector('[data-simc-set="'+i+'"][data-simc-side="b"]')?.value??''
        }));
        const check=simClassValidarSets(sets);
        if(check.ok)dataResult={a:check.a,b:check.b,sets:check.sets};
        else err=check.erro;
      }else{
        const a=simClassInt(card.querySelector('[data-simc-a]')?.value);
        const b=simClassInt(card.querySelector('[data-simc-b]')?.value);
        err=simClassValidarPlacar(chosen,a,b);
        if(!err)dataResult={a,b};
      }
      if(err){if(msg)msg.textContent=err;return;}
      const data=simClassStorage();data[key]=dataResult;
      if(!simClassSaveStorage(data)){if(msg)msg.textContent='Não foi possível salvar neste aparelho.';return;}
      simClassificacaoRender(container,comp);
    });
    card.querySelector('[data-simc-clear]')?.addEventListener('click',()=>{
      const data=simClassStorage();delete data[key];
      if(simClassSaveStorage(data))simClassificacaoRender(container,comp);
    });
  });
  container.querySelector('[data-simc-reset]')?.addEventListener('click',()=>{
    if(!window.confirm('Apagar todos os resultados simulados desta modalidade neste aparelho?'))return;
    const data=simClassStorage(),keys=jogos.map(j=>simClassKey(comp,j));
    keys.forEach(k=>delete data[k]);
    if(simClassSaveStorage(data))simClassificacaoRender(container,comp);
  });
  return true;
}
