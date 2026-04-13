/* 银行排队模拟器 — 脚本 */

/* ============================================================
   银行排队模拟器 — JavaScript
   数据结构：Queue（等待队列）+ Stack（服务历史）
   ============================================================ */

// ─── 全局状态 ────────────────────────────────────────────────
const S = {
    queue:   [],   // 等待队列  (Queue / FIFO)  — push/shift
    history: [],   // 历史记录  (Stack / LIFO)  — push/pop
    windows: [],   // 服务窗口数组
    clock:   0,    // 当前时钟（秒）
    running: false,// 模拟是否已启动
    autoTimer: null,// 自动步进定时器 ID
    custId:  0,    // 客户自增 ID
};

// ─── 工具：生成客户对象 ───────────────────────────────────────
function makeCust(name, isVip) {
    return { id: ++S.custId, name, isVip, arriveAt: S.clock, serviceTime: 0, startAt: null, endAt: null };
}

// ─── 工具：格式化时钟 ─────────────────────────────────────────
function fmt(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2,'0');
    const s = String(sec % 60).padStart(2,'0');
    return `${m}:${s}`;
}

// ─── 日志 ────────────────────────────────────────────────────
function log(type, msg) {
    const panel = document.getElementById('logPanel');
    if (!panel) return;
    const el = document.createElement('div');
    el.className = `le lt-${type}`;
    el.textContent = `[${fmt(S.clock)}] ${msg}`;
    panel.prepend(el);
    // 最多保留 80 条
    while (panel.children.length > 80) panel.removeChild(panel.lastChild);
}

// ─── Modal ────────────────────────────────────────────────────
function openM(id) { document.getElementById(id).style.display='flex'; }
function clM(e,id) { if(!e||e.target===document.getElementById(id)) document.getElementById(id).style.display='none'; }
function hd(id)    { document.getElementById(id).style.display='none'; }

// ─── 渲染 ────────────────────────────────────────────────────
function render() {
    renderQueue();
    renderWindows();
    renderHistory();
    renderStats();
}

/* 渲染等待队列轨道 */
function renderQueue() {
    const track = document.getElementById('queueTrack');
    if (!track) return;
    track.innerHTML = '';
    if (S.queue.length === 0) {
        track.innerHTML = '<span style="color:#b0bec5;font-size:0.82em;margin:auto;">暂无等待客户</span>';
        return;
    }
    S.queue.forEach((c, i) => {
        const el = document.createElement('div');
        el.className = `cust ${c.isVip ? 'cust-vip' : 'cust-normal'}`;
        el.title = `${c.name}  到达 ${fmt(c.arriveAt)}`;
        // 队首（索引0）是下一个被服务的人，显示序号从1开始
        el.innerHTML = `<span style="font-size:0.72em;opacity:0.7">#${i+1}</span><br>${c.name}${c.isVip ? '<br><b style="font-size:0.65em">VIP</b>' : ''}`;
        track.appendChild(el);
    });
}

/* 渲染服务窗口 */
function renderWindows() {
    const box = document.getElementById('windowsRow');
    if (!box) return;
    box.innerHTML = '';
    if (!S.running) {
        box.innerHTML = '<span style="color:#b0bec5;font-size:0.82em">请先点击「开始模拟」</span>';
        return;
    }
    S.windows.forEach((w, i) => {
        const el = document.createElement('div');
        el.className = `win-box${w.cust ? (w.timeLeft > 0 ? ' busy' : ' done') : ''}`;
        if (w.cust) {
            const pct = Math.round(((w.totalTime - w.timeLeft) / w.totalTime) * 100);
            el.innerHTML =
                `<div class="wn">窗口 ${i+1}</div>
                 <div class="wc ${w.cust.isVip ? 'cust-vip' : 'cust-normal'}" style="margin:6px auto;width:52px;height:52px;line-height:52px;font-size:0.78em">${w.cust.name}${w.cust.isVip?'<br><b style="font-size:0.65em">VIP</b>':''}</div>
                 <div style="font-size:0.72em;color:#666">剩余 ${w.timeLeft}s</div>
                 <div class="pg"><div class="pf" style="width:${pct}%"></div></div>`;
        } else {
            el.innerHTML = `<div class="wn">窗口 ${i+1}</div><div style="font-size:0.8em;color:#b0bec5;margin-top:8px">空闲</div>`;
        }
        box.appendChild(el);
    });
}

