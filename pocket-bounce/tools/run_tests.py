#!/usr/bin/env python3
"""One Node file at a time, capped heap, enforced timeout, exact raw command/output."""
import pathlib, subprocess, sys, os, signal
root = pathlib.Path(__file__).resolve().parents[1]
node = os.environ.get('NODE', '/home/piece_los/.hermes/tools/node-26.12.1-linux-x64/bin/node')
names = sys.argv[1:] or [p.name for p in sorted((root / 'tests').glob('*.test.mjs'))]
logs = root / 'evidence'
logs.mkdir(exist_ok=True)
for name in names:
    if pathlib.Path(name).name != name or not name.endswith('.test.mjs'):
        raise SystemExit('Expected a test filename only')
    cmd = [node, '--max-old-space-size=192', '--test', '--test-isolation=none', '--test-concurrency=1', '--test-timeout=20000', 'tests/' + name]
    path = logs / (name + '.log')
    if path.exists():
        i = 1
        while path.with_suffix(f'.attempt{i}.log').exists(): i += 1
        path = path.with_suffix(f'.attempt{i}.log')
    with path.open('w') as out:
        out.write('COMMAND: ' + ' '.join(cmd) + '\n'); out.flush()
        process = subprocess.Popen(cmd, cwd=root, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
            out.write('\nTIMEOUT: stopped this file, no further tests launched\n'); code = 124
        out.write(f'\nEXIT_CODE: {code}\n')
    print(path.read_text(), flush=True)
    if code: raise SystemExit(code)