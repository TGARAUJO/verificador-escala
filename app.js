 // ── Configuração ──────────────────────────────────────────────
  const SUPABASE_URL_FIXED = 'https://xtatuioubztlylhiovan.supabase.co';
  const SUPABASE_KEY_FIXED = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0YXR1aW91Ynp0bHlsaGlvdmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTM2NjMsImV4cCI6MjA5NDc4OTY2M30.v4XUcr3HqsVUTpx83f9iBPwwVqaweQ7Xlq81A70L1f4';
  const SUPABASE_URL_KEY   = 'escala_supabase_url';
  const SUPABASE_KEY_KEY   = 'escala_supabase_key';

  

  const MONTHS   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const DAYS     = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const DIASNOME = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const CORES    = ["#e8c97a","#64c878","#7ab4e8","#e87aa0","#c87ae8","#e8a87a","#78c8e8"];

  const today = new Date();
  let viewYear    = today.getFullYear();
  let viewMonth   = today.getMonth();
  let selectedDate = null;
  let colaboradores = [];
  let supabaseClient = null;
  let currentSection = 'calendar';

  // ── Toast ─────────────────────────────────────────────────────
  function toast(msg, type = 'success', duration = 3000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-fade-out');
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  // ── Confirm dialog ────────────────────────────────────────────
  let _confirmResolve = null;
  function showConfirm(title, msg) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent   = msg;
    document.getElementById('confirmOverlay').classList.remove('hidden');
    return new Promise(resolve => { _confirmResolve = resolve; });
  }
  function closeConfirm(result = false) {
    document.getElementById('confirmOverlay').classList.add('hidden');
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
  }
  document.getElementById('confirmOkBtn').addEventListener('click', () => closeConfirm(true));

  // ── Seções ────────────────────────────────────────────────────
  function showSection(name) {
    currentSection = name;
    document.getElementById('sectionCalendar').classList.toggle('hidden', name !== 'calendar');
    document.getElementById('sectionReport').classList.toggle('hidden',   name !== 'report');
    document.getElementById('sectionConfig').classList.toggle('hidden',   name !== 'config');
    document.getElementById('sectionUsers').classList.toggle('hidden',    name !== 'users');

    // Highlight active nav button
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const idx = { calendar: 0, report: 1, config: 2, users: 3 }[name] ?? 0;
    const btns = document.querySelectorAll('.nav-btn');
    if (btns[idx]) btns[idx].classList.add('active');

    if (name === 'report') {
      popularFiltros();
      atualizarRelatorio();
      renderMarcosRelatorio();
    }
    if (name === 'users') carregarUtilizadores();
  }

  // ── Modal ─────────────────────────────────────────────────────
  function openModal(col = null) {
    const isEdit = col !== null;
    document.getElementById('modalTitle').textContent    = isEdit ? 'Editar Colaborador' : 'Novo Colaborador';
    document.getElementById('modalSubtitle').textContent = isEdit ? 'Altere os dados do colaborador' : 'Preencha os dados para cadastrar na escala';
    document.getElementById('btnSalvarText').textContent = isEdit ? 'Salvar alterações' : 'Adicionar';
    document.getElementById('editingId').value           = isEdit ? col.id : '';
    document.getElementById('inputNome').value           = isEdit ? col.nome : '';
    document.getElementById('inputTipo').value           = isEdit ? col.tipo : '12x36';
    document.getElementById('inputRef').value            = isEdit ? col.dataReferencia : '';
    document.getElementById('modalOverlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('inputNome').focus(), 50);
  }
  function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
  }
  // Fecha ao clicar fora
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  // Fecha com ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeConfirm(); }
  });

  // ── DB Status ─────────────────────────────────────────────────
  function setDbStatus(state, text) {
    document.getElementById('dbDot').className  = 'db-dot ' + state;
    document.getElementById('dbStatusText').textContent = text;
  }

  // ── Supabase ──────────────────────────────────────────────────
  async function conectarSupabase(silent = false) {
    let url = document.getElementById('cfgUrl')?.value.trim() || SUPABASE_URL_FIXED;
    let key = document.getElementById('cfgKey')?.value.trim() || SUPABASE_KEY_FIXED;

    if (!url || !key) {
      if (!silent) mostrarErroConfig('Preencha a URL e a chave antes de conectar.');
      return false;
    }

    setDbStatus('loading', 'Conectando…');
    document.getElementById('configError').style.display = 'none';

    // Detecta abertura via file://
    if (location.protocol === 'file:') {
      supabaseClient = null;
      setDbStatus('error', 'Modo local (sem banco)');
      const aviso = 'Arquivo aberto via file://. Para conectar ao Supabase, hospede em um servidor HTTP (ex: VS Code Live Server, http-server, ou acesse via claude.ai/artifacts).';
      mostrarErroConfig(aviso);
      if (!silent) toast('⚠️ ' + aviso, 'info', 7000);
      await carregarColaboradores();
      return false;
    }

    try {
      supabaseClient = supabase.createClient(url, key, {
        auth: { persistSession: false }
      });

      const { data, error } = await supabaseClient
        .from('colaboradores')
        .select('id')
        .limit(1);

      if (error) throw new Error(error.message);

      localStorage.setItem(SUPABASE_URL_KEY, url);
      localStorage.setItem(SUPABASE_KEY_KEY, key);
      setDbStatus('connected', 'Conectado');
      await carregarColaboradores();
      if (!silent) toast('Conectado ao banco de dados!', 'success');
      return true;
    } catch (err) {
      supabaseClient = null;
      setDbStatus('error', 'Erro de conexão');
      const msg = err.name === 'DataCloneError'
        ? 'Erro de contexto (DataCloneError). Abra via servidor HTTP, não pelo explorador de arquivos.'
        : 'Falha ao conectar: ' + err.message;
      mostrarErroConfig(msg);
      if (!silent) toast(msg, 'error', 6000);
      await carregarColaboradores();
      return false;
    }
  }

  function mostrarErroConfig(msg) {
    const el = document.getElementById('configError');
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function carregarColaboradores() {
    if (!supabaseClient) {
      const salvo = localStorage.getItem('colaboradores_local');
      if (salvo) colaboradores = JSON.parse(salvo);
      renderSidebar(); renderCalendar();
      if (selectedDate) renderDetail();
      return;
    }

    document.getElementById('sidebarColabs').innerHTML =
      '<div class="loading-row"><div class="spinner"></div> Carregando…</div>';

    const { data, error } = await supabaseClient
      .from('colaboradores').select('*').order('created_at', { ascending: true });

    if (error) {
      document.getElementById('sidebarColabs').innerHTML =
        '<div class="sidebar-empty">Erro ao carregar dados.</div>';
      return;
    }

    colaboradores = data;
    renderSidebar(); renderCalendar();
    if (selectedDate) renderDetail();
  }

  // ── CRUD ──────────────────────────────────────────────────────
  async function salvarColaborador() {
    const nome = document.getElementById('inputNome').value.trim();
    const tipo = document.getElementById('inputTipo').value;
    const ref  = document.getElementById('inputRef').value;
    const editId = document.getElementById('editingId').value;

    if (!nome) { toast('Informe o nome do colaborador.', 'error'); document.getElementById('inputNome').focus(); return; }
    if (!ref)  { toast('Informe a data de referência.', 'error');  document.getElementById('inputRef').focus();  return; }

    const btn = document.getElementById('btnSalvar');
    btn.disabled = true;
    document.getElementById('btnSalvarText').textContent = 'Salvando…';

    const isEdit = !!editId;

    if (!supabaseClient) {
      // Fallback local
      if (isEdit) {
        const i = colaboradores.findIndex(c => String(c.id) === editId);
        if (i >= 0) colaboradores[i] = { ...colaboradores[i], nome, tipo, dataReferencia: ref };
      } else {
        colaboradores.push({ id: Date.now(), nome, tipo, dataReferencia: ref });
      }
      localStorage.setItem('colaboradores_local', JSON.stringify(colaboradores));
      closeModal();
      renderSidebar(); renderCalendar();
      if (selectedDate) renderDetail();
      toast(isEdit ? 'Colaborador atualizado!' : 'Colaborador adicionado!', 'success');
      btn.disabled = false;
      document.getElementById('btnSalvarText').textContent = isEdit ? 'Salvar alterações' : 'Adicionar';
      return;
    }

    let error;
    if (isEdit) {
      ({ error } = await supabaseClient.from('colaboradores')
        .update({ nome, tipo, dataReferencia: ref }).eq('id', editId));
    } else {
      ({ error } = await supabaseClient.from('colaboradores')
        .insert([{ nome, tipo, dataReferencia: ref }]));
    }

    btn.disabled = false;
    document.getElementById('btnSalvarText').textContent = isEdit ? 'Salvar alterações' : 'Adicionar';

    if (error) {
      toast('Erro: ' + error.message, 'error');
    } else {
      closeModal();
      await carregarColaboradores();
      toast(isEdit ? 'Colaborador atualizado!' : 'Colaborador adicionado!', 'success');
    }
  }

  async function removeColaborador(id, nome) {
    const ok = await showConfirm(
      `Remover "${nome}"?`,
      'O colaborador será removido da escala permanentemente. Esta ação não pode ser desfeita.'
    );
    if (!ok) return;

    if (!supabaseClient) {
      colaboradores = colaboradores.filter(c => c.id !== id);
      localStorage.setItem('colaboradores_local', JSON.stringify(colaboradores));
      renderSidebar(); renderCalendar();
      if (selectedDate) renderDetail();
      toast(`${nome} removido.`, 'info');
      return;
    }

    const { error } = await supabaseClient.from('colaboradores').delete().eq('id', id);
    if (error) {
      toast('Erro ao remover: ' + error.message, 'error');
    } else {
      await carregarColaboradores();
      toast(`${nome} removido.`, 'info');
    }
  }

  function editarColaborador(id) {
    const col = colaboradores.find(c => String(c.id) === String(id));
    if (col) openModal(col);
  }

  // ── Render Sidebar ────────────────────────────────────────────
  function renderSidebar() {
    const el = document.getElementById('sidebarColabs');
    if (colaboradores.length === 0) {
      el.innerHTML = '<div class="sidebar-empty">Nenhum colaborador.<br>Adicione usando o botão abaixo.</div>';
      return;
    }
    el.innerHTML = colaboradores.map((col, idx) => {
      const cor = CORES[idx % CORES.length];
      return `
        <div class="colab-card">
          <div class="colab-dot" style="background:${cor};"></div>
          <div class="colab-info">
            <div class="colab-name">${col.nome}</div>
            <div class="colab-sub">${col.tipo}</div>
          </div>
          <div class="colab-actions">
            <button class="icon-btn edit" title="Editar" onclick="editarColaborador(${col.id})">✏️</button>
            <button class="icon-btn del"  title="Remover" onclick="removeColaborador(${col.id}, '${col.nome.replace(/'/g,"\\'")}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Calendar ──────────────────────────────────────────────────
  function goToday() { viewYear = today.getFullYear(); viewMonth = today.getMonth(); renderCalendar(); }
  function changeMonth(dir) {
    viewMonth += dir;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
    renderCalendar();
  }

  function getDaysBetween(d1, d2) { return Math.round((d2 - d1) / 86400000); }
  function isWorkDay(date, col) {
    const ref  = new Date(col.dataReferencia + 'T00:00:00');
    const diff = getDaysBetween(ref, date);
    if (diff < 0) return null;
    const cycle = col.tipo === '12x36' ? 2 : 4;
    return diff % cycle === 0;
  }

  function renderCalendar() {
    document.getElementById('calTitle').textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    document.getElementById('calHeader').innerHTML =
      DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('');

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const isToday    = date.toDateString() === today.toDateString();
      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
      const filtroEscala = document.getElementById('filtroEscalaCalendario')?.value || '';
    const colsFiltrados = filtroEscala ? colaboradores.filter(c => c.tipo === filtroEscala) : colaboradores;
    const statuses   = colsFiltrados.map(col => ({ col, working: isWorkDay(date, col) }));
      const hasOn      = statuses.some(s => s.working);

      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (isSelected) cell.classList.add('sel');
      else if (hasOn) cell.classList.add('on');
      if (isToday && !isSelected) cell.classList.add('today');

      let dotsHtml = '';
      if (colaboradores.length > 0) {
        const dots = statuses.map(s => {
          if (s.working === null) return '';
          const cls = s.working ? (isSelected ? 'on-sel' : 'on') : 'off';
          return `<div class="cal-dot ${cls}"></div>`;
        }).join('');
        dotsHtml = `<div class="cal-dots">${dots}</div>`;
      }

      cell.innerHTML = `${d}${dotsHtml}`;
      cell.addEventListener('click', () => { selectedDate = date; renderCalendar(); renderDetail(); });
      grid.appendChild(cell);
    }
  }

  function renderDetail() {
    const card = document.getElementById('detailCard');
    if (!selectedDate) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');

    const dd = String(selectedDate.getDate()).padStart(2,'0');
    const mm = String(selectedDate.getMonth()+1).padStart(2,'0');
    const yy = selectedDate.getFullYear();
    document.getElementById('detailDate').textContent = `${dd}/${mm}/${yy}`;
    document.getElementById('detailDow').textContent  = DIASNOME[selectedDate.getDay()];

    const list = document.getElementById('statusList');
    if (colaboradores.length === 0) {
      list.innerHTML = '<div class="empty">Adicione colaboradores para ver o status</div>';
      return;
    }

    const statuses = colaboradores.map((col, idx) => ({
      col, idx, working: isWorkDay(selectedDate, col)
    }));

    const items = statuses.map(({ col, idx, working }) => {
      const cor = CORES[idx % CORES.length];
      return `
        <div class="status-item ${working ? 'on' : 'off'}">
          <div class="status-info">
            <div class="colab-dot" style="background:${cor};width:8px;height:8px;"></div>
            <div>
              <div class="status-name">${col.nome}</div>
              <div class="status-tipo">${col.tipo}</div>
            </div>
          </div>
          <div class="badge ${working ? 'on' : ''}">${working ? '✓ DE PLANTÃO' : '✗ DE FOLGA'}</div>
        </div>`;
    }).join('');

    const onList = statuses.filter(s => s.working);
    let alertHtml = '';
    if (onList.length > 0) {
      const nomes = onList.map(s => s.col.nome).join(', ');
      const msg   = onList.length === 1
        ? `${nomes} pode iniciar férias nesta data.`
        : `${nomes} podem iniciar férias nesta data.`;
      alertHtml = `<div class="alert-ferias">✅ ${msg}</div>`;
    }

    list.innerHTML = items + alertHtml;
  }

  // ── Marcos no Relatório ───────────────────────────────────────
  function getNthWorkday(col, n) {
    const ref = new Date(col.dataReferencia + 'T00:00:00');
    const cycle = col.tipo === '12x36' ? 2 : 4;
    const result = new Date(ref);
    result.setDate(result.getDate() + (n - 1) * cycle);
    return result;
  }

  function renderMarcosRelatorio() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const filtroMes = parseInt(document.getElementById('filtroMes').value);
    const filtroAno = parseInt(document.getElementById('filtroAno').value);
    const ultimoDia = new Date(filtroAno, filtroMes + 1, 0).getDate();

    function buildRows(tipo) {
      const marco = tipo === '12x36' ? 16 : 8;
      const cols = colaboradores.filter(c => c.tipo === tipo);
      if (cols.length === 0) return '<div style="color:var(--text-faint);font-size:12px;padding:6px 0;">Nenhum colaborador nesta escala.</div>';

      // Para cada colaborador, conta os plantões no mês e verifica se o n-ésimo cai nesse mês
      const rows = [];
      cols.forEach(col => {
        let contador = 0;
        let dataMarco = null;
        for (let dia = 1; dia <= ultimoDia; dia++) {
          const data = new Date(filtroAno, filtroMes, dia);
          if (isWorkDay(data, col)) {
            contador++;
            if (contador === marco) { dataMarco = data; break; }
          }
        }
        if (dataMarco) rows.push({ col, data: dataMarco });
      });

      if (rows.length === 0) return '<div style="color:var(--text-faint);font-size:12px;padding:6px 0;">Nenhum colaborador atinge esse marco neste mês.</div>';

      rows.sort((a, b) => a.data - b.data);
      return rows.map(({ col, data }) => {
        const ehHoje = data.toDateString() === hoje.toDateString();
        const passado = data < hoje;
        const dd = String(data.getDate()).padStart(2,'0');
        const mm = String(data.getMonth()+1).padStart(2,'0');
        const yyyy = data.getFullYear();
        const weekday = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][data.getDay()];
        const diff = Math.round((data - hoje) / 86400000);
        const diffTxt = ehHoje ? '🎯 Hoje!' : passado ? `há ${Math.abs(diff)}d` : `em ${diff}d`;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;background:${ehHoje?'var(--gold-dim)':'var(--bg)'};border:1px solid ${ehHoje?'var(--gold)':passado?'var(--border)':'var(--green-bd)'};${passado?'opacity:0.55':''}">
            <span style="font-size:13px;color:var(--text);font-weight:500;">${col.nome}</span>
            <span style="text-align:right;">
              <span style="font-size:13px;font-weight:700;color:${ehHoje?'var(--gold)':passado?'var(--text-dim)':'var(--green)'};">${dd}/${mm}/${yyyy}</span>
              <span style="font-size:10px;color:var(--text-dim);margin-left:6px;">${weekday} · ${diffTxt}</span>
            </span>
          </div>`;
      }).join('');
    }

    const c12 = document.getElementById('marcos12Content');
    const c24 = document.getElementById('marcos24Content');
    if (c12) c12.innerHTML = buildRows('12x36');
    if (c24) c24.innerHTML = buildRows('24x72');
  }

  // ── Relatório ─────────────────────────────────────────────────
  function popularFiltros() {
    const selFunc = document.getElementById('filtroFuncionario');
    const selMes  = document.getElementById('filtroMes');
    const selAno  = document.getElementById('filtroAno');

    const valorAtual = selFunc.value;
    selFunc.innerHTML = '<option value="todos">Todos os colaboradores</option>' +
      colaboradores.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    if (valorAtual && [...selFunc.options].some(o => o.value === valorAtual)) selFunc.value = valorAtual;

    if (selMes.options.length === 0) {
      MONTHS.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = m;
        selMes.appendChild(opt);
      });
      selMes.value = today.getMonth();
    }

    if (selAno.options.length === 0) {
      const anoBase = today.getFullYear();
      for (let a = anoBase - 1; a <= anoBase + 2; a++) {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        selAno.appendChild(opt);
      }
      selAno.value = anoBase;
    }
  }

  function atualizarRelatorio() {
    const rc        = document.getElementById('reportContent');
    const filtroId  = document.getElementById('filtroFuncionario').value;
    const filtroMes = parseInt(document.getElementById('filtroMes').value);
    const filtroAno = parseInt(document.getElementById('filtroAno').value);

    const cols = filtroId === 'todos'
      ? colaboradores
      : colaboradores.filter(c => String(c.id) === filtroId);

    if (cols.length === 0) { rc.innerHTML = '<div class="empty">Nenhum colaborador encontrado.</div>'; return; }

    const ultimoDia = new Date(filtroAno, filtroMes + 1, 0).getDate();
    let html = '';

    cols.forEach(col => {
      const idx = colaboradores.indexOf(col);
      const cor = CORES[idx % CORES.length];
      let dias = [];
      for (let dia = 1; dia <= ultimoDia; dia++) {
        const data = new Date(filtroAno, filtroMes, dia);
        if (isWorkDay(data, col)) {
          dias.push({
            data: String(dia).padStart(2,'0') + '/' + String(filtroMes+1).padStart(2,'0') + '/' + filtroAno,
            dow: DIASNOME[data.getDay()].substring(0, 3)
          });
        }
      }
      html += `
        <div style="border:1px solid ${cor}44;border-radius:14px;padding:18px;margin-bottom:16px;background:var(--bg);">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${cor};"></div>
              <div style="font-size:17px;font-weight:700;color:var(--gold);">${col.nome}</div>
            </div>
            <div style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;background:var(--green-bg);border:1px solid var(--green-bd);color:var(--green);">
              ${dias.length} plantão${dias.length !== 1 ? 'ões' : ''} em ${MONTHS[filtroMes]}
            </div>
          </div>
          <div style="color:var(--text-dim);font-size:12px;margin-bottom:14px;">Escala ${col.tipo} · ${MONTHS[filtroMes]} ${filtroAno}</div>
          ${dias.length === 0
            ? '<div style="color:var(--text-faint);font-size:13px;text-align:center;padding:10px 0;">Nenhum plantão neste mês</div>'
            : `<div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${dias.map(item => `
                  <div style="padding:8px 12px;border-radius:10px;background:var(--green-bg);border:1px solid var(--green-bd);font-size:12px;color:var(--green);font-weight:600;display:flex;flex-direction:column;align-items:center;gap:2px;">
                    <span>${item.data}</span>
                    <span style="font-size:10px;font-weight:400;opacity:.7;">${item.dow}</span>
                  </div>`).join('')}
              </div>`}
        </div>`;
    });

    rc.innerHTML = html;
    renderMarcosRelatorio();
  }

  // ── Init ──────────────────────────────────────────────────────
  (async function init() {
    renderCalendar();
    const cfgUrl = document.getElementById('cfgUrl');
    const cfgKey = document.getElementById('cfgKey');
    if (cfgUrl) cfgUrl.value = SUPABASE_URL_FIXED;
    if (cfgKey) cfgKey.value = SUPABASE_KEY_FIXED;
    await conectarSupabase(true);
  })();
  // ── Autenticação ───────────────────────────────────────────────
  let loginTab = 'entrar';

  function switchLoginTab(tab) {
    loginTab = tab;
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginSuccess').style.display = 'none';

    const isEsqueci = tab === 'esqueci';
    document.getElementById('loginTabsRow').style.display = isEsqueci ? 'none' : '';
    document.getElementById('loginMainPanel').style.display = isEsqueci ? 'none' : '';
    document.getElementById('loginEsqueciPanel').style.display = isEsqueci ? '' : 'none';

    if (!isEsqueci) {
      document.getElementById('tabEntrar').classList.toggle('active', tab === 'entrar');
      document.getElementById('tabCriar').classList.toggle('active', tab === 'criar');
      document.getElementById('loginConfirmGroup').style.display = tab === 'criar' ? '' : 'none';
      document.getElementById('loginBtn').textContent = tab === 'entrar' ? 'Entrar' : 'Criar conta';
    }
  }

  function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg; 
    el.style.display = 'block'; // ← MUDOU AQUI: Agora força a aparecer
    document.getElementById('loginSuccess').style.display = 'none';
  }
  function showLoginSuccess(msg) {
    const el = document.getElementById('loginSuccess');
    el.textContent = msg; 
    el.style.display = 'block'; // ← MUDOU AQUI: Agora força a aparecer
    document.getElementById('loginError').style.display = 'none';
  }

  function _traduzirErroAuth(msg, email, btn) {
    const m = (msg || '').toLowerCase();
    let texto;
    if (m.includes('invalid login credentials') || m.includes('invalid credentials') || m.includes('wrong password') || m.includes('invalid email or password')) {
      texto = '❌ E-mail ou senha incorretos. Verifique e tente novamente.';
    } else if (m.includes('email not confirmed')) {
      texto = '⚠️ E-mail ainda não confirmado. Verifique sua caixa de entrada (e o spam).';
    } else if (m.includes('already registered') || m.includes('user already')) {
      switchLoginTab('entrar');
      setTimeout(() => {
        document.getElementById('loginEmail').value = email;
        showLoginError('⚠️ Este e-mail já tem uma conta. Digite sua senha para entrar.');
      }, 100);
      btn.disabled = false; btn.textContent = 'Criar conta';
      return;
    } else if (m.includes('at least 6') || m.includes('should be at least') || m.includes('at least 8')) {
      texto = '❌ A senha deve ter pelo menos 8 caracteres e 1 caractere especial.';
    } else if (m.includes('invalid format') || m.includes('valid email')) {
      texto = '❌ Digite um e-mail válido.';
    } else if (m.includes('too many requests') || m.includes('rate limit')) {
      texto = '⚠️ Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    } else {
      texto = '❌ Erro: ' + msg;
    }
    showLoginError(texto);
    btn.disabled = false;
    btn.textContent = loginTab === 'entrar' ? 'Entrar' : 'Criar conta';
  }

  async function doLogin() {
    const email    = document.getElementById('loginEmail').value.trim();
    const senha    = document.getElementById('loginSenha').value;
    const confirma = document.getElementById('loginConfirm').value;
    const btn      = document.getElementById('loginBtn');

    if (!email || !senha) { showLoginError('⚠️ Preencha e-mail e senha.'); return; }
    if (loginTab === 'criar' && senha !== confirma) { showLoginError('❌ As senhas não coincidem.'); return; }
    if (loginTab === 'criar' && senha.length < 8)   { showLoginError('❌ A senha deve ter pelo menos 8 caracteres.'); return; }
    if (loginTab === 'criar' && !/[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?]/.test(senha)) {
      showLoginError('❌ A senha deve conter pelo menos 1 caractere especial (ex: @, #, !, %).'); return;
    }

    btn.disabled = true;
    btn.textContent = loginTab === 'entrar' ? 'Entrando…' : 'Criando…';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginSuccess').style.display = 'none';

    try {
      const client = supabase.createClient(SUPABASE_URL_FIXED, SUPABASE_KEY_FIXED, { auth: { persistSession: true } });

      // Se for criar conta, valida primeiro se e-mail está autorizado
      if (loginTab === 'criar') {
        const { data: autorizado, error: errAuth } = await client
          .from('usuarios_autorizados')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (errAuth || !autorizado) {
          showLoginError('❌ Este e-mail não está autorizado. Solicite acesso ao administrador.');
          btn.disabled = false; btn.textContent = 'Criar conta';
          return;
        }
      }

      let result;
      if (loginTab === 'entrar') {
        result = await client.auth.signInWithPassword({ email, password: senha });
      } else {
        result = await client.auth.signUp({ email, password: senha });
      }

      // Supabase às vezes retorna erro no objeto sem lançar exceção
      if (result.error) {
        _traduzirErroAuth(result.error.message || result.error.error_description || JSON.stringify(result.error), email, btn);
        return;
      }

      if (loginTab === 'criar') {
        // E-mail duplicado: Supabase retorna identities vazio em vez de erro
        const identities = result.data?.user?.identities;
        if (Array.isArray(identities) && identities.length === 0) {
          switchLoginTab('entrar');
          setTimeout(() => {
            document.getElementById('loginEmail').value = email;
            showLoginError('⚠️ Este e-mail já tem uma conta. Digite sua senha para entrar.');
          }, 100);
          btn.disabled = false; btn.textContent = 'Criar conta';
          return;
        }
        if (result.data?.user && !result.data.session) {
          showLoginSuccess('✅ Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
        } else {
          showLoginSuccess('✅ Conta criada com sucesso! Você já pode entrar.');
          switchLoginTab('entrar');
        }
        btn.disabled = false; btn.textContent = 'Criar conta';
        return;
      }

     // [NOVO] Verifica se e-mail está na tabela do Supabase em tempo real
      const emailUsuario = (result.data?.user?.email || email).toLowerCase();
      
      const { data: usuarioFiltro, error: erroBanco } = await client
        .from('usuarios_autorizados')
        .select('email')
        .eq('email', emailUsuario)
        .maybeSingle();

      if (erroBanco || !usuarioFiltro) {
        await client.auth.signOut();
        showLoginError('❌ Acesso não autorizado. Entre em contato com o administrador.');
        btn.disabled = false; 
        btn.textContent = 'Entrar';
        return;
      }

      // ✅ Sucesso — abre o app
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appShell').style.display = '';
      await conectarSupabase(true);

    } catch (err) {
      _traduzirErroAuth(err.message || err.error_description || JSON.stringify(err), email, btn);
    }
  }

  async function doReset() {
    const email = document.getElementById('loginEmailReset').value.trim();
    if (!email) { showLoginError('Digite seu e-mail.'); return; }

    const btn = document.querySelector('#loginEsqueciPanel .login-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    document.getElementById('loginError').style.display = 'none';

    try {
      const client = supabase.createClient(SUPABASE_URL_FIXED, SUPABASE_KEY_FIXED, { auth: { persistSession: false } });
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href,
      });
      if (error) throw error;
      showLoginSuccess('✅ Link enviado! Verifique seu e-mail (e o spam) para redefinir a senha.');
    } catch (err) {
      showLoginError('Erro ao enviar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar link de redefinição';
    }
  }

  // Verifica se já há sessão ativa ao carregar
  (async function checkSession() {
    try {
      const client = supabase.createClient(SUPABASE_URL_FIXED, SUPABASE_KEY_FIXED, { auth: { persistSession: true } });
      const { data } = await client.auth.getSession();
      if (data?.session) {
        const emailSessao = (data.session.user?.email || '').toLowerCase();
        
        // [NOVO] Valida a sessão ativa contra a tabela do banco
        const { data: usuarioFiltro } = await client
          .from('usuarios_autorizados')
          .select('email')
          .eq('email', emailSessao)
          .maybeSingle();

        if (usuarioFiltro) {
          document.getElementById('loginScreen').style.display = 'none';
          document.getElementById('appShell').style.display = '';
          await conectarSupabase(true); // Conecta aos dados da escala
        } else {
          await client.auth.signOut();
        }
      }
    } catch(e) {}
  })();

  // ── Gestão de Utilizadores ────────────────────────────────────
  async function carregarUtilizadores() {
    const container = document.getElementById('usersListContent');
    if (!supabaseClient) {
      container.innerHTML = '<div style="color:var(--text-faint);font-size:13px;padding:20px;text-align:center;">⚠️ Conecte ao banco de dados primeiro.</div>';
      return;
    }
    container.innerHTML = '<div style="color:var(--text-faint);font-size:13px;padding:20px;text-align:center;">Carregando…</div>';

    const { data, error } = await supabaseClient
      .from('usuarios_autorizados')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      container.innerHTML = `<div style="color:var(--red);font-size:13px;padding:20px;text-align:center;">❌ Erro ao carregar: ${error.message}</div>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="color:var(--text-faint);font-size:13px;padding:20px;text-align:center;">Nenhum utilizador cadastrado ainda.</div>';
      return;
    }

    const rows = data.map(u => {
      const perfil = u.perfil || 'viewer';
      const dataStr = u.created_at
        ? new Date(u.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
        : '—';
      return `
        <tr>
          <td>${u.email}</td>
          <td><span class="badge-perfil ${perfil}">${perfil === 'admin' ? 'Administrador' : 'Visualizador'}</span></td>
          <td style="color:var(--text-dim);">${dataStr}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="removerUtilizador('${u.id}', '${u.email}')">Remover</button>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Adicionado em</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:10px;font-size:12px;color:var(--text-faint);">Total: ${data.length} utilizador(es)</div>
    `;
  }

  async function adicionarUtilizador() {
    const email  = document.getElementById('inputNovoEmail').value.trim().toLowerCase();
    const perfil = document.getElementById('inputNovoPerfil').value;
    const errEl  = document.getElementById('usersError');
    const btn    = document.getElementById('btnAdicionarUser');

    errEl.style.display = 'none';
    if (!email) { errEl.textContent = 'Informe o e-mail.'; errEl.style.display = 'block'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Digite um e-mail válido.'; errEl.style.display = 'block'; return;
    }
    if (!supabaseClient) {
      errEl.textContent = 'Conecte ao banco de dados primeiro.'; errEl.style.display = 'block'; return;
    }

    btn.disabled = true; btn.textContent = 'Adicionando…';

    // Verifica duplicado
    const { data: existe } = await supabaseClient
      .from('usuarios_autorizados').select('id').eq('email', email).maybeSingle();
    if (existe) {
      errEl.textContent = '⚠️ Este e-mail já está na lista de utilizadores.';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = '+ Adicionar';
      return;
    }

    const { error } = await supabaseClient
      .from('usuarios_autorizados')
      .insert([{ email, perfil }]);

    if (error) {
      errEl.textContent = '❌ Erro ao adicionar: ' + error.message;
      errEl.style.display = 'block';
    } else {
      document.getElementById('inputNovoEmail').value = '';
      toast(`✅ ${email} adicionado com sucesso!`, 'success');
      await carregarUtilizadores();
    }
    btn.disabled = false; btn.textContent = '+ Adicionar';
  }

  async function removerUtilizador(id, email) {
    const ok = await showConfirm('Remover utilizador?', `O acesso de "${email}" será revogado. Esta ação não pode ser desfeita.`);
    if (!ok) return;

    const { error } = await supabaseClient
      .from('usuarios_autorizados')
      .delete()
      .eq('id', id);

    if (error) {
      toast('❌ Erro ao remover: ' + error.message, 'error');
    } else {
      toast(`✅ ${email} removido com sucesso!`, 'success');
      await carregarUtilizadores();
    }
  }

  // ── Logout ────────────────────────────────────────────────────
  async function logout() {
    try {
      const client = supabase.createClient(SUPABASE_URL_FIXED, SUPABASE_KEY_FIXED, { auth: { persistSession: true } });
      await client.auth.signOut();
    } catch(e) {}
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginScreen').style.display = '';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginSenha').value = '';
    document.getElementById('loginConfirm').value = '';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginSuccess').style.display = 'none';
    switchLoginTab('entrar');
    supabaseClient = null;
    colaboradores = [];
    setDbStatus('', 'Não conectado');
    toast('Sessão encerrada.', 'info');
  }

  // ── Service Worker (PWA) ───────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
