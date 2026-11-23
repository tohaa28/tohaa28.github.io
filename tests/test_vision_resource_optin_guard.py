"""Synthetic regression: expensive private-corpus checks require explicit opt-in."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / 'tools' / 'vision_resource_runner.py'

@unittest.skipUnless(sys.platform == 'linux', 'Linux procfs watchdog')
class ResourceOptInGuardTests(unittest.TestCase):
    def test_default_cli_refuses_heavy_run_three_times(self):
        env = os.environ.copy()
        for attempt in range(3):
            for invalid_opt_in in (None, '0', 'true', '1 ', ''):
                with self.subTest(attempt=attempt, invalid_opt_in=invalid_opt_in):
                    env.pop('VISION_RUN_512MB_BOUNDARY', None)
                    if invalid_opt_in is not None:
                        env['VISION_RUN_512MB_BOUNDARY'] = invalid_opt_in
                    result = subprocess.run(
                    [sys.executable, str(RUNNER), '--timeout-seconds', '1', '--rss-limit-mib', '32'],
                        cwd=ROOT, env=env, capture_output=True, text=True, timeout=5,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('OPT_IN_REQUIRED', result.stdout + result.stderr)
                    self.assertNotIn('RESOURCE_REGRESSION_PASS', result.stdout + result.stderr)

if __name__ == '__main__':
    unittest.main()