/* 渲染历史栈 */
function renderHistory() {
    const stack = document.getElementById('histStack');
    if (!stack) return;
    stack.innerHTML = '';
    if (S.history.length === 0) {
        stack.innerHTML = '<div style="color:#b0bec5;font-size:0.82em;text-align:center;padding:16px">暂无记录</div>';
        return;
    }
    // 从栈顶（末尾）向下展示
    [...S.history].reverse().forEach((r, i) => {
        const el = document.createElement('div');
        el.className = 'hist-row';
        if (i === 0) el.style.cssText = 'background:#fff8e1;border-left:3px solid #f39c12;'; // 栈顶高亮
        el.innerHTML =
            `<span>${r.isVip ? '⭐' : '👤'} ${r.name}</span>
             <span style="color:#888;font-size:0.78em">${fmt(r.startAt)}→${fmt(r.endAt)}</span>`;
        stack.appendChild(el);
    });
}

/* 渲染统计数字 */
function renderStats() {
    const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    // 状态栏
    set('vClock', fmt(S.clock));
    set('vQLen',  S.queue.length + ' 人');
    set('vBusy',  S.windows.filter(w => w.cust && w.timeLeft > 0).length);
    // 统计卡片
    set('sTot',  S.custId);
    set('sDone', S.history.length);
    set('sWait', S.queue.length);
    // 平均等待步数
    if (S.history.length > 0) {
        const avg = Math.round(S.history.reduce((a,r) => a + (r.startAt - r.arriveAt), 0) / S.history.length);
        set('sAvg', avg + ' 步');
    } else {
        set('sAvg', '—');
    }
    // 撤销按钮
    const ub = document.getElementById('btnUndo');
    if (ub) ub.disabled = S.history.length === 0;
    // 状态徽章
    const badge = document.getElementById('badge');
    if (badge) {
        if (!S.running) { badge.textContent='等待开始'; badge.className='badge b-idle'; }
        else if (S.autoTimer) { badge.textContent='自动运行'; badge.className='badge b-run'; }
        else { badge.textContent='已就绪'; badge.className='badge b-ready'; }
    }
}

// ─── 核心操作 ────────────────────────────────────────────────

/* 手动添加客户 */
function addCustomer() {
    const nameEl = document.getElementById('inName');
    const name = (nameEl.value.trim()) || `客户${S.custId+1}`;
    const isVip = document.querySelector('input[name="ctype"]:checked')?.value === 'vip';
    const c = makeCust(name, isVip);

    if (isVip) {
        // VIP：插入队首 → unshift（体现优先队列概念）
        S.queue.unshift(c);
        log('enq', `VIP客户「${name}」插入队首（当前队长 ${S.queue.length}）`);
    } else {
        // 普通：入队尾 → push（标准 Queue FIFO）
        S.queue.push(c);
        log('enq', `「${name}」加入等待队列（当前队长 ${S.queue.length}）`);
    }

    nameEl.value = '';
    render();
}

/* 随机批量添加 */
function addRandom() {
    const n = parseInt(document.getElementById('inDur').value) || 5;
    const surnames = ['张','李','王','刘','陈','杨','赵','黄','周','吴','徐','孙','马','高','林'];
    const names2   = ['伟','芳','娜','秀英','敏','静','丽','强','磊','军','洋','艳','勇','涛','峰'];
    // Fisher-Yates 洗牌后取前 n 个姓名组合
    const pool = surnames.flatMap(a => names2.map(b => a+b));
    for (let i = pool.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < n; i++) {
        const isVip = Math.random() < 0.2;
        const name  = pool[i % pool.length];
        const c = makeCust(name, isVip);
        if (isVip) { S.queue.unshift(c); }
        else        { S.queue.push(c); }
    }
    log('info', `随机添加 ${n} 位客户（含 VIP 约 20%），队长 ${S.queue.length}`);
    render();
}

