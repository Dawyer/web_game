import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('build_board', Path(__file__).with_name('build_board.py'))
board = importlib.util.module_from_spec(spec)
spec.loader.exec_module(board)


class TaskBoardTests(unittest.TestCase):
    def render(self, data):
        with tempfile.TemporaryDirectory() as td:
            source, output = Path(td)/'board.json', Path(td)/'board.html'
            source.write_text(json.dumps(data, ensure_ascii=False))
            old_source, old_out = board.BOARD, board.OUT
            board.BOARD, board.OUT = str(source), str(output)
            try:
                board.main()
                return output.read_text()
            finally:
                board.BOARD, board.OUT = old_source, old_out

    def test_non_game_task_appears_in_blocked_column(self):
        doc = self.render({'games': [], 'tasks': [{
            'id': 'hw-setup', 'name': 'HW 环境准备', 'pitch': '准备开发环境',
            'kind': '运维', 'state': 'blocked', 'owner': '协调方',
            'blocker': '等待依赖', 'evidence': ['SSH 连接已验证']
        }]})
        self.assertIn('<title>任务看板', doc)
        self.assertIn('data-task-id="hw-setup"', doc)
        self.assertIn('col-blocked', doc)
        for text in ['HW 环境准备', '协调方', '等待依赖', 'SSH 连接已验证']:
            self.assertIn(text, doc)
        self.assertIn('共 1 项任务', doc)


    def test_finished_task_without_proof_is_not_published_as_done(self):
        with self.assertRaisesRegex(ValueError, '核验记录'):
            self.render({'tasks':[{'id':'bad','name':'假完成','pitch':'空结论','state':'shipped'}]})

    def test_special_text_is_escaped_and_legacy_games_are_preserved(self):
        doc = self.render({'games':[{'id':'old','name':'<script>unsafe</script>','pitch':'旧条目','state':'cancelled'}]})
        self.assertIn('data-task-id="old"', doc)
        self.assertIn('&lt;script&gt;unsafe&lt;/script&gt;', doc)
        self.assertNotIn('<script>unsafe</script>', doc)


if __name__ == '__main__':
    unittest.main()
