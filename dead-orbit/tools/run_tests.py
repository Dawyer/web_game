#!/usr/bin/env python3
"""串行运行 dead-orbit 的全部 node --test 单测，输出汇总。"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TESTS = os.path.join(ROOT, 'tests')


def main():
    files = sorted(f for f in os.listdir(TESTS) if f.endswith('.test.mjs'))
    total_pass = total_fail = 0
    failed = []
    for f in files:
        env = dict(os.environ)
        env['NODE_OPTIONS'] = '--max-old-space-size=192'
        try:
            r = subprocess.run(
                ['node', '--test', '--test-concurrency=1',
                 '--test-timeout=20000', os.path.join(TESTS, f)],
                cwd=ROOT, env=env, capture_output=True, text=True, timeout=60,
            )
            out = r.stdout + r.stderr
            # 解析 node --test 汇总行
            import re
            m = re.search(r'pass (\d+)', out)
            mf = re.search(r'fail (\d+)', out)
            p = int(m.group(1)) if m else 0
            fl = int(mf.group(1)) if mf else 0
            total_pass += p
            total_fail += fl
            status = 'OK' if r.returncode == 0 and fl == 0 else 'FAIL'
            if status == 'FAIL':
                failed.append(f)
            print(f'[{status}] {f}: {p} pass / {fl} fail')
            if status == 'FAIL':
                print(out[-2000:])
        except subprocess.TimeoutExpired:
            total_fail += 1
            failed.append(f)
            print(f'[TIMEOUT] {f}')
    print(f'\nTOTAL: {total_pass} pass / {total_fail} fail across {len(files)} files')
    return 1 if failed or total_fail else 0


if __name__ == '__main__':
    sys.exit(main())
