/* 彩虹瓶装填模拟器 — 脚本 */

/*
 * ============================================================
 * 彩虹瓶装填模拟器 — 核心逻辑
 * 数据结构知识点：
 *   栈(Stack / LIFO)：货架 shelf[]，只在顶端存取
 *   队列(Queue / FIFO)：工厂发货 order[]，按序取出
 * ============================================================
 */

/* ----------------------------------------------------------
 * 全局状态对象 S
 *   n      — 颜色总数 N（装填目标 1→N）
 *   cap    — 货架容量 M（栈的最大深度）
 *   order  — 工厂发货顺序（队列，index fi 为队头指针）
 *   need   — 当前需要装填的颜色编号（从1递增到N）
 *   fi     — 队列读取指针，下一次取货的索引
 *   shelf  — 临时货架，用数组模拟栈（末尾为栈顶）
 *   filled — 已装入瓶中的颜色，按装填顺序记录
 *   running/auto/timer/done — 自动播放控制
 *   steps/ops/peak — 统计：步数、搬运次数、货架峰值
 * ---------------------------------------------------------- */
const S={n:7,cap:6,order:[],need:1,fi:0,shelf:[],filled:[],running:false,auto:false,timer:null,steps:0,ops:0,peak:0,done:false,speed:700};

/* 颜色表：50种颜色，按颜色编号循环取用 */
const C=['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e84393','#fd79a8','#00cec9','#6c5ce7','#a29bfe','#55efc4','#ffeaa7','#fab1a0','#74b9ff','#636e72','#fdcb6e','#e17055','#00b894','#0984e3','#d63031','#00b5ad','#f39c12','#8e44ad','#16a085','#c0392b','#2980b9','#27ae60','#d35400','#1abc9c','#7f8c8d','#DAA520','#4682B4','#CD853F','#8FBC8F','#483D8B','#00CED1','#9400D3','#FF1493','#1E90FF','#B22222','#228B22','#808080','#CD5C5C','#3CB371','#7B68EE','#C71585','#DB7093','#FF4500'];
/* 根据颜色编号取对应色值 */
function gc(n){return C[(n-1)%C.length]}

/* ----------------------------------------------------------
 * 预设示例：提供几组典型参数帮助演示
 *   s1 — 成功示例（需借助货架）
 *   s2 — 顺序发货（无需货架，直接成功）
 *   f1 — 顺序错乱（货架够但顺序问题导致失败）
 *   f2 — 容量不足（逆序但货架只有5）
 *   rv — 逆序发货（需 N-1=6 容量，恰好成功）
 *   lg — 大规模15色测试
 * ---------------------------------------------------------- */
const P={s1:{n:7,m:6,o:[7,6,1,3,2,5,4]},s2:{n:7,m:6,o:[1,2,3,4,5,6,7]},f1:{n:7,m:6,o:[3,1,5,4,2,6,7]},f2:{n:7,m:5,o:[7,6,5,4,3,2,1]},rv:{n:7,m:6,o:[7,6,5,4,3,2,1]},lg:{n:15,m:10,o:[15,14,1,3,2,5,4,13,12,6,7,11,8,10,9]}};
/* 加载预设：将参数填入输入框 */
function loadP(k){const p=P[k];document.getElementById('inN').value=p.n;document.getElementById('inM').value=p.m;document.getElementById('inOrder').value=p.o.join(' ');log('info','预设: '+k)}
/* 随机生成发货顺序：Fisher-Yates 洗牌算法 */
function genRandom(){const n=parseInt(document.getElementById('inN').value)||7;const a=Array.from({length:n},(_,i)=>i+1);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}document.getElementById('inOrder').value=a.join(' ');log('info','随机: '+a.join(','))}
/* 速度滑块：实时更新自动模式的时间间隔 */
document.getElementById('speedR').addEventListener('input',function(){S.speed=+this.value;document.getElementById('speedV').textContent=this.value+'ms';if(S.auto&&S.timer){clearInterval(S.timer);S.timer=setInterval(aStep,S.speed)}});

/* ----------------------------------------------------------
 * 日志系统
 *   logs[]  — 内存日志数组（用于导出/外部窗口回放）
 *   logW    — 外部日志窗口引用
 *   log(t,m)— 同时写入内联面板和外部窗口
 * ---------------------------------------------------------- */
