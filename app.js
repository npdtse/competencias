/**
 * SGC - Secretaria de Auditoria
 * SPA Logic (Refactored)
 */

// --- CONSTANTES DE CATEGORIZAÇÃO ---
const CATEGORIAS_COMPETENCIAS = {
    "Técnicas de auditoria interna (hard skills)": [
        "Framework Internacional de Práticas Profissionais",
        "Ética e Profissionalismo",
        "Programa de Avaliação e Melhoria da Qualidade",
        "Metodologias de Auditoria",
        "Avaliação Integrada e Coordenada",
        "Reporte de Resultados"
    ],
    "Competências profissionais (soft skills)": [
        "Liderança",
        "Comunicações Profissionais",
        "Negociação e Gestão de Conflitos",
        "Gestão de Projetos",
        "Análise de Dados",
        "Ferramentas Tecnológicas"
    ],
    "Processos de negócio das áreas auditadas": [
        "Tecnologia da Informação",
        "Contratos e Convênios",
        "Suprimentos e Aquisições",
        "Gestão de Pessoas",
        "Desempenho"
    ],
    "Governança e Gerenciamento de Riscos": [
        "Governança",
        "Estratégia",
        "Gerenciamento de Riscos Organizacionais",
        "Conformidade",
        "Fraude",
        "Resiliência Organizacional",
        "Sustentabilidade"
    ]
};

// --- ESTADO & CONFIG ---
const defaultData = {
    competencias: [],
    cargos: [],
    pessoas: []
};

let appData = JSON.parse(JSON.stringify(defaultData));
let currentChart = null; // Instância do Chart.js
let compSortField = 'nome';
let compSortDirection = 'asc';

const NIVEIS = { 0: "-", 1: "Básico", 2: "Intermediário", 3: "Avançado", 4: "Especializado" };

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Carrega dados
    const saved = localStorage.getItem('sgc_data');
    if (saved) {
        try { appData = JSON.parse(saved); } catch (e) { console.error("Erro dados", e); }
    } else {
        // Se não houver dados salvos, inicia com o padrão (vazio)
        // Isso efetivamente reseta se o usuário limpar o cache ou for a primeira vez
        appData = JSON.parse(JSON.stringify(defaultData));
    }

    // Roteamento Inicial
    if(!window.location.hash) window.location.hash = "#competencias";
    handleHashChange();

    // Event Listener Rota
    window.addEventListener('hashchange', handleHashChange);
    
    // UI Updates
    updateAllViews();
});

// --- ROTEAMENTO & NAVEGAÇÃO ---
function handleHashChange() {
    const hash = window.location.hash.replace('#', '') || 'competencias';
    
    const parts = hash.split('/');
    const mainRoute = parts[0];
    const param = parts[1] ? parseInt(parts[1]) : null;

    // Menu Active
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const menuLink = document.querySelector(`.menu-item[onclick*="'${mainRoute}'"]`);
    if(menuLink) menuLink.classList.add('active');

    // Telas
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active-screen'));
    
    // Roteador simples
    if (mainRoute === 'avaliacao' && param) {
        document.getElementById('screen-avaliacao').classList.add('active-screen');
        app.loadAvaliacaoScreen(param);
    } else if (mainRoute === 'pdi' && param) {
        document.getElementById('screen-pdi').classList.add('active-screen');
        app.loadPDIScreen(param);
    } else {
        const target = document.getElementById(`screen-${mainRoute}`);
        if(target) target.classList.add('active-screen');
    }

    // Fecha menu no mobile
    document.body.classList.remove('sidebar-open');
}