/* 开始模拟：初始化窗口 */
function startSim() {
    const n = parseInt(document.getElementById('inWin').value) || 3;
    if (S.running) {
        log('warn', '模拟已在运行中');
        return;
    }
    S.windows = Array.from({length: n}, (_, i) => ({ id: i+1, cust: null, timeLeft: 0, totalTime: 0 }));
    S.running = true;
    // 解锁步进/自动/添加按钮
    ['btnStep','btnAuto','btnAdd','btnRand'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
    log('info', `模拟启动，共 ${n} 个服务窗口`);
    render();
}

/* 单步推进 */
function stepOnce() {
    if (!S.running) { log('warn', '请先启动模拟'); return; }
    S.clock++;

    // 1. 完成服务：timeLeft 降至 0 的窗口 → 将客户压入历史栈
    S.windows.forEach(w => {
        if (w.cust && w.timeLeft <= 0) {
            w.cust.endAt = S.clock;
            S.history.push(w.cust);           // Stack push ← LIFO
            log('done', `窗口${w.id} 完成服务：「${w.cust.name}」（耗时 ${w.cust.serviceTime}s）`);
            w.cust = null;
        }
    });

    // 2. 分配客户：空闲窗口从队首取客户 → Queue shift（FIFO）
    S.windows.forEach(w => {
        if (!w.cust && S.queue.length > 0) {
            const c = S.queue.shift();         // Queue dequeue ← FIFO
            c.startAt = S.clock;
            c.serviceTime = 5 + Math.floor(Math.random() * 16); // 5~20s
            w.cust = c;
            w.timeLeft  = c.serviceTime;
            w.totalTime = c.serviceTime;
            log('deq', `窗口${w.id} 开始服务「${c.name}」，预计 ${c.serviceTime}s`);
        }
    });

    // 3. 正在服务的窗口倒计时
    S.windows.forEach(w => {
        if (w.cust && w.timeLeft > 0) w.timeLeft--;
    });

    render();
}

/* 撤销上一次服务 */
function undoLast() {
    if (S.history.length === 0) { log('warn', '历史记录为空，无法撤销'); return; }
    const c = S.history.pop();              // Stack pop ← LIFO
    c.startAt = null;
    c.endAt   = null;
    S.queue.unshift(c);                     // 重新插回队首
    log('undo', `撤销「${c.name}」，已放回队首`);
    render();
}

/* 切换自动步进 */
function toggleAuto() {
    if (S.autoTimer) {
        stopAuto();
    } else {
        if (!S.running) { log('warn', '请先启动模拟'); return; }
        const speed = parseInt(document.getElementById('speedR')?.value) || 900;
        const btn = document.getElementById('btnAuto');
        if (btn) btn.textContent = '⏸ 暂停';
        S.autoTimer = setInterval(stepOnce, speed);
        log('info', `自动步进已开启（${speed}ms/步）`);
        render();
    }
}

/* 停止自动步进 */
function stopAuto() {
    if (S.autoTimer) {
        clearInterval(S.autoTimer);
        S.autoTimer = null;
        const btn = document.getElementById('btnAuto');
        if (btn) btn.innerHTML = '&#9654;&#9654; 自动';
        log('info', '自动步进已暂停');
        render();
    }
}

/* 重置模拟 */
function resetSim() {
    stopAuto();
    Object.assign(S, { queue:[], history:[], windows:[], clock:0, running:false, custId:0 });
    ['btnStep','btnAuto','btnAdd','btnRand'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
    log('info', '已重置模拟');
    render();
}

/* 更新客户类型 UI（选中 VIP 时高亮） */
function updateTypeUI() {
    const isVip = document.querySelector('input[name="ctype"]:checked')?.value === 'vip';
    document.getElementById('optNormal')?.classList.toggle('selected', !isVip);
    document.getElementById('optVip')?.classList.toggle('selected',  isVip);
}

/* 清空日志 */
function clearLog() {
    const panel = document.getElementById('logPanel');
    if (panel) panel.innerHTML = '';
}

// ─── 初始化速度滑块联动 ───────────────────────────────────────
window.onload = () => {
    const slider = document.getElementById('speedR');
    const label  = document.getElementById('speedV');
    if (slider && label) {
        slider.addEventListener('input', () => {
            label.textContent = slider.value + 'ms';
            if (S.autoTimer) { stopAuto(); toggleAuto(); }
        });
    }
    render();
    log('info', '欢迎使用银行排队模拟器，点击「开始」启动。');
};

/* ----------------------------------------------------------
 * 外部日志窗口
 * ---------------------------------------------------------- */
let logW = null;
function openLog() {
    if (logW && !logW.closed) { logW.focus(); return; }
    logW = window.open('', '_blank', 'width=680,height=480,scrollbars=yes');
    const d = logW.document;
    d.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>银行排队日志</title><style>body{font-family:"Cascadia Code","Consolas",monospace;font-size:13px;background:#fafbfd;color:#2c3e50;padding:14px;margin:0}h2{font-family:"Segoe UI",sans-serif;font-size:1.05em;margin-bottom:10px;color:#34495e}.tb{margin-bottom:10px;display:flex;gap:6px}.tb button{padding:4px 12px;border:1px solid #dce3eb;border-radius:6px;background:#f0f2f5;cursor:pointer;font-size:11px;font-weight:600;color:#5a6a7a}.tb button:hover{background:#e4e8ee}.e{padding:2px 0;border-bottom:1px solid #f0f2f5;line-height:1.7}.t-enq{color:#3a5fc8}.t-deq{color:#1aab57}.t-done{color:#9b59b6}.t-info{color:#95a5a6}.t-warn{color:#d63031;font-weight:700}.ts{color:#bdc3c7;margin-right:5px;font-weight:600}</style></head><body><h2>&#128196; 银行排队日志</h2><div class="tb"><button onclick="document.getElementById(\'lc\').innerHTML=\'\'">清空</button><button onclick="xp()">导出</button></div><div id="lc"></div><script>function xp(){const l=document.querySelectorAll(".e");let t="";l.forEach(e=>t+=e.textContent+"\\n");const b=new Blob([t],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="银行排队日志.txt";a.click()}<\/script></body></html>');
    d.close();
    const lp = document.getElementById('logPanel');
    if (lp) {
        const c = d.getElementById('lc');
        Array.from(lp.children).forEach(el => {
            const e = d.createElement('div');
            e.className = 'e';
            e.innerHTML = el.innerHTML;
            c.appendChild(e);
        });
        c.scrollTop = c.scrollHeight;
    }
}

/* ----------------------------------------------------------
 * 批量静默模拟
 * ---------------------------------------------------------- */
function runBankBatch() {
    const nCust = Math.min(+document.getElementById('bCust').value || 20, 100);
    const nWin  = Math.min(+document.getElementById('bWin').value || 3, 5);
    const runs  = Math.min(+document.getElementById('bRun').value || 50, 1000);
    const dur   = +document.getElementById('inDur').value || 3;
    const results = [];
    const t0 = performance.now();
    for (let r = 0; r < runs; r++) {
        let q = [], wins = [], hist = [], clock = 0, totalWait = 0;
        for (let i = 0; i < nWin; i++) wins.push({ busy: false, timeLeft: 0, cust: null });
        // 随机到达：每步 0~2 人
        let arrived = 0;
        while (arrived < nCust || q.length > 0 || wins.some(w => w.busy)) {
            clock++;
            if (arrived < nCust) {
                const add = Math.min(Math.floor(Math.random() * 3), nCust - arrived);
                for (let i = 0; i < add; i++) { q.push({ id: ++arrived, arriveAt: clock }); }
            }
            wins.forEach(w => { if (w.busy) { w.timeLeft--; if (w.timeLeft <= 0) { hist.push(w.cust); w.busy = false; w.cust = null; } } });
            wins.forEach(w => { if (!w.busy && q.length) { const c = q.shift(); totalWait += clock - c.arriveAt; w.busy = true; w.timeLeft = dur; w.cust = c; } });
            if (clock > 500) break;
        }
        const avgW = hist.length ? (totalWait / hist.length).toFixed(1) : '-';
        results.push({ served: hist.length, avgWait: avgW, steps: clock });
    }
    const ms = (performance.now() - t0).toFixed(1);
    const avgAll = (results.reduce((s, r) => s + parseFloat(r.avgWait || 0), 0) / runs).toFixed(1);
    document.getElementById('bBankSum').innerHTML = '<b>完成</b>(' + ms + 'ms) ' + runs + '次 平均等待<b>' + avgAll + '</b>步';
    const c = document.getElementById('bBankRes'); c.innerHTML = '';
    results.slice(0, 50).forEach((r, i) => {
        const d = document.createElement('div'); d.className = 'brow';
        d.innerHTML = '<span style="color:#7f8c8d;width:30px">#' + (i + 1) + '</span><span style="flex:1">服务' + r.served + '人 平均等待' + r.avgWait + '步</span><span style="color:#3a5fc8;font-weight:700">' + r.steps + '步</span>';
        c.appendChild(d);
    });
}

/* ----------------------------------------------------------
 * 模拟历史记录
 * ---------------------------------------------------------- */
const bankHist = [];
function addBankHist() {
    bankHist.unshift({ t: new Date().toLocaleTimeString(), tot: S.custId, done: S.history.length, clock: S.clock });
    if (bankHist.length > 50) bankHist.pop();
    renderBankHist();
}
function renderBankHist() {
    const c = document.getElementById('bankHistList');
    if (!c) return;
    if (!bankHist.length) { c.innerHTML = '<div style="color:#bdc3c7;text-align:center;padding:16px">暂无记录</div>'; return; }
    c.innerHTML = '';
    bankHist.forEach(h => {
        const d = document.createElement('div'); d.className = 'brow';
        d.innerHTML = '<span style="color:#7f8c8d;width:54px">' + h.t + '</span><span style="margin:0 4px">到场' + h.tot + ' 服务' + h.done + '</span><span style="flex:1"></span><span style="color:#3a5fc8;font-weight:600">' + h.clock + '步</span>';
        c.appendChild(d);
    });
}

/* ----------------------------------------------------------
 * 键盘快捷键
 * ---------------------------------------------------------- */
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (S.running) stepOnce(); else startSim(); }
    if (e.key === 'a' || e.key === 'A') { if (S.running) toggleAuto(); }
    if (e.key === 'r' || e.key === 'R') resetSim();
    if (e.key === 'Escape') ['mAlgo', 'mFlow', 'mBatch', 'mHist'].forEach(hd);
});