let logC=0;const logs=[];let logW=null;
function log(t,m){logC++;logs.push({id:logC,type:t,msg:m});
    // Inline panel
    const lp=document.getElementById('logPanel');if(lp){const e=document.createElement('div');e.className='le lt-'+t;e.innerHTML='<span class="lts">[#'+logC+']</span>'+m;lp.appendChild(e);lp.scrollTop=lp.scrollHeight}
    // External window
    if(logW&&!logW.closed)try{const d=logW.document,c=d.getElementById('lc'),e=d.createElement('div');e.className='e t-'+t;e.innerHTML='<span class="ts">[#'+logC+']</span>'+m;c.appendChild(e);c.scrollTop=c.scrollHeight}catch(x){}}
function openLog(){
    if(logW&&!logW.closed){logW.focus();return}
    logW=window.open('','_blank','width=680,height=480,scrollbars=yes');const d=logW.document;
    d.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>操作日志</title><style>body{font-family:"Cascadia Code","Consolas",monospace;font-size:13px;background:#fafbfd;color:#2c3e50;padding:14px;margin:0}h2{font-family:"Segoe UI",sans-serif;font-size:1.05em;margin-bottom:10px;color:#34495e}.tb{margin-bottom:10px;display:flex;gap:6px}.tb button{padding:4px 12px;border:1px solid #dce3eb;border-radius:6px;background:#f0f2f5;cursor:pointer;font-size:11px;font-weight:600;color:#5a6a7a}.tb button:hover{background:#e4e8ee}.e{padding:2px 0;border-bottom:1px solid #f0f2f5;line-height:1.7}.t-step{color:#3a5fc8}.t-fill{color:#1aab57}.t-stack{color:#d4890a}.t-unstack{color:#9b59b6}.t-error{color:#d63031;font-weight:700}.t-info{color:#95a5a6}.ts{color:#bdc3c7;margin-right:5px;font-weight:600}</style></head><body><h2>&#128196; 操作日志</h2><div class="tb"><button onclick="document.getElementById(\'lc\').innerHTML=\'\'">清空</button><button onclick="xp()">导出</button></div><div id="lc"></div><script>function xp(){const l=document.querySelectorAll(".e");let t="";l.forEach(e=>t+=e.textContent+"\\n");const b=new Blob([t],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="日志.txt";a.click()}<\/script></body></html>');
    d.close();const c=d.getElementById('lc');
    logs.forEach(l=>{const e=d.createElement('div');e.className='e t-'+l.type;e.innerHTML='<span class="ts">[#'+l.id+']</span>'+l.msg;c.appendChild(e)});c.scrollTop=c.scrollHeight;
}

/* ----------------------------------------------------------
 * 弹窗控制：openM 显示、hd 隐藏、clM 点击遮罩关闭
 * ---------------------------------------------------------- */
// Modal
function openM(id){document.getElementById(id).classList.add('show')}
function hd(id){document.getElementById(id).classList.remove('show')}
function clM(e,id){if(e.target===document.getElementById(id))hd(id)}

/* ----------------------------------------------------------
 * 渲染函数 render()：根据状态 S 刷新整个可视化界面
 *   1. 工厂队列：遍历 order[]，fi 之前的变灰（已取出）
 *   2. 货架(栈)：遍历 shelf[]，末尾元素为栈顶，加高亮
 *   3. 彩虹瓶：遍历 filled[]，竖向堆叠彩球
 *   4. 状态栏与统计数字同步更新
 * ---------------------------------------------------------- */
// Render
function mkBox(n,cls){const d=document.createElement('div');d.className='box '+(cls||'');d.style.background=gc(n);d.textContent='颜色'+n;return d}
function lighten(h,p){const v=parseInt(h.replace('#',''),16);const r=Math.min(255,(v>>16)+Math.round(255*p/100));const g=Math.min(255,((v>>8)&0xff)+Math.round(255*p/100));const b=Math.min(255,(v&0xff)+Math.round(255*p/100));return '#'+(r<<16|g<<8|b).toString(16).padStart(6,'0')}

function render(){
    const fQ=document.getElementById('fQ');fQ.innerHTML='';
    S.order.forEach((n,i)=>{fQ.appendChild(mkBox(n,i<S.fi?'dim':(i===S.fi&&S.running&&!S.done?'act':'')))});
    const sS=document.getElementById('sS');sS.innerHTML='';
    S.shelf.forEach((n,i)=>{sS.appendChild(mkBox(n,'box-s pop'+(i===S.shelf.length-1?' act':'')))});
    document.getElementById('capL').textContent=S.shelf.length+' / '+S.cap;
    // Bottle
    const fD=document.getElementById('fD');fD.innerHTML='';
    const em=document.getElementById('bEmpty');
    if(!S.filled.length){
        const p=document.createElement('div');p.className='bottle-empty';p.id='bEmpty';p.textContent='等待装填...';fD.appendChild(p);
    }else{
        S.filled.forEach(n=>{const b=document.createElement('div');b.className='ball';b.style.background='radial-gradient(circle at 35% 35%,'+lighten(gc(n),30)+','+gc(n)+')';b.textContent=n;fD.appendChild(b)});
    }
    document.getElementById('vNeed').textContent=S.need<=S.n?'颜色'+S.need:'完成';
    document.getElementById('vNext').textContent=S.fi<S.order.length?'颜色'+S.order[S.fi]:'搬完';
    document.getElementById('vTop').textContent=S.shelf.length?'颜色'+S.shelf[S.shelf.length-1]:'空';
    document.getElementById('prog').style.width=(S.n?S.filled.length/S.n*100:0)+'%';
    document.getElementById('sStep').textContent=S.steps;
    document.getElementById('sFill').textContent=S.filled.length+'/'+S.n;
    document.getElementById('sPeak').textContent=S.peak;
    document.getElementById('sOps').textContent=S.ops;
}

/* ----------------------------------------------------------
 * 核心算法 execStep()：单步执行一次装填逻辑
 *
 * 算法步骤（每调用一次前进一步）：
 *  ① 检查栈顶：若 shelf[top] == need，弹出(pop)并装填，need++
 *     - 继续连续检查，避免多个颜色一次性满足条件被漏掉
 *  ② 栈顶不符合 → 从队列取下一箱货(order[fi], fi++)
 *     - 若取到的箱子正好是 need → 直接装填
 *     - 否则 → 判断货架是否满：
 *         满(shelf.length >= cap) → 失败(fail)
 *         未满 → 入栈(push)，等待后续处理
 *  ③ 队列已空且栈顶也不符合 → 失败(fail)
 *
 * 返回值：'go' 继续 | 'ok' 成功 | 'fail' 失败 | 'done' 已结束
 * ---------------------------------------------------------- */
// Core
function validate(){const n=parseInt(document.getElementById('inN').value),m=parseInt(document.getElementById('inM').value);let os=document.getElementById('inOrder').value.trim();if(!n||n<1||n>50){log('error','N须1~50');return false}if(!m||m<1||m>50){log('error','M须1~50');return false}if(!os){genRandom();os=document.getElementById('inOrder').value.trim()}const o=os.split(/[\s,;]+/).map(Number).filter(x=>!isNaN(x));if(o.length!==n){log('error','长度'+o.length+'!=N'+n);return false}const s=[...o].sort((a,b)=>a-b);for(let i=0;i<n;i++)if(s[i]!==i+1){log('error','须为1~'+n+'排列');return false}S.n=n;S.cap=m;S.order=o;return true}
function start(){if(!validate())return;Object.assign(S,{need:1,fi:0,shelf:[],filled:[],running:true,auto:false,done:false,steps:0,ops:0,peak:0});document.getElementById('btnStart').disabled=true;document.getElementById('btnStep').disabled=false;document.getElementById('btnAuto').disabled=false;setBadge('b-run','运行中');log('step','===== 模拟开始 =====');log('info','N='+S.n+' M='+S.cap+' ['+S.order.join(',')+']');render()}
function execStep(){if(S.done)return 'done';if(S.need>S.n){ok();return 'ok'}S.steps++;if(S.shelf.length&&S.shelf[S.shelf.length-1]===S.need){const c=S.shelf.pop();S.filled.push(c);S.ops++;log('unstack','&#8593; 取栈顶'+c);S.need++;while(S.shelf.length&&S.shelf[S.shelf.length-1]===S.need){const c2=S.shelf.pop();S.filled.push(c2);S.ops++;log('unstack','&#8593; 连续取'+c2);S.need++}render();if(S.need>S.n){ok();return 'ok'}return 'go'}if(S.fi>=S.order.length){fail('工厂无货，需要'+S.need);return 'fail'}const box=S.order[S.fi];S.fi++;S.ops++;log('step','&#128666; 搬来'+box+'(第'+S.fi+'箱)');if(box===S.need){S.filled.push(box);log('fill','&#10004; 装填'+box);S.need++;while(S.shelf.length&&S.shelf[S.shelf.length-1]===S.need){const c2=S.shelf.pop();S.filled.push(c2);S.ops++;log('unstack','&#8593; 连续取'+c2);S.need++}render();if(S.need>S.n){ok();return 'ok'}}else{if(S.shelf.length>=S.cap){fail('货架满('+S.cap+')放不下'+box);return 'fail'}S.shelf.push(box);if(S.shelf.length>S.peak)S.peak=S.shelf.length;log('stack','&#8595; 入栈'+box+'('+S.shelf.length+'/'+S.cap+')');render()}return 'go'}
function ok(){S.done=true;S.running=false;stopA();setBadge('b-ok','成功');document.getElementById('btnStep').disabled=true;document.getElementById('btnAuto').disabled=true;log('fill','===== &#127881; 成功! =====');render();addH(true);showR(true)}
function fail(r){S.done=true;S.running=false;stopA();setBadge('b-fail','失败');document.getElementById('btnStep').disabled=true;document.getElementById('btnAuto').disabled=true;log('error','===== &#128544; '+r+' =====');render();addH(false);showR(false,r)}
function step(){if(S.running&&!S.done)execStep()}
function aStep(){if(!S.running||S.done){stopA();return}if(execStep()!=='go')stopA()}
function toggleAuto(){if(S.auto)stopA();else{S.auto=true;document.getElementById('btnAuto').textContent='⏸暂停';document.getElementById('btnStep').disabled=true;S.timer=setInterval(aStep,S.speed)}}
function stopA(){S.auto=false;if(S.timer){clearInterval(S.timer);S.timer=null}document.getElementById('btnAuto').textContent='▶▶ 自动';if(S.running&&!S.done)document.getElementById('btnStep').disabled=false}
function reset(){stopA();Object.assign(S,{need:1,fi:0,shelf:[],filled:[],running:false,auto:false,done:false,steps:0,ops:0,peak:0});document.getElementById('btnStart').disabled=false;document.getElementById('btnStep').disabled=true;document.getElementById('btnAuto').disabled=true;document.getElementById('btnAuto').textContent='▶▶ 自动';document.getElementById('fQ').innerHTML='<div class="ph">点击"开始"<br>查看队列</div>';document.getElementById('sS').innerHTML='';document.getElementById('fD').innerHTML='<div class="bottle-empty" id="bEmpty">等待装填...</div>';document.getElementById('capL').textContent='0 / 0';document.getElementById('prog').style.width='0%';setBadge('b-idle','等待开始');document.getElementById('vNeed').textContent='-';document.getElementById('vNext').textContent='-';document.getElementById('vTop').textContent='空';document.getElementById('sStep').textContent='0';document.getElementById('sFill').textContent='0';document.getElementById('sPeak').textContent='0';document.getElementById('sOps').textContent='0';log('info','已重置')}
function setBadge(c,t){const b=document.getElementById('badge');b.className='badge '+c;b.textContent=t}

// Result
function showR(ok,reason){document.getElementById('rIcon').innerHTML=ok?'&#127881;':'&#128544;';document.getElementById('rTitle').textContent=ok?'装填成功!':'装填失败!';document.getElementById('rTitle').style.color=ok?'#1aab57':'#d63031';document.getElementById('rDesc').textContent=ok?'全部'+S.n+'种颜色已装填完成。':reason;document.getElementById('rSts').innerHTML='<div class="rsi"><div class="rsn">'+S.steps+'</div><div class="rsl">步数</div></div><div class="rsi"><div class="rsn">'+S.filled.length+'/'+S.n+'</div><div class="rsl">装填</div></div><div class="rsi"><div class="rsn">'+S.peak+'</div><div class="rsl">峰值</div></div><div class="rsi"><div class="rsn">'+S.ops+'</div><div class="rsl">搬运</div></div>';openM('mResult')}

/* ----------------------------------------------------------
 * 批量静默模拟 simS(o, n, m)：不更新 UI，仅返回结果
 * 用于批量测试时高速运行（无动画），统计成功率
 * ---------------------------------------------------------- */
// Batch
function simS(o,n,m){let nd=1,fi=0;const sh=[];let pk=0;while(nd<=n){if(sh.length&&sh[sh.length-1]===nd){sh.pop();nd++;while(sh.length&&sh[sh.length-1]===nd){sh.pop();nd++}continue}if(fi>=o.length)return{ok:false,pk};const b=o[fi++];if(b===nd){nd++;while(sh.length&&sh[sh.length-1]===nd){sh.pop();nd++}}else{if(sh.length>=m)return{ok:false,pk};sh.push(b);if(sh.length>pk)pk=sh.length}}return{ok:true,pk}}
function runBatch(){const n=+document.getElementById('bN').value||7,m=+document.getElementById('bM').value||6,cnt=Math.min(+document.getElementById('bC').value||100,10000);let pass=0;const res=[];const t0=performance.now();for(let t=0;t<cnt;t++){const a=Array.from({length:n},(_,i)=>i+1);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}const r=simS(a,n,m);if(r.ok)pass++;if(res.length<50)res.push({o:a.join(','),ok:r.ok,pk:r.pk})}const ms=(performance.now()-t0).toFixed(1),rate=(pass/cnt*100).toFixed(1);document.getElementById('bSum').innerHTML='<b>完成</b>('+ms+'ms) 总'+cnt+' <span style="color:#1aab57">通过'+pass+'('+rate+'%)</span> <span style="color:#d63031">失败'+(cnt-pass)+'</span>';const c=document.getElementById('bRes');c.innerHTML='';res.forEach((r,i)=>{const d=document.createElement('div');d.className='brow';d.innerHTML='<span style="color:#7f8c8d;width:26px">#'+(i+1)+'</span><span style="flex:1;margin:0 4px;word-break:break-all">['+r.o+']</span><span style="width:24px">'+r.pk+'</span>'+(r.ok?'<span class="bpass">PASS</span>':'<span class="bfail">FAIL</span>');c.appendChild(d)});log('info','批量N='+n+' M='+m+' x'+cnt+' '+rate+'%')}

