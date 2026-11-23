"""Opt-in Linux RSS/time watchdog for synthetic private-corpus 512 MB regression.

No customer inputs are accepted. The child executes only the repository's
synthetic unittest. This is NOT a production memory certification.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time


def peak_rss_from_status(status: str) -> int:
    """Use kernel high-water RSS even when polling misses a transient spike."""
    values = {}
    for line in status.splitlines():
        fields = line.split()
        if fields and fields[0] in ("VmRSS:", "VmHWM:"):
            if len(fields) != 3 or fields[2] != "kB" or not fields[1].isdigit():
                raise RuntimeError("RSS_UNAVAILABLE")
            if fields[0] in values:\n                raise RuntimeError("RSS_UNAVAILABLE")\n            values[fields[0]] = int(fields[1]) * 1024
    if "VmRSS:" not in values or "VmHWM:" not in values:
        raise RuntimeError("RSS_UNAVAILABLE")
    return max(values.values())


def rss_bytes(pid: int) -> int:
    """Read sampled RSS and kernel VmHWM from Linux procfs; fail closed."""
    status = Path(f"/proc/{pid}/status").read_text(encoding="ascii")
    return peak_rss_from_status(status)


def supervise(command: list[str], *, timeout_s: float, rss_limit_bytes: int,
              poll_s: float = .02) -> tuple[int, int]:
    if sys.platform != "linux" or not Path("/proc/self/status").exists():
        raise RuntimeError("LINUX_PROCFS_REQUIRED")
    if timeout_s <= 0 or rss_limit_bytes <= 0 or poll_s <= 0:
        raise ValueError("INVALID_RESOURCE_BUDGET")
    proc = subprocess.Popen(command, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
    start = time.monotonic()
    peak = 0
    try:
        while True:
            elapsed = time.monotonic() - start
            if elapsed > timeout_s:
                raise RuntimeError("CHILD_TIMEOUT")
            result = proc.poll()
            if result is not None:
                if result != 0:
                    raise RuntimeError("CHILD_TEST_FAILED")
                if peak == 0:
                    raise RuntimeError("RSS_UNAVAILABLE")
                return result, peak
            try:
                peak = max(peak, rss_bytes(proc.pid))
            except (FileNotFoundError, ProcessLookupError, RuntimeError):
                # During exec or process exit VmRSS can briefly be absent.
                if proc.poll() is not None:
                    continue
                if elapsed > min(1.0, timeout_s / 2):
                    raise RuntimeError("RSS_UNAVAILABLE")
            if peak > rss_limit_bytes:
                raise RuntimeError("RSS_LIMIT_EXCEEDED")
            time.sleep(poll_s)
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.wait()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout-seconds", type=float, default=900)
    parser.add_argument("--rss-limit-mib", type=int, default=512)
    args = parser.parse_args()
    if os.environ.get("VISION_RUN_512MB_BOUNDARY") != "1":
        raise SystemExit("OPT_IN_REQUIRED: VISION_RUN_512MB_BOUNDARY=1")
    tests = Path(__file__).resolve().parents[1] / "tests" / "test_vision_private_corpus_stage.py"
    if not tests.is_file():
        raise SystemExit("SYNTHETIC_TEST_MISSING")
    command = [sys.executable, str(tests),
               "PrivateCorpusStageTests.test_actual_512mb_boundary_three_passes_opt_in"]
    try:
        _, peak = supervise(command, timeout_s=args.timeout_seconds,
                            rss_limit_bytes=args.rss_limit_mib * 1024 * 1024)
    except (RuntimeError, ValueError) as exc:
        print(f"RESOURCE_REGRESSION_FAIL {exc}")
        return 1
    print(f"RESOURCE_REGRESSION_PASS peak_rss_mib={peak / 1048576:.1f} synthetic_only=true")
    return 0


if __name__ == "__main__":
    sys.exit(main())