// --- APP LOGIC ---
const app = {
    
    // UTILS
    navigate: (route) => { window.location.hash = route; },
    
    toggleSidebar: () => { document.body.classList.toggle('sidebar-open'); },
    
    showToast: (msg, type = 'success') => {
        const container = document.getElementById('toast-area');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${msg}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;">&times;</button>
        `;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    },

    openModal: (id) => { 
        document.getElementById(id).classList.add('open'); 
        const form = document.getElementById(id).querySelector('form');
        
        // Se não estiver editando, reseta o formulário
        if(form && !form.getAttribute('data-editing')) {
            form.reset();
            // Reset específico para subcategoria
            if (id === 'modal-competencia') {
                app.updateSubcategoriaOptions(); 
            }
        }
        
        if(form) form.removeAttribute('data-editing');
        
        if(id === 'modal-cargo') renderCargoMapForm();
        if(id === 'modal-pessoa') renderPessoasSelect();
    },
    
    closeModal: (id) => { 
        document.getElementById(id).classList.remove('open'); 
        const hiddenId = document.getElementById(id).querySelector('input[type="hidden"]');
        if(hiddenId) hiddenId.value = '';
    },

    saveLocal: () => {
        localStorage.setItem('sgc_data', JSON.stringify(appData));
        updateAllViews();
    },

    resetApp: () => {
        if(confirm("Deseja apagar todos os dados e começar do zero?")) {
            appData = JSON.parse(JSON.stringify(defaultData));
            app.saveLocal();
            app.showToast("Sistema resetado.", "success");
            app.navigate('competencias');
        }
    },

    // --- ARQUIVO ---
    saveFile: () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `SGC_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    },
    
    loadFile: (input) => {
        const file = input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if(json.competencias && json.cargos) {
                    appData = json;
                    app.saveLocal();
                    app.showToast("Backup restaurado!", "success");
                    location.reload();
                } else {
                    app.showToast("Arquivo inválido.", "error");
                }
            } catch (ex) { app.showToast("Erro ao ler JSON.", "error"); }
        };
        reader.readAsText(file);
    },

    // --- CRUD: COMPETÊNCIAS ---
    
    // Função auxiliar para atualizar o select de subcategorias
    updateSubcategoriaOptions: () => {
        const catSelect = document.getElementById('comp-categoria');
        const subSelect = document.getElementById('comp-subcategoria');
        const selectedCat = catSelect.value;
        
        // Limpa opções atuais
        subSelect.innerHTML = '<option value="">-- Selecione --</option>';
        
        if (selectedCat && CATEGORIAS_COMPETENCIAS[selectedCat]) {
            // Popula com as subcategorias correspondentes
            CATEGORIAS_COMPETENCIAS[selectedCat].forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.innerText = sub;
                subSelect.appendChild(opt);
            });
            subSelect.disabled = false;
        } else {
            // Desabilita se não houver categoria
            subSelect.innerHTML = '<option value="">-- Selecione uma categoria primeiro --</option>';
            subSelect.disabled = true;
        }
    },

    // Ordenação de Competências
    sortCompetencias: (field) => {
        if (compSortField === field) {
            compSortDirection = compSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            compSortField = field;
            compSortDirection = 'asc';
        }
        renderCompetenciasList();
    },

    saveCompetencia: (e) => {
        e.preventDefault();
        const id = document.getElementById('comp-id').value;
        const nome = document.getElementById('comp-nome').value;
        const cat = document.getElementById('comp-categoria').value;
        const sub = document.getElementById('comp-subcategoria').value;
        const desc = document.getElementById('comp-desc').value;

        if (id) {
            const comp = appData.competencias.find(c => c.id == id);
            if(comp) { 
                comp.nome = nome; 
                comp.categoria = cat; 
                comp.subcategoria = sub;
                comp.descricao = desc; 
            }
            app.showToast("Competência atualizada!");
        } else {
            appData.competencias.push({ 
                id: Date.now(), 
                nome, 
                categoria: cat, 
                subcategoria: sub,
                descricao: desc 
            });
            app.showToast("Competência criada!");
        }
        app.saveLocal();
        app.closeModal('modal-competencia');
    },

    editCompetencia: (id) => {
        const comp = appData.competencias.find(c => c.id === id);
        if(!comp) return;
        
        document.getElementById('comp-id').value = comp.id;
        document.getElementById('comp-nome').value = comp.nome;
        
        // Define categoria
        document.getElementById('comp-categoria').value = comp.categoria;
        
        // Atualiza a lista de subcategorias baseada na categoria carregada
        app.updateSubcategoriaOptions();
        
        // Define subcategoria (agora que o select está populado)
        document.getElementById('comp-subcategoria').value = comp.subcategoria;
        
        document.getElementById('comp-desc').value = comp.descricao || '';
        document.getElementById('form-competencia').setAttribute('data-editing', 'true');
        app.openModal('modal-competencia');
    },

    deleteCompetencia: (id) => {
        if(confirm("Excluir competência?")) {
            appData.competencias = appData.competencias.filter(c => c.id !== id);
            // Remove do mapa de cargos também para evitar erros
            appData.cargos.forEach(cargo => {
                if(cargo.mapaCompetencias[id]) {
                    delete cargo.mapaCompetencias[id];
                }
            });
            app.saveLocal();
            app.showToast("Competência removida.");
        }
    },

    // --- CRUD: CARGOS ---
    saveCargo: (e) => {
        e.preventDefault();
        const id = document.getElementById('cargo-id').value;
        const nome = document.getElementById('cargo-nome').value;
        const nivelCargo = document.getElementById('cargo-nivel').value;
        
        const mapa = {};
        document.querySelectorAll('.map-select').forEach(sel => {
            const nivel = parseInt(sel.value);
            if(nivel > 0) mapa[sel.dataset.compId] = nivel;
        });

        if(id) {
            const cargo = appData.cargos.find(c => c.id == id);
            if(cargo) { 
                cargo.nome = nome; 
                cargo.nivel = nivelCargo;
                cargo.mapaCompetencias = mapa; 
            }
            app.showToast("Cargo atualizado!");
        } else {
            appData.cargos.push({ id: Date.now(), nome, nivel: nivelCargo, mapaCompetencias: mapa });
            app.showToast("Cargo criado!");
        }
        app.saveLocal();
        app.closeModal('modal-cargo');
    },

    editCargo: (id) => {
        const cargo = appData.cargos.find(c => c.id === id);
        if(!cargo) return;
        
        renderCargoMapForm(); // Reseta selects
        document.getElementById('cargo-id').value = cargo.id;
        document.getElementById('cargo-nome').value = cargo.nome;
        document.getElementById('cargo-nivel').value = cargo.nivel || 'Júnior';
        
        setTimeout(() => {
            for(const [compId, nivel] of Object.entries(cargo.mapaCompetencias)) {
                const sel = document.querySelector(`.map-select[data-comp-id="${compId}"]`);
                if(sel) sel.value = nivel;
            }
        }, 50);

        document.getElementById('form-cargo').setAttribute('data-editing', 'true');
        app.openModal('modal-cargo');
    },

    deleteCargo: (id) => {
        if(confirm("Excluir cargo?")) {
            appData.cargos = appData.cargos.filter(c => c.id !== id);
            app.saveLocal();
            app.showToast("Cargo removido.");
        }
    },

    // --- CRUD: PESSOAS ---
    savePessoa: (e) => {
        e.preventDefault();
        const id = document.getElementById('pessoa-id').value;
        const nome = document.getElementById('pessoa-nome').value;
        const email = document.getElementById('pessoa-email').value;
        const cargoId = parseInt(document.getElementById('pessoa-cargo').value);

        if(id) {
            const p = appData.pessoas.find(x => x.id == id);
            if(p) { p.nome = nome; p.email = email; p.cargoId = cargoId; }
            app.showToast("Servidor atualizado!");
        } else {
            appData.pessoas.push({
                id: Date.now(), nome, email, cargoId,
                avaliacoes: [], pdi: []
            });
            app.showToast("Servidor cadastrado!");
        }
        app.saveLocal();
        app.closeModal('modal-pessoa');
    },

    editPessoa: (id) => {
        const p = appData.pessoas.find(x => x.id === id);
        if(!p) return;
        renderPessoasSelect();
        document.getElementById('pessoa-id').value = p.id;
        document.getElementById('pessoa-nome').value = p.nome;
        document.getElementById('pessoa-email').value = p.email;
        document.getElementById('pessoa-cargo').value = p.cargoId;
        document.getElementById('form-pessoa').setAttribute('data-editing', 'true');
        app.openModal('modal-pessoa');
    },

    deletePessoa: (id) => {
        if(confirm("Excluir servidor e todo histórico?")) {
            appData.pessoas = appData.pessoas.filter(p => p.id !== id);
            app.saveLocal();
            app.showToast("Servidor removido.");
        }
    },

    // --- AVALIAÇÃO DINÂMICA (Cargo + Extras) ---
    loadAvaliacaoScreen: (pessoaId) => {
        const pessoa = appData.pessoas.find(p => p.id === pessoaId);
        if(!pessoa) return app.navigate('pessoas');
        
        const cargo = appData.cargos.find(c => c.id === pessoa.cargoId);
        if(!cargo) { app.showToast("Pessoa sem cargo!", "error"); return; }

        document.getElementById('aval-nome').innerText = pessoa.nome;
        document.getElementById('aval-cargo').innerText = `${cargo.nome} (${cargo.nivel || ''})`;
        document.getElementById('aval-pessoa-id').value = pessoa.id;

        const tableCargo = document.getElementById('aval-tabela-cargo');
        const tableExtras = document.getElementById('aval-tabela-extras');
        const selectNewExtra = document.getElementById('select-new-extra');
        
        tableCargo.innerHTML = '';
        tableExtras.innerHTML = '';
        selectNewExtra.innerHTML = '<option value="">+ Selecionar competência...</option>';

        // Pega última avaliação para preencher notas existentes
        const lastAval = pessoa.avaliacoes.length > 0 ? pessoa.avaliacoes[pessoa.avaliacoes.length-1] : null;
        const currentNotas = lastAval ? lastAval.notas : {};

        // 1. CARREGA COMPETÊNCIAS DO CARGO (Obrigatórias)
        const cargoCompIds = Object.keys(cargo.mapaCompetencias).map(k => parseInt(k));
        const labels = [];
        const dataMeta = [];
        const dataAtual = [];

        cargoCompIds.forEach(compId => {
            const comp = appData.competencias.find(c => c.id == compId);
            if(!comp) return;

            const meta = cargo.mapaCompetencias[compId];
            const real = currentNotas[compId] || 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${comp.nome}</td>
                <td><span class="badge">${NIVEIS[meta]}</span></td>
                <td>${createLevelSelect(comp.id, real)}</td>
            `;
            tableCargo.appendChild(tr);

            // Chart Data
            labels.push(comp.nome);
            dataMeta.push(meta);
            dataAtual.push(real);
        });

        // 2. CARREGA COMPETÊNCIAS EXTRAS (Histórico + Disponíveis)
        // Varre todas as notas que a pessoa tem que NÃO estão no cargo
        Object.keys(currentNotas).forEach(compId => {
            if (!cargoCompIds.includes(parseInt(compId))) {
                const comp = appData.competencias.find(c => c.id == compId);
                if (comp) {
                    addExtraRow(comp, currentNotas[compId]);
                }
            }
        });

        // Preenche Select de Novas Extras (Exclui as que já estão no cargo ou na lista extra)
        appData.competencias.forEach(c => {
            // Se não está no cargo E não foi renderizada como extra ainda
            const isCargo = cargoCompIds.includes(c.id);
            const isExtraEvaluated = currentNotas[c.id] !== undefined;
            
            // Só mostra no select se não estiver no cargo
            // (Se já tiver nota extra, já apareceu na tabela. Se não tiver nota, aparece no select)
            if (!isCargo && !isExtraEvaluated) {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.text = c.nome;
                selectNewExtra.appendChild(opt);
            }
        });

        renderRadarChart(labels, dataMeta, dataAtual);
    },

    addExtraCompetencia: () => {
        const select = document.getElementById('select-new-extra');
        const compId = parseInt(select.value);
        if(!compId) return;

        const comp = appData.competencias.find(c => c.id === compId);
        if(comp) {
            addExtraRow(comp, 0); // Adiciona linha com nível 0
            // Remove do select para não duplicar
            select.querySelector(`option[value="${compId}"]`).remove();
        }
    },

    saveAvaliacao: (e) => {
        e.preventDefault();
        const pid = parseInt(document.getElementById('aval-pessoa-id').value);
        const notas = {};
        
        // Coleta inputs do Cargo E Extras (todos tem classe .aval-input)
        document.querySelectorAll('.aval-input').forEach(sel => {
            const val = parseInt(sel.value);
            // Salva se for maior que 0 ou se for do cargo (mesmo sendo 0 para registrar)
            // Para extras, se for 0, podemos optar por não salvar, mas salvar 0 mantém no histórico como "avaliado mas sem skill"
            if (val >= 0) {
                notas[sel.dataset.compId] = val;
            }
        });

        const pessoa = appData.pessoas.find(p => p.id === pid);
        pessoa.avaliacoes.push({ data: new Date().toISOString(), notas });
        
        app.saveLocal();
        app.showToast("Avaliação salva!", "success");
        app.loadAvaliacaoScreen(pid); // Recarrega para atualizar gráfico e listas
    },

   // --- PDI ---
    loadPDIScreen: (pid) => {
        const pessoa = appData.pessoas.find(p => p.id === pid);
        if(!pessoa) return;

        document.getElementById('pdi-pessoa-id').value = pid;
        const container = document.getElementById('pdi-gaps-container');
        container.innerHTML = '';
        const selectComp = document.getElementById('pdi-competencia');
        selectComp.innerHTML = '<option value="">-- Selecione --</option>';

        const cargo = appData.cargos.find(c => c.id === pessoa.cargoId);
        if(cargo && pessoa.avaliacoes.length > 0) {
            const lastAval = pessoa.avaliacoes[pessoa.avaliacoes.length-1];
            
            // Verifica gaps apenas nas competências do CARGO
            for(const [compId, meta] of Object.entries(cargo.mapaCompetencias)) {
                const real = lastAval.notas[compId] || 0;
                const comp = appData.competencias.find(c => c.id == compId);
                
                // Popula o select de Ações de PDI com todas as competências do cargo
                if(comp) {
                    const opt = document.createElement('option');
                    opt.value = comp.id;
                    opt.text = comp.nome;
                    selectComp.appendChild(opt);
                }

                // Se houver um gap, cria o card visual
                if(real < meta && comp) {
                    const div = document.createElement('div');
                    div.className = 'gap-card';
                    
                    // Lógica da Barra de Energia
                    let barsHtml = '<div class="gap-meter">';
                    for(let i = 1; i <= 4; i++) {
                        let className = 'gap-segment';
                        if (i <= real) {
                            className += ' filled'; // Nível que a pessoa tem
                        } else if (i <= meta) {
                            className += ' missing'; // O Gap (falta preencher)
                        }
                        // Níveis acima da meta ficam com a cor padrão (cinza)
                        barsHtml += `<div class="${className}"></div>`;
                    }
                    barsHtml += '</div>';

                    // Monta o HTML do card
                    div.innerHTML = `
                        <div class="gap-title">${comp.nome}</div>
                        ${barsHtml}
                        <div class="gap-text">
                            <span>Atual: <strong>${real}</strong></span>
                            <span>Meta: <strong>${meta}</strong></span>
                        </div>
                        <div style="text-align:center; font-size:0.8rem; color:var(--danger); margin-top:5px;">
                            Gap: <strong>-${meta - real}</strong> nível(is)
                        </div>
                    `;
                    container.appendChild(div);
                }
            }
        }
        
        if(container.innerHTML === '') container.innerHTML = '<p class="text-muted">Sem gaps identificados nas competências do cargo.</p>';
        renderPdiTable(pessoa);
    },

    addPdiAction: (e) => {
        e.preventDefault();
        const pid = parseInt(document.getElementById('pdi-pessoa-id').value);
        const pessoa = appData.pessoas.find(p => p.id === pid);
        
        const compId = document.getElementById('pdi-competencia').value;
        const compObj = appData.competencias.find(c => c.id == compId);

        pessoa.pdi.push({
            id: Date.now(),
            compId,
            compNome: compObj ? compObj.nome : 'Geral',
            acao: document.getElementById('pdi-acao').value,
            tipo: document.getElementById('pdi-tipo').value,
            prazo: document.getElementById('pdi-prazo').value,
            status: document.getElementById('pdi-status').value
        });

        app.saveLocal();
        app.closeModal('modal-pdi');
        app.loadPDIScreen(pid);
        app.showToast("Ação adicionada.");
    },

    deletePdiItem: (pid, pdiId) => {
        const p = appData.pessoas.find(x => x.id === pid);
        p.pdi = p.pdi.filter(i => i.id !== pdiId);
        app.saveLocal();
        app.loadPDIScreen(pid);
    },

    // --- BANCO TALENTOS (Busca Global) ---
    filtrarTalentos: () => {
        const compId = document.getElementById('filtro-competencia').value;
        const min = parseInt(document.getElementById('filtro-nivel').value);
        const tbody = document.querySelector('#tabela-talentos tbody');
        tbody.innerHTML = '';

        if(!compId) { tbody.innerHTML = '<tr><td colspan="4">Selecione uma competência acima.</td></tr>'; return; }

        appData.pessoas.forEach(p => {
            if(p.avaliacoes.length > 0) {
                // Busca nota da última avaliação (que agora contém Cargo + Extras)
                const lastAval = p.avaliacoes[p.avaliacoes.length-1];
                const nota = lastAval.notas[compId] || 0;
                
                if(nota >= min) {
                    const cargo = appData.cargos.find(c => c.id === p.cargoId);
                    
                    // Verifica se é exigência do cargo ou talento extra
                    let origem = "Extra / Talento";
                    if(cargo && cargo.mapaCompetencias[compId]) {
                        origem = "Cargo Atual";
                    }

                    tbody.innerHTML += `
                        <tr>
                            <td>${p.nome}</td>
                            <td>${cargo?cargo.nome:'-'}</td>
                            <td><span class="badge">${NIVEIS[nota]} (${nota})</span></td>
                            <td><small>${origem}</small></td>
                        </tr>
                    `;
                }
            }
        });
        if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="4">Nenhum talento encontrado com este filtro.</td></tr>';
    }
};

// --- HELPER FUNCTIONS ---

// Cria select padronizado para avaliação
function createLevelSelect(compId, currentVal) {
    return `
        <select class="aval-input" data-comp-id="${compId}" style="width: 100%;">
            <option value="0" ${currentVal==0?'selected':''}>Não possui</option>
            <option value="1" ${currentVal==1?'selected':''}>1 - Básico</option>
            <option value="2" ${currentVal==2?'selected':''}>2 - Intermediário</option>
            <option value="3" ${currentVal==3?'selected':''}>3 - Avançado</option>
            <option value="4" ${currentVal==4?'selected':''}>4 - Especializado</option>
        </select>
    `;
}

// Adiciona linha na tabela de Extras
function addExtraRow(comp, currentVal) {
    const tbody = document.getElementById('aval-tabela-extras');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${comp.nome}</td>
        <td>${createLevelSelect(comp.id, currentVal)}</td>
        <td><button type="button" class="btn-small btn-danger" onclick="this.closest('tr').remove()">&times;</button></td>
    `;
    tbody.appendChild(tr);
}

// --- RENDERIZADORES GERAIS ---
function updateAllViews() {
    renderCompetenciasList();
    renderCargosList();
    renderPessoasList();
    renderTalentosOptions();
    updateDashboard();
}

function renderCompetenciasList() {
    const tbody = document.querySelector('#tabela-competencias tbody');
    
    // Cria uma cópia para ordenar sem alterar o array original permanentemente no appData
    const listaOrdenada = [...appData.competencias].sort((a, b) => {
        let valA = (a[compSortField] || "").toString().toLowerCase();
        let valB = (b[compSortField] || "").toString().toLowerCase();
        
        if (valA < valB) return compSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return compSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = listaOrdenada.map(c => `
        <tr>
            <td>${c.nome}</td>
            <td>${c.categoria}</td>
            <td>${c.subcategoria || '-'}</td>
            <td><small>${c.descricao || '-'}</small></td>
            <td>
                <button class="btn-small btn-edit" onclick="app.editCompetencia(${c.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-small btn-danger" onclick="app.deleteCompetencia(${c.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="text-center">Nenhuma competência cadastrada.</td></tr>';
    
    // Atualiza ícones visualmente (Opcional, mas melhora a UX)
    document.querySelectorAll('#tabela-competencias th i').forEach(icon => {
        icon.className = 'fa-solid fa-sort';
        icon.style.color = '#ccc';
    });
    const activeTh = document.querySelector(`#tabela-competencias th[onclick*="'${compSortField}'"] i`);
    if (activeTh) {
        activeTh.className = compSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        activeTh.style.color = 'var(--accent)';
    }
}

function renderCargosList() {
    const tbody = document.querySelector('#tabela-cargos tbody');
    tbody.innerHTML = appData.cargos.map(c => `
        <tr>
            <td>${c.nome}</td>
            <td><span class="badge">${c.nivel || '-'}</span></td>
            <td><small>${Object.keys(c.mapaCompetencias).length} competências mapeadas</small></td>
            <td>
                <button class="btn-small btn-edit" onclick="app.editCargo(${c.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-small btn-danger" onclick="app.deleteCargo(${c.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4">Nenhum cargo cadastrado.</td></tr>';
}

function renderPessoasList() {
    const tbody = document.querySelector('#tabela-pessoas tbody');
    tbody.innerHTML = appData.pessoas.map(p => {
        const cargo = appData.cargos.find(c => c.id === p.cargoId);
        const adherencia = calculateAdherence(p, cargo);
        
        return `
        <tr>
            <td><b>${p.nome}</b><br><small style="color:#777">${p.email}</small></td>
            <td>${cargo ? cargo.nome : '-'} <small>(${cargo ? (cargo.nivel||'') : ''})</small></td>
            <td>${adherencia !== null ? adherencia + '%' : '<span style="color:#ccc">N/A</span>'}</td>
            <td>
                <button class="btn-small btn-action" onclick="app.navigate('avaliacao/${p.id}')">
                    <i class="fa-solid fa-clipboard-check"></i> Avaliar
                </button>
                <button class="btn-small btn-primary" onclick="app.navigate('pdi/${p.id}')">
                    <i class="fa-solid fa-rocket"></i> PDI
                </button>
                <button class="btn-small btn-edit" onclick="app.editPessoa(${p.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-small btn-danger" onclick="app.deletePessoa(${p.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `}).join('') || '<tr><td colspan="4">Nenhum servidor cadastrado.</td></tr>';
}

function renderCargoMapForm() {
    const container = document.getElementById('cargo-mapa-container');
    if(appData.competencias.length === 0) {
        container.innerHTML = 'Cadastre competências primeiro.';
        return;
    }
    // Usa classe .map-grid para alinhamento fixo
    container.innerHTML = appData.competencias.map(c => `
        <div class="map-grid">
            <span>${c.nome} <br><small style="color:#999">${c.subcategoria || ''}</small></span>
            <select class="map-select" data-comp-id="${c.id}">
                <option value="0">Não Exigido</option>
                <option value="1">1 - Básico</option>
                <option value="2">2 - Intermediário</option>
                <option value="3">3 - Avançado</option>
                <option value="4">4 - Especializado</option>
            </select>
        </div>
    `).join('');
}

function renderPessoasSelect() {
    const sel = document.getElementById('pessoa-cargo');
    sel.innerHTML = '<option value="">Selecione...</option>' + 
        appData.cargos.map(c => `<option value="${c.id}">${c.nome} (${c.nivel || ''})</option>`).join('');
}

function renderTalentosOptions() {
    const sel = document.getElementById('filtro-competencia');
    sel.innerHTML = '<option value="">-- Selecione --</option>' + 
        appData.competencias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
}

function renderPdiTable(pessoa) {
    const tbody = document.querySelector('#tabela-pdi tbody');
    tbody.innerHTML = pessoa.pdi.map(item => `
        <tr>
            <td>${item.compNome}</td>
            <td>${item.acao}</td>
            <td>${item.tipo}</td>
            <td>${item.prazo}</td>
            <td><span class="badge">${item.status}</span></td>
            <td><button class="btn-small btn-danger" onclick="app.deletePdiItem(${pessoa.id}, ${item.id})">X</button></td>
        </tr>
    `).join('');
}

// --- LOGIC HELPER: ADERÊNCIA ---
function calculateAdherence(pessoa, cargo) {
    if(!cargo || pessoa.avaliacoes.length === 0) return null;
    const lastAval = pessoa.avaliacoes[pessoa.avaliacoes.length-1];
    let totalMeta = 0;
    let totalReal = 0;
    
    // Considera apenas competências DO CARGO para o cálculo de %
    for(const [compId, meta] of Object.entries(cargo.mapaCompetencias)) {
        totalMeta += meta;
        let real = lastAval.notas[compId] || 0;
        if(real > meta) real = meta; 
        totalReal += real;
    }
    
    if(totalMeta === 0) return 100;
    return Math.round((totalReal / totalMeta) * 100);
}

function updateDashboard() {
    document.getElementById('rel-total-pessoas').innerText = appData.pessoas.length;
    document.getElementById('rel-total-pdi').innerText = appData.pessoas.reduce((acc, p) => acc + p.pdi.length, 0);

    let gaps = 0;
    let somaAderencia = 0;
    let countAderencia = 0;

    appData.pessoas.forEach(p => {
        const cargo = appData.cargos.find(c => c.id === p.cargoId);
        const ad = calculateAdherence(p, cargo);
        if(ad !== null) {
            somaAderencia += ad;
            countAderencia++;
        }
        
        if(cargo && p.avaliacoes.length > 0) {
            const last = p.avaliacoes[p.avaliacoes.length-1];
            for(const [cid, meta] of Object.entries(cargo.mapaCompetencias)) {
                if((last.notas[cid]||0) < meta) gaps++;
            }
        }
    });

    document.getElementById('rel-total-gaps').innerText = gaps;
    document.getElementById('rel-media-aderencia').innerText = countAderencia ? Math.round(somaAderencia/countAderencia)+'%' : '0%';
}

// --- CHART.JS HELPER ---
function renderRadarChart(labels, dataMeta, dataAtual) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    if(currentChart) currentChart.destroy();

    currentChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Meta do Cargo',
                data: dataMeta,
                fill: true,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgb(52, 152, 219)',
                pointBackgroundColor: 'rgb(52, 152, 219)',
            }, {
                label: 'Nível Servidor',
                data: dataAtual,
                fill: true,
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                borderColor: 'rgb(46, 204, 113)',
                pointBackgroundColor: 'rgb(46, 204, 113)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: false },
                    suggestedMin: 0,
                    suggestedMax: 4,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}