/* ----------------------------------------------------------
 * 模拟历史记录：每次运行结束后追加一条记录
 * hist[] 最多保留50条，点击可快速回填参数
 * ---------------------------------------------------------- */
// History
const hist=[];
function addH(ok){hist.unshift({t:new Date().toLocaleTimeString(),n:S.n,m:S.cap,o:[...S.order],ok});if(hist.length>50)hist.pop();rH()}
function rH(){const c=document.getElementById('hList');if(!hist.length){c.innerHTML='<div style="color:#bdc3c7;text-align:center;padding:16px">暂无记录</div>';return}c.innerHTML='';hist.forEach(h=>{const d=document.createElement('div');d.className='brow';d.style.cursor='pointer';d.innerHTML='<span style="color:#7f8c8d;width:54px">'+h.t+'</span><span style="margin:0 4px">N='+h.n+' M='+h.m+'</span><span style="flex:1"></span>'+(h.ok?'<span class="bpass">成功</span>':'<span class="bfail">失败</span>');d.title='['+h.o.join(',')+']';d.onclick=()=>{document.getElementById('inN').value=h.n;document.getElementById('inM').value=h.m;document.getElementById('inOrder').value=h.o.join(' ');log('info','从历史加载')};c.appendChild(d)})}

/* 键盘快捷键：Space/Enter 单步或开始，A 自动，R 重置，Esc 关闭弹窗 */
// Keyboard
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!S.running)start();else if(!S.done)step()}if(e.key==='a'||e.key==='A'){if(S.running&&!S.done)toggleAuto()}if(e.key==='r'||e.key==='R')reset();if(e.key==='Escape')['mAlgo','mFlow','mBatch','mHist','mResult'].forEach(hd)});

function clearLogPanel(){document.getElementById('logPanel').innerHTML=''}

log('info','模拟器就绪');
