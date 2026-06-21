from __future__ import annotations

import subprocess
import threading
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Literal

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.config import FULL_REFRESH_CRON, HEAT_REFRESH_CRON, PROJECT_ROOT

JobMode = Literal["full_refresh", "heat_refresh"]


@dataclass
class JobState:
    running: bool = False
    current_mode: JobMode | None = None
    last_status: str = "idle"
    last_started_at: str | None = None
    last_finished_at: str | None = None
    last_duration_seconds: float | None = None
    last_message: str = "尚未执行任务"
    log_tail: list[str] = field(default_factory=list)
    schedule: list[dict[str, str]] = field(default_factory=list)


class JobManager:
    def __init__(self) -> None:
        self._state = JobState()
        self._lock = threading.Lock()
        self._scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

    def start(self) -> None:
        if self._scheduler.running:
            return
        self._scheduler.add_job(
            self.run_heat_refresh,
            CronTrigger(**HEAT_REFRESH_CRON),
            id="heat_refresh",
            replace_existing=True,
        )
        self._scheduler.add_job(
            self.run_full_refresh,
            CronTrigger(**FULL_REFRESH_CRON),
            id="full_refresh",
            replace_existing=True,
        )
        self._scheduler.start()
        self._state.schedule = [
            {"job_id": "heat_refresh", "cron": f"{HEAT_REFRESH_CRON}"},
            {"job_id": "full_refresh", "cron": f"{FULL_REFRESH_CRON}"},
        ]

    def shutdown(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    def get_state(self) -> dict[str, object]:
        with self._lock:
            return asdict(self._state)

    def run_full_refresh(self) -> dict[str, object]:
        return self._launch_job("full_refresh")

    def run_heat_refresh(self) -> dict[str, object]:
        return self._launch_job("heat_refresh")

    def _launch_job(self, mode: JobMode) -> dict[str, object]:
        with self._lock:
            if self._state.running:
                return {
                    "accepted": False,
                    "message": f"已有任务正在运行：{self._state.current_mode}",
                    "state": asdict(self._state),
                }

            self._state.running = True
            self._state.current_mode = mode
            self._state.last_status = "running"
            self._state.last_started_at = datetime.now().isoformat(timespec="seconds")
            self._state.last_message = "任务已开始"
            self._state.log_tail = []

        thread = threading.Thread(target=self._run_job, args=(mode,), daemon=True)
        thread.start()
        return {"accepted": True, "message": "任务已启动", "state": self.get_state()}

    def _run_job(self, mode: JobMode) -> None:
        started = time.perf_counter()
        output = deque(maxlen=80)
        commands = self._commands_for_mode(mode)
        success = True
        error_message = "执行完成"

        for command in commands:
            try:
                completed = subprocess.run(
                    command,
                    cwd=PROJECT_ROOT,
                    check=True,
                    capture_output=True,
                    text=True,
                )
                output.append(f"$ {' '.join(command)}")
                if completed.stdout:
                    output.extend(line for line in completed.stdout.splitlines() if line.strip())
                if completed.stderr:
                    output.extend(line for line in completed.stderr.splitlines() if line.strip())
            except subprocess.CalledProcessError as exc:
                success = False
                error_message = f"{' '.join(command)} 执行失败"
                output.append(f"$ {' '.join(command)}")
                if exc.stdout:
                    output.extend(line for line in exc.stdout.splitlines() if line.strip())
                if exc.stderr:
                    output.extend(line for line in exc.stderr.splitlines() if line.strip())
                break

        with self._lock:
            self._state.running = False
            self._state.current_mode = None
            self._state.last_status = "success" if success else "failed"
            self._state.last_finished_at = datetime.now().isoformat(timespec="seconds")
            self._state.last_duration_seconds = round(time.perf_counter() - started, 2)
            self._state.last_message = error_message
            self._state.log_tail = list(output)

    @staticmethod
    def _commands_for_mode(mode: JobMode) -> list[list[str]]:
        python = "python"
        if mode == "heat_refresh":
            return [
                [python, "update_heat.py"],
                [python, "generate_data.py", "--all"],
            ]

        return [
            [python, "update_heat.py"],
            [python, "snapshot.py", "--all"],
            [python, "generate_data.py", "--all"],
        ]


job_manager = JobManager()
