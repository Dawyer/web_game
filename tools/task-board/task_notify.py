#!/usr/bin/env python3
"""Notify task changes without an LLM. A new store takes a silent baseline."""
import fcntl
import json
import os
from pathlib import Path

LABELS = {'planned': '待开始', 'active': '进行中', 'blocked': '阻塞 / 暂停',
          'verifying': '待验收', 'shipped': '已完成', 'backlog': '待排期', 'cancelled': '已取消'}


def collect(board_path, state_path):
    board_path, state_path = Path(board_path), Path(state_path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    with state_path.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.loads(board_path.read_text())
        current = {t['id']: t for t in data['tasks']}
        previous = json.loads(state_path.read_text()) if state_path.exists() else None
        notices = []
        if previous is not None:
            for ident, task in current.items():
                old = previous.get(ident)
                if task['state'] == 'shipped' and not task.get('evidence'):
                    if not old or old.get('notification_error') != 'missing_evidence':
                        notices.append(f"【任务状态异常】{task['name']}：缺少核验记录，不能作为完成任务通知。")
                    current[ident] = dict(task, state=old['state'] if old else 'verifying', notification_error='missing_evidence')
                    continue
                if old is None or (old.get('state') in ('backlog', 'cancelled') and task['state'] in ('planned', 'active')):
                    notices.append(f"【任务发布】{task['name']}\n负责：{task.get('owner', '待安排')} · 状态：{LABELS[task['state']]}\n{task.get('pitch', '')}")
                if task['state'] == 'shipped' and (not old or old.get('state') != 'shipped'):
                    proof = '；'.join(str(x) for x in task['evidence'])
                    notices.append(f"【任务完成】{task['name']}\n核验：{proof}")
        tmp = state_path.with_suffix('.new')
        tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2))
        os.replace(tmp, state_path)
        return '\n\n'.join(notices) or '[SILENT]'


if __name__ == '__main__':
    home = Path(os.environ.get('HERMES_HOME', Path.home()/'.hermes'))
    print(collect(home/'los-nightly/board.json', home/'los-nightly/task-notify-state.json'))
