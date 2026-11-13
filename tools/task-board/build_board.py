#!/usr/bin/env python3
"""Render the game development board (board.html) from the coordinator's board.json.

Source of truth: ~/.hermes/los-nightly/board.json   ->   output: <repo>/board.html
Self-contained: no external fonts, no images, no http(s) references.
"""
import json, os, html, datetime

BOARD = os.path.expanduser("~/.hermes/los-nightly/board.json")
OUT = "/home/ubuntu/pvz-art/build/web_game/board.html"

COLUMNS = [
    ("verifying", "待验收", "只差协调方本机验收"),
    ("active", "进行中", "已核实正在执行"),
    ("blocked", "阻塞 / 暂停", "显示原因与下一步，不冒称在运行"),
    ("planned", "待开始", "已登记，未执行"),
    ("backlog", "待排期", "按难度从低到高"),
    ("shipped", "已完成", "结果已核验，不等同仅生成文件"),
    ("cancelled", "已终止", "保留历史文件，不再制作"),
]
STAR = {1: "★☆☆☆☆", 2: "★★☆☆☆", 3: "★★★☆☆", 4: "★★★★☆", 5: "★★★★★"}


def esc(t):
    return html.escape(str(t), quote=True)


def card(g):
    tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in g.get("tags", []))
    acc = "".join(f"<li>{esc(a)}</li>" for a in g.get("acceptance", []))
    done = "".join(f"<li>{esc(d)}</li>" for d in g.get("done", []))
    extra = ""
    for label, key in [("当前进度", "progress"), ("阻塞原因", "blocker"), ("下一步", "next_step")]:
        if g.get(key):
            extra += f'<p class="detail"><b>{esc(label)}</b>：{esc(g[key])}</p>'
    evidence = g.get("evidence", [])
    if evidence:
        extra += '<div class="sec"><h4>核验记录</h4><ul>' + ''.join(f'<li>{esc(x)}</li>' for x in evidence) + '</ul></div>'
    if g.get("preview") and str(g["preview"]).startswith("pocket-bounce-preview/"):
        extra += f'<p><a href="{esc(g["preview"])}">打开未验收原型</a></p>'
    if acc:
        extra += f'<div class="sec"><h4>验收要点</h4><ul>{acc}</ul></div>'
    if done:
        extra += f'<div class="sec"><h4>已完成</h4><ul class="done">{done}</ul></div>'
    return f"""      <article class="card task" data-task-id="{esc(g['id'])}" data-kind="{esc(g.get('kind', '游戏'))}">
        <div class="chead">
          <h3>{esc(g['name'])}</h3>
          <span class="diff">{esc(g.get("kind", "游戏"))}</span>
        </div>
        <p class="pitch">{esc(g['pitch'])}</p>
        <div class="tags">{tags}</div>
        <dl>
          <dt>负责</dt><dd>{esc(g.get("owner", "待安排"))}</dd>
          <dt>更新</dt><dd>{esc(g.get("updated", "—"))}</dd>
          <dt>来源</dt><dd>{esc(g.get('origin', '—'))}</dd>
          <dt>素材</dt><dd>{esc(g.get('art', '—'))}</dd>
        </dl>
        {extra}
        <p class="note">备注：{esc(g.get('note', '—'))}</p>
      </article>"""


def cand_card(c):
    return f"""      <article class="card cand">
        <div class="chead"><h3>{esc(c['name'])}</h3><span class="diff">{STAR.get(c.get('difficulty', 3), '★★★☆☆')}</span></div>
        <p class="pitch">{esc(c['pitch'])}</p>
        <p class="basis"><b>授权依据</b>：{esc(c['basis'])}</p>
        <p class="note">备注：{esc(c.get('note', '—'))}</p>
      </article>"""


