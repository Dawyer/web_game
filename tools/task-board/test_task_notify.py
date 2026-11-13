import importlib.util
from pathlib import Path
import tempfile
import json
import unittest


class TaskNotifyTests(unittest.TestCase):
    def load_module(self):
        path = Path(__file__).with_name('task_notify.py')
        self.assertTrue(path.is_file(), '任务变更通知器尚未实现')
        spec = importlib.util.spec_from_file_location('task_notify', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_new_task_is_announced_once_without_model(self):
        mod = self.load_module()
        with tempfile.TemporaryDirectory() as td:
            board, state = Path(td)/'board.json', Path(td)/'state.json'
            board.write_text(json.dumps({'tasks': []}))
            self.assertEqual(mod.collect(board, state), '[SILENT]')
            board.write_text(json.dumps({'tasks': [{'id':'T1','name':'新工作','state':'planned','owner':'HW','pitch':'先检查环境'}]}, ensure_ascii=False))
            message = mod.collect(board, state)
            self.assertIn('任务发布', message)
            self.assertIn('新工作', message)
            self.assertIn('HW', message)
            self.assertIn('待开始', message)
            self.assertEqual(mod.collect(board, state), '[SILENT]')


    def test_completed_task_needs_evidence_and_is_announced_once(self):
        mod = self.load_module()
        with tempfile.TemporaryDirectory() as td:
            board, state = Path(td)/'board.json', Path(td)/'state.json'
            task = {'id':'T1','name':'示例任务','state':'active','owner':'协调方'}
            board.write_text(json.dumps({'tasks':[task]}))
            mod.collect(board, state)
            task['state'] = 'shipped'
            board.write_text(json.dumps({'tasks':[task]}))
            self.assertIn('缺少核验记录', mod.collect(board, state))
            task['evidence'] = ['实测退出0，产物已读回']
            board.write_text(json.dumps({'tasks':[task]}))
            message = mod.collect(board, state)
            self.assertIn('任务完成', message)
            self.assertIn('实测退出0，产物已读回', message)
            self.assertEqual(mod.collect(board, state), '[SILENT]')


    def test_promoting_queued_work_is_a_task_publication(self):
        mod = self.load_module()
        with tempfile.TemporaryDirectory() as td:
            board, state = Path(td)/'board.json', Path(td)/'state.json'
            task = {'id':'T1','name':'已排队任务','state':'backlog'}
            board.write_text(json.dumps({'tasks':[task]}))
            mod.collect(board, state)
            task['state'] = 'planned'
            board.write_text(json.dumps({'tasks':[task]}))
            self.assertIn('任务发布', mod.collect(board, state))
            self.assertEqual(mod.collect(board, state), '[SILENT]')


if __name__ == '__main__':
    unittest.main()