def main():
    with open(BOARD, encoding="utf-8") as f:
        b = json.load(f)

    tasks = b.get("tasks", b.get("games", []))
    ids = [t["id"] for t in tasks]
    if len(ids) != len(set(ids)):
        raise ValueError("重复任务 ID")
    if any(t.get("state") not in dict((k, title) for k, title, _ in COLUMNS) for t in tasks):
        raise ValueError("未知任务状态")
    if any(t.get('state') == 'shipped' and not t.get('evidence') for t in tasks):
        raise ValueError('已完成任务缺少核验记录')
    cols = []
    for key, title, sub in COLUMNS:
        items = [g for g in tasks if g.get("state") == key]
        cards = "\n".join(card(g) for g in items) or '<p class="empty">（暂无）</p>'
        cols.append(
            f"""      <section class="col col-{key}">
        <header><h2>{esc(title)}<span class="count">{len(items)}</span></h2><p>{esc(sub)}</p></header>
{cards}
      </section>"""
        )

    flow = "".join(f"<li>{esc(x)}</li>" for x in b.get("flow", []))
    common = "".join(f"<li>{esc(x)}</li>" for x in b.get("common_requirements", []))
    cands = "\n".join(cand_card(c) for c in b.get("candidates", []))
    rejected = "".join(f"<li>{esc(x)}</li>" for x in b.get("rejected", []))
    n_games = len(tasks)
    n_ship = sum(1 for g in tasks if g.get("state") == "shipped")

    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>任务看板 · 项目与进度</title>
<style>
  :root {{
    --bg: #0f1418; --panel: #161d23; --panel2: #1b242c; --line: #263039;
    --fg: #e8eef2; --dim: #93a4b1; --accent: #6cd97b; --warn: #ffc857; --blue: #62b6ff; --pink: #ff8fb1;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--fg);
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif; line-height: 1.5; }}
  a {{ color: var(--blue); }}
  header.top {{ padding: 22px 24px 10px; border-bottom: 1px solid var(--line); }}
  header.top h1 {{ margin: 0 0 6px; font-size: 22px; letter-spacing: .5px; }}
  header.top .meta {{ color: var(--dim); font-size: 13px; }}
  .wrap {{ padding: 18px 24px 40px; }}
  .info {{ display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; margin-bottom: 18px; }}
  .info section {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }}
  .info h2 {{ margin: 0 0 8px; font-size: 15px; color: var(--accent); }}
  .info ol, .info ul {{ margin: 0; padding-left: 20px; color: #cfdae2; font-size: 13.5px; }}
  .info li {{ margin: 3px 0; }}
  .board {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }}
  .col {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px; }}
  .col > header h2 {{ margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }}
  .col > header p {{ margin: 2px 0 10px; font-size: 11.5px; color: var(--dim); }}
  .count {{ background: #22303a; color: #cfe3ee; border-radius: 999px; font-size: 11px; padding: 1px 8px; }}
  .col-shipped > header h2 {{ color: var(--accent); }}
  .col-active > header h2, .col-verifying > header h2 {{ color: var(--warn); }}
  .col-planned > header h2 {{ color: var(--blue); }}
  .col-backlog > header h2 {{ color: var(--dim); }}
  .card {{ background: var(--panel2); border: 1px solid var(--line); border-left: 3px solid #33424e;
    border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }}
  .col-shipped .card {{ border-left-color: var(--accent); }}
  .col-active .card, .col-verifying .card {{ border-left-color: var(--warn); }}
  .col-planned .card {{ border-left-color: var(--blue); }}
  .card .chead {{ display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }}
  .card h3 {{ margin: 0; font-size: 13.5px; }}
  .diff {{ color: var(--warn); font-size: 11px; letter-spacing: 1px; white-space: nowrap; }}
  .detail {{ font-size:13px; color:#cbd6de; }}
  .filters {{ display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }}
  .filters input, .filters select {{ border:1px solid var(--line); border-radius:8px; padding:12px; background:var(--panel); color:var(--fg); font:inherit; min-width:0; }}
  .filters input {{ flex:1; }}
  [hidden] {{ display:none !important; }}
  .col-blocked > header h2 {{ color:var(--pink); }}
  .col-blocked .card {{ border-left-color:var(--pink); }}
  .pitch {{ margin: 6px 0 8px; font-size: 12.5px; color: #cbd6de; }}
  .tags {{ display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }}
  .tag {{ font-size: 11px; color: #b8d8c4; background: #1d2c24; border: 1px solid #2c4034; border-radius: 999px; padding: 1px 8px; }}
  dl {{ margin: 0; font-size: 11.5px; color: #b9c6d0; }}
  dt {{ float: left; clear: left; width: 30px; color: var(--dim); }}
  dd {{ margin: 0 0 3px 34px; }}
  .sec {{ margin-top: 8px; }}
  .sec h4 {{ margin: 0 0 4px; font-size: 11.5px; color: var(--dim); font-weight: 600; }}
  .sec ul {{ margin: 0; padding-left: 16px; font-size: 11.5px; color: #c2ced7; }}
  .sec ul li {{ margin: 2px 0; }}
  .done li {{ color: #9fd8ae; }}
  .note {{ margin: 8px 0 0; font-size: 11.5px; color: #8fa3b0; border-top: 1px dashed #2a3742; padding-top: 6px; }}
  .basis {{ font-size: 11.5px; color: #c2ced7; margin: 4px 0 0; }}
  .empty {{ color: #5b6a75; font-size: 12px; margin: 6px 2px; }}
  .wide {{ display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-top: 18px; }}
  .wide section {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }}
  .wide h2 {{ margin: 0 0 8px; font-size: 15px; color: var(--pink); }}
  .wide ul {{ margin: 0; padding-left: 20px; font-size: 13px; color: #cfdae2; }}
  .wide li {{ margin: 4px 0; }}
  footer {{ color: #6d7d88; font-size: 12px; padding: 0 24px 30px; }}
  code {{ background: #1d262e; padding: 1px 5px; border-radius: 4px; font-size: 12px; color: #cfe3ee; }}
  @media (max-width: 1100px) {{ .board {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} .info, .wide {{ grid-template-columns: 1fr; }} }}
  @media (max-width: 620px) {{ .board {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<header class="top">
  <h1>任务看板</h1>
  <div class="meta">共 {n_games} 项任务（已完成 {n_ship}） · 更新于 {esc(b.get('updated', ''))}</div>
  <p class="meta">{esc(b.get('queue_note', ''))}</p>
</header>
<div class="wrap">
  <div class="info">
    <section><h2>任务发布与通知</h2><p class="detail">发布任务发一条；验收完成发一条；阶段成果和重大阻塞另报。无变化不刷屏。登记不等于开工，原有授权门禁保留。</p><h2>工作流程</h2><ol>{flow}</ol></section>
    <section><h2>通用交付标准</h2><ul>{common}</ul></section>
  </div>
  <div class="filters"><input id="search" aria-label="搜索任务" placeholder="搜索任务、负责人、进度"><select id="kind" aria-label="任务类型"><option value="">全部类型</option><option>游戏</option><option>运维</option><option>验证</option><option>工具</option></select></div>
  <div class="board" id="task-columns">
{os.linesep.join(cols)}
  </div>
  <details><summary>游戏候补与历史授权说明（保留）</summary><div class="wide">
    <section><h2>候补：可以合法使用原版素材的老游戏</h2><div class="board" style="grid-template-columns:repeat(2,minmax(0,1fr))">{cands}</div></section>
    <section><h2>不做（授权不允许）</h2><ul>{rejected}</ul></section>
  </div></details>
</div>
<footer>本页由 <code>board.json</code> 生成。游戏与运维等任务统一登记；已完成须有核验记录。无外部资源、无账号。</footer>
<script>
const search = document.querySelector('#search'), kind = document.querySelector('#kind');
function filterTasks() {{
  const text = search.value.trim().toLowerCase();
  document.querySelectorAll('#task-columns .task').forEach(card => {{
    card.hidden = (kind.value && card.dataset.kind !== kind.value) || !card.innerText.toLowerCase().includes(text);
  }});
  document.querySelectorAll('#task-columns .col').forEach(col => {{
    const cards = [...col.querySelectorAll('.task')], visible = cards.filter(c => !c.hidden).length;
    col.querySelector('.count').textContent = visible;
    col.hidden = (text || kind.value) && !visible;
  }});
}}
search.addEventListener('input', filterTasks); kind.addEventListener('change', filterTasks);
</script>
</body>
</html>
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"board.html written: {len(doc)} bytes, {n_games} tasks ({n_ship} completed), {len(b.get('candidates', []))} candidates")


if __name__ == "__main__":
    main()